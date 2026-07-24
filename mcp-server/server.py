#!/usr/bin/env python3
"""bragi-qtc MCP server — planned vs available team capacity over HTTP SSE.

Auth model
----------
MCP_API_KEY  admin key (full access + user management)
bragi_<...>  per-user token (stored hashed in mcp_tokens table)

Endpoints
---------
GET  /health                         public
GET  /admin/users                    admin: list members + token counts
POST /admin/users                    admin: create user, returns plaintext token (once)
DELETE /admin/users/{email}          admin: deactivate user, revoke all tokens
POST /admin/users/{email}/tokens     admin: issue extra token for a user
GET  /my/tokens                      user: list own tokens
POST /my/tokens                      user: create new token, returned once
DELETE /my/tokens/{token_id}         user: revoke own token
GET  /sse                            MCP SSE (admin key or user token)
POST /messages/                      MCP post-message (admin key or user token)
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
from contextlib import contextmanager
from typing import Any

import psycopg2
import psycopg2.extras
import uvicorn
from mcp import types
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("bragi-qtc-mcp")

DEFAULT_WORKING_DAYS = 60  # matches DEFAULT_CAPACITY in QuarterlyAllocationTable.jsx


def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(f"Required environment variable {key!r} not set")
    return val


ADMIN_KEY = _require_env("MCP_API_KEY")
POSTGRES_HOST = _require_env("POSTGRES_HOST")
POSTGRES_DB = _require_env("POSTGRES_DB")
POSTGRES_USER = _require_env("POSTGRES_USER")
POSTGRES_PASSWORD = _require_env("POSTGRES_PASSWORD")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", "5432"))


def _get_conn():
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def db():
    conn = _get_conn()
    try:
        yield conn
    finally:
        conn.close()


_MIGRATE_SQL = """
CREATE TABLE IF NOT EXISTS mcp_users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS mcp_tokens (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL REFERENCES mcp_users(email) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);
"""


def _db_migrate() -> None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(_MIGRATE_SQL)
        conn.commit()
    log.info("token tables ready")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _make_token() -> tuple[str, str]:
    """Return (plaintext, hash). bragi_ prefix makes tokens easy to identify."""
    raw = secrets.token_urlsafe(32)
    token = f"bragi_{raw}"
    return token, _hash_token(token)


def _lookup_token(conn, token: str) -> dict | None:
    """Return {email, name} if token is valid and not revoked; else None."""
    h = _hash_token(token)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.email, u.name FROM mcp_tokens t
            JOIN mcp_users u ON u.email = t.user_email
            WHERE t.token_hash = %s AND t.revoked_at IS NULL AND u.active = TRUE
            """,
            (h,),
        )
        row = cur.fetchone()
    if row:
        try:
            with db() as c2:
                with c2.cursor() as cur2:
                    cur2.execute(
                        "UPDATE mcp_tokens SET last_used_at = NOW() WHERE token_hash = %s", (h,)
                    )
                c2.commit()
        except Exception:
            pass  # non-fatal; don't block the request
    return dict(row) if row else None


def to_json(obj: Any) -> str:
    return json.dumps(obj, indent=2)


# ---------------------------------------------------------------------------
# Quarter helpers — matches the "Q<n> <year>" format used by quarter-utils.js
# ---------------------------------------------------------------------------

_QUARTER_RE = re.compile(r"Q(\d)\s+(\d{4})")


def _quarter_sort_key(quarter: str) -> tuple[int, int]:
    m = _QUARTER_RE.match(quarter)
    if not m:
        return (0, 0)
    return (int(m.group(2)), int(m.group(1)))


# ---------------------------------------------------------------------------
# MCP server + tools
# ---------------------------------------------------------------------------

server = Server("bragi-qtc")

TOOLS = [
    types.Tool(
        name="list_teams",
        description=(
            "List all teams with their id, name, active status, Jira project key, and "
            "SP-to-days conversion rates. Call this first to discover valid team_id values."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="list_quarters",
        description="List all quarters that have capacity or allocation data, sorted chronologically.",
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="get_team_capacity",
        description=(
            "Planned vs available capacity (in days) for one team or all teams in a quarter. "
            "Available = each member's configured working days for the quarter (defaults to 60 "
            "if not explicitly set). Planned = days already allocated to work areas. "
            "Remaining = available - planned."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "quarter": {"type": "string", "description": "e.g. 'Q1 2026'"},
                "team_id": {"type": "string", "description": "Optional: limit to one team. Omit for all teams."},
                "include_members": {
                    "type": "boolean",
                    "default": False,
                    "description": "Include a per-member breakdown within each team.",
                },
            },
            "required": ["quarter"],
        },
    ),
]


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    log.info("tool=%s args=%s", name, arguments)
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _dispatch, name, arguments or {})
    except Exception:
        log.exception("tool=%s failed", name)
        raise


