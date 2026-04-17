# Bragi QTC

Quarterly capacity planning tool for Bragi. Self-hosted via Docker.

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
   - Optionally configure Jira integration fields

4. Start the app:
   ```bash
   docker compose up -d --build
   ```

The app will be available at [http://localhost](http://localhost) (or the port set via `PORT` in `.env`).

On first boot the database schema is applied automatically and the admin user is seeded.

## Deploying updates

```bash
git pull
docker compose up -d --build frontend backend
```

If the update includes schema changes (new fields or models), also run:

```bash
docker compose run --rm backend npx prisma db push
```

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
