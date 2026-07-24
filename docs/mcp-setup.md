# bragi-qtc MCP Server

Exposes planned vs. available team capacity to Claude (and other MCP clients) over HTTP SSE.

## Connection

```
URL:   https://<host>/sse
Auth:  Bearer <your-token>
```

## Available tools

| Tool | Description |
|---|---|
| `list_teams` | List all teams (id, name, active status, Jira project key, SP-to-days rates) |
| `list_quarters` | List all quarters with capacity or allocation data |
| `get_team_capacity` | Planned vs. available vs. remaining days for one team or all teams in a quarter, optionally per member |

`get_team_capacity` definitions:
- **Available** — each member's configured working days for the quarter (`TeamMemberCapacity.working_days`, defaults to 60 if not explicitly set)
- **Planned** — days already allocated to work areas (`QuarterlyAllocation.days`)
- **Remaining** — available − planned

## Token management

Every user gets their own personal token. Tokens start with `bragi_`.

### Admin: provisioning users (requires `MCP_API_KEY`)

```bash
# Create a user (returns the token — shown once, store it)
curl -X POST https://<host>/admin/users \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@bragi.com", "name": "Alice"}'
# → {"email": "alice@bragi.com", "name": "Alice", "token": "bragi_..."}

# List all users and their token counts
curl https://<host>/admin/users \
  -H "Authorization: Bearer $MCP_API_KEY"

# Issue a replacement token (e.g. user lost theirs)
curl -X POST https://<host>/admin/users/alice@bragi.com/tokens \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "replacement"}'

# Deactivate a user (revokes all their tokens)
curl -X DELETE https://<host>/admin/users/alice@bragi.com \
  -H "Authorization: Bearer $MCP_API_KEY"
```

### Users: managing your own tokens (requires your personal token)

```bash
# List your tokens (id, label, created/revoked/last-used timestamps)
curl https://<host>/my/tokens \
  -H "Authorization: Bearer bragi_..."

# Create an additional token (e.g. for a second device)
curl -X POST https://<host>/my/tokens \
  -H "Authorization: Bearer bragi_..." \
  -H "Content-Type: application/json" \
  -d '{"label": "work laptop"}'
# → {"token": "bragi_...", "label": "work laptop"}

# Revoke a token by ID (get ID from GET /my/tokens)
curl -X DELETE https://<host>/my/tokens/3 \
  -H "Authorization: Bearer bragi_..."
```

> **Note:** The admin key (`MCP_API_KEY`) cannot be used for `/my/*` endpoints.
> Each user must authenticate with their own personal token there.

## Configuring in Claude Code

Add to your MCP server config (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "bragi-qtc": {
      "type": "sse",
      "url": "https://<host>/sse",
      "headers": {
        "Authorization": "Bearer bragi_<your-token>"
      }
    }
  }
}
```

## Deploy

```bash
git pull && docker compose up -d --build
```

The MCP server runs on port 8000 (internal). Expose it through the shared reverse proxy on `proxy_net`.