def _dispatch(name: str, args: dict) -> list[types.TextContent]:
    if name == "list_teams":
        return _list_teams()
    if name == "list_quarters":
        return _list_quarters()
    if name == "get_team_capacity":
        return _get_team_capacity(args)
    raise ValueError(f"Unknown tool: {name!r}")


def _list_teams() -> list[types.TextContent]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, is_active, jira_project_key, days_per_sp, qa_days_per_sp
                FROM "Team"
                ORDER BY name
                """
            )
            rows = [dict(r) for r in cur.fetchall()]
    return [types.TextContent(type="text", text=to_json({"teams": rows, "count": len(rows)}))]


def _list_quarters() -> list[types.TextContent]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT quarter FROM "TeamMemberCapacity"
                UNION
                SELECT quarter FROM "QuarterlyAllocation"
                """
            )
            quarters = sorted({r["quarter"] for r in cur.fetchall()}, key=_quarter_sort_key)
    return [types.TextContent(type="text", text=to_json({"quarters": quarters}))]


# Per-member capacity/allocation joins, reused by the team-level and
# member-level queries below. TeamMemberCapacity has no unique constraint on
# (team_member_id, quarter), so DISTINCT ON + updated_at picks the latest row.
_CAPACITY_JOIN = """
    LEFT JOIN (
        SELECT DISTINCT ON (team_member_id) team_member_id, working_days
        FROM "TeamMemberCapacity"
        WHERE quarter = %s
        ORDER BY team_member_id, updated_at DESC
    ) tmc ON tmc.team_member_id = tm.id
    LEFT JOIN (
        SELECT team_member_id, SUM(days) AS days
        FROM "QuarterlyAllocation"
        WHERE quarter = %s
        GROUP BY team_member_id
    ) qa ON qa.team_member_id = tm.id
"""


