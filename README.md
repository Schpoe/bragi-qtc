# Bragi QTC

Quarterly capacity planning tool for Bragi — plan each team's quarter, then compare the plan against what was actually delivered in Jira. Self-hosted via Docker.

## Features

- **Quarterly capacity planning** — per-team allocation of members' days to work items, with utilisation tracking, work-item selection, and a sticky quarter/team filter.
- **Plan history** — versioned snapshots, a flagged **initial plan** baseline, change tracking, and a full audit log.
- **Jira actuals** — pull what was delivered per team for the quarter, with careful semantics:
  - **Completed** = issues *resolved within the quarter* (by resolution date), not merely touched.
  - **In Progress** = open issues whose *status actually changed* during the quarter (test-case links / comments don't count).
  - **Cancelled** = `Obsolete / Won't Do` (and similar) excluded from both.
- **Plan vs Delivered summary** — everything in **days** via a per-team *Working-days-per-story-point* factor; broken into Planned / Unplanned-PROD / Unplanned-non-PROD with Leading/Supporting tags, a deviation narrative, and CSV/PDF export.
- **Quarterly Review page** — finalize a quarter to freeze an immutable, instantly-loading record (per-team + all-teams roll-up) that never drifts as Jira changes.
- **BambooHR availability sync (optional)** — compute each member's quarterly capacity as *weekdays − approved time off* (prefill at quarter start, true-up at quarter end).
- **Clickable Jira links** throughout (PROD IDs, epics, sync candidates) open the issue in a new tab.

## Documentation

See **[docs/quarterly-capacity-planning.md](docs/quarterly-capacity-planning.md)** for the full user guide — setup, planning, the initial-plan baseline, fetching/interpreting Jira actuals, the PROD/Epic matching rules, and finalizing a quarter.

## Prerequisites

- Docker and Docker Compose

## Setup

1. Clone the repository
2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and set:
   - `DB_PASSWORD` — a strong random password for PostgreSQL
   - `JWT_SECRET` — a random string of at least 32 characters
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — initial admin credentials
   - **Jira integration (optional but needed for actuals & links):**
     - `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` — connection + auth. `JIRA_BASE_URL` also powers the clickable issue links.
     - `JIRA_STORY_POINTS_FIELD` — story-points custom field ID (default: auto-detected).
     - `JIRA_EPIC_LINK_FIELD` — Epic Link custom field ID for company-managed projects (default: auto-detected).
     - `JIRA_PROD_PROJECT_KEY` — project key(s) holding PROD items (default: derived from the plan's `prod_id` values, fallback `PROD`).
     - `JIRA_EXCLUDED_STATUSES` — comma-separated statuses treated as cancelled (default: `Obsolete / Won't Do` + common variants).
   - **BambooHR (optional — quarterly availability sync):**
     - `BAMBOOHR_SUBDOMAIN` — your BambooHR company domain.
     - `BAMBOOHR_API_KEY` — a BambooHR API key (used server-side).

4. Start the app:
   ```bash
   docker compose up -d --build
   ```

The app will be available at [http://localhost](http://localhost) (or the port set via `PORT` in `.env`).

On first boot — and on every `up` — the database schema is applied automatically (`prisma db push`) and the admin user is seeded.

## Deploying updates

```bash
git pull && docker compose up -d --build
```

Schema changes (new fields or models) are applied automatically on startup — no separate migration step is required.

## Development

Frontend (Vite dev server):
```bash
npm install
npm run dev
```

Backend:
```bash
cd backend
npm install
npm run dev
```

The backend requires a running PostgreSQL instance. Set `DATABASE_URL` in `backend/.env`.

## Tests

```bash
npm test        # vitest (run once)
npm run lint    # eslint
npm run build   # production build
```