def _get_team_capacity(args: dict) -> list[types.TextContent]:
    quarter = args.get("quarter")
    if not quarter:
        raise ValueError("'quarter' is required")
    team_id = args.get("team_id")
    include_members = bool(args.get("include_members", False))

    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    t.id AS team_id,
                    t.name AS team_name,
                    COUNT(tm.id) AS member_count,
                    COALESCE(SUM(COALESCE(tmc.working_days, %s)), 0) AS available_days,
                    COALESCE(SUM(qa.days), 0) AS planned_days
                FROM "Team" t
                LEFT JOIN "TeamMember" tm ON tm.team_id = t.id
                {_CAPACITY_JOIN}
                WHERE (%s::text IS NULL OR t.id = %s)
                GROUP BY t.id, t.name
                ORDER BY t.name
                """,
                (DEFAULT_WORKING_DAYS, quarter, quarter, team_id, team_id),
            )
            teams = [dict(r) for r in cur.fetchall()]

            members_by_team: dict[str, list[dict]] = {}
            if include_members:
                cur.execute(
                    f"""
                    SELECT
                        tm.id AS member_id,
                        tm.team_id,
                        tm.name AS member_name,
                        tm.discipline,
                        COALESCE(tmc.working_days, %s) AS available_days,
                        COALESCE(qa.days, 0) AS planned_days
                    FROM "TeamMember" tm
                    {_CAPACITY_JOIN}
                    WHERE (%s::text IS NULL OR tm.team_id = %s)
                    ORDER BY tm.name
                    """,
                    (DEFAULT_WORKING_DAYS, quarter, quarter, team_id, team_id),
                )
                for r in cur.fetchall():
                    row = dict(r)
                    row["remaining_days"] = row["available_days"] - row["planned_days"]
                    members_by_team.setdefault(row["team_id"], []).append(row)

    result = []
    for t in teams:
        available = t["available_days"]
        planned = t["planned_days"]
        entry = {
            "team_id": t["team_id"],
            "team_name": t["team_name"],
            "member_count": t["member_count"],
            "available_days": available,
            "planned_days": planned,
            "remaining_days": available - planned,
            "utilization_pct": round(100.0 * planned / available, 1) if available else None,
        }
        if include_members:
            entry["members"] = members_by_team.get(t["team_id"], [])
        result.append(entry)

    return [types.TextContent(type="text", text=to_json({"quarter": quarter, "teams": result}))]


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------
#
# Pure ASGI middleware (not BaseHTTPMiddleware): BaseHTTPMiddleware buffers the
# downstream response through a background task + memory stream, which races
# with and can prematurely tear down long-lived streaming responses like the
# /sse MCP transport -- causing intermittent "Could not find session" errors
# on /messages/* right after a session was created. Plain ASGI middleware
# passes the connection straight through.

class AuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        request = Request(scope, receive=receive)
        path = request.url.path

        if path == "/health":
            return await self.app(scope, receive, send)

        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return await JSONResponse({"error": "Unauthorized"}, status_code=401)(scope, receive, send)
        token = auth[7:]

        # /admin/* -- admin key only
        if path.startswith("/admin"):
            if token != ADMIN_KEY:
                log.warning("admin auth rejected path=%s", path)
                return await JSONResponse({"error": "Unauthorized"}, status_code=401)(scope, receive, send)
            return await self.app(scope, receive, send)

        # /my/* -- valid user token required; admin key not accepted here
        if path.startswith("/my"):
            if token == ADMIN_KEY:
                return await JSONResponse(
                    {"error": "Use a personal user token for /my/* — not the admin key"},
                    status_code=403,
                )(scope, receive, send)
            with db() as conn:
                user = _lookup_token(conn, token)
            if not user:
                return await JSONResponse({"error": "Unauthorized"}, status_code=401)(scope, receive, send)
            scope.setdefault("state", {})["user"] = user
            return await self.app(scope, receive, send)

        # MCP endpoints (/sse, /messages/*) -- admin key OR valid user token
        if token == ADMIN_KEY:
            scope.setdefault("state", {})["user"] = {"email": "admin", "is_admin": True}
        else:
            with db() as conn:
                user = _lookup_token(conn, token)
            if not user:
                log.warning("mcp auth rejected path=%s", path)
                return await JSONResponse({"error": "Unauthorized"}, status_code=401)(scope, receive, send)
            scope.setdefault("state", {})["user"] = user

        return await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

async def handle_admin_users(request: Request) -> JSONResponse:
    if request.method == "GET":
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT u.email, u.name, u.created_at, u.active,
                           COUNT(t.id) FILTER (WHERE t.revoked_at IS NULL) AS active_tokens,
                           COUNT(t.id) AS total_tokens,
                           MAX(t.last_used_at) AS last_used_at
                    FROM mcp_users u
                    LEFT JOIN mcp_tokens t ON t.user_email = u.email
                    GROUP BY u.email, u.name, u.created_at, u.active
                    ORDER BY u.created_at
                    """
                )
                rows = [dict(r) for r in cur.fetchall()]
        return JSONResponse(rows)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "JSON body required"}, status_code=400)

    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or "").strip()
    if not email or not name:
        return JSONResponse({"error": "'email' and 'name' required"}, status_code=400)

    plaintext, token_hash = _make_token()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO mcp_users (email, name) VALUES (%s, %s)
                ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, active = TRUE
                """,
                (email, name),
            )
            cur.execute(
                "INSERT INTO mcp_tokens (user_email, token_hash, label) VALUES (%s, %s, 'initial')",
                (email, token_hash),
            )
        conn.commit()

    log.info("created/updated user %s", email)
    return JSONResponse({"email": email, "name": name, "token": plaintext}, status_code=201)


async def handle_admin_user(request: Request) -> JSONResponse:
    """DELETE /admin/users/{email} -- deactivate user and revoke all tokens."""
    email = request.path_params["email"]
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM mcp_users WHERE email = %s", (email,))
            if not cur.fetchone():
                return JSONResponse({"error": "User not found"}, status_code=404)
            cur.execute(
                "UPDATE mcp_tokens SET revoked_at = NOW() WHERE user_email = %s AND revoked_at IS NULL",
                (email,),
            )
            cur.execute("UPDATE mcp_users SET active = FALSE WHERE email = %s", (email,))
        conn.commit()
    log.info("deactivated user %s", email)
    return JSONResponse({"deactivated": email})


async def handle_admin_user_tokens(request: Request) -> JSONResponse:
    """POST /admin/users/{email}/tokens -- issue new token for an existing user."""
    email = request.path_params["email"]
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email FROM mcp_users WHERE email = %s AND active = TRUE", (email,)
            )
            if not cur.fetchone():
                return JSONResponse({"error": "User not found or inactive"}, status_code=404)

    try:
        body = await request.json()
        label = (body.get("label") or "admin-issued").strip()[:64]
    except Exception:
        label = "admin-issued"

    plaintext, token_hash = _make_token()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO mcp_tokens (user_email, token_hash, label) VALUES (%s, %s, %s)",
                (email, token_hash, label),
            )
        conn.commit()

    return JSONResponse({"email": email, "token": plaintext, "label": label}, status_code=201)


# ---------------------------------------------------------------------------
# User self-service endpoints
# ---------------------------------------------------------------------------

async def handle_my_tokens(request: Request) -> JSONResponse:
    user = request.state.user
    if request.method == "GET":
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, label, created_at, last_used_at,
                           revoked_at IS NOT NULL AS revoked
                    FROM mcp_tokens
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    """,
                    (user["email"],),
                )
                rows = [dict(r) for r in cur.fetchall()]
        return JSONResponse(rows)

    try:
        body = await request.json()
        label = (body.get("label") or "personal").strip()[:64]
    except Exception:
        label = "personal"

    plaintext, token_hash = _make_token()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO mcp_tokens (user_email, token_hash, label) VALUES (%s, %s, %s)",
                (user["email"], token_hash, label),
            )
        conn.commit()

    return JSONResponse({"token": plaintext, "label": label}, status_code=201)


async def handle_my_token(request: Request) -> JSONResponse:
    """DELETE /my/tokens/{token_id} -- revoke one of your own tokens."""
    user = request.state.user
    try:
        token_id = int(request.path_params["token_id"])
    except (ValueError, KeyError):
        return JSONResponse({"error": "Invalid token ID"}, status_code=400)

    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM mcp_tokens WHERE id = %s AND user_email = %s AND revoked_at IS NULL",
                (token_id, user["email"]),
            )
            if not cur.fetchone():
                return JSONResponse({"error": "Token not found"}, status_code=404)
            cur.execute("UPDATE mcp_tokens SET revoked_at = NOW() WHERE id = %s", (token_id,))
        conn.commit()

    log.info("user %s revoked token %d", user["email"], token_id)
    return JSONResponse({"revoked": token_id})


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def _ping_db() -> None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")


async def handle_health(request: Request) -> JSONResponse:
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _ping_db)
        return JSONResponse({"status": "ok"})
    except Exception as e:
        log.error("health check failed: %s", e)
        return JSONResponse({"status": "error", "detail": str(e)}, status_code=503)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def build_app() -> Starlette:
    transport = SseServerTransport("/messages/")

    async def handle_sse(request: Request):
        async with transport.connect_sse(
            request.scope, request.receive, request._send
        ) as streams:
            await server.run(streams[0], streams[1], server.create_initialization_options())

    app = Starlette(
        routes=[
            Route("/health", endpoint=handle_health),
            # Admin routes (MCP_API_KEY required)
            Route("/admin/users", endpoint=handle_admin_users, methods=["GET", "POST"]),
            Route("/admin/users/{email:path}/tokens", endpoint=handle_admin_user_tokens, methods=["POST"]),
            Route("/admin/users/{email:path}", endpoint=handle_admin_user, methods=["DELETE"]),
            # User self-service (personal bragi_* token required)
            Route("/my/tokens/{token_id}", endpoint=handle_my_token, methods=["DELETE"]),
            Route("/my/tokens", endpoint=handle_my_tokens, methods=["GET", "POST"]),
            # MCP SSE
            Route("/sse", endpoint=handle_sse),
            Mount("/messages/", app=transport.handle_post_message),
        ]
    )
    app.add_middleware(AuthMiddleware)
    return app


if __name__ == "__main__":
    _db_migrate()
    log.info("starting bragi-qtc MCP server")
    uvicorn.run(build_app(), host="0.0.0.0", port=8000)
