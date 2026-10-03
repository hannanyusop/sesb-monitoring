# SESB Electric Usage Monitor

A private, single-owner web application for tracking cumulative electricity meter readings across multiple houses and estimating the current tiered SESB energy charge. Estimates are not official SESB bills.

## Run with Docker

1. Copy `.env.example` to `.env` and replace the database password.
2. Set `WEB_ORIGIN` and `PUBLIC_API_URL` to the HTTPS routes configured in Dokploy for production.
3. Start the stack:

```bash
docker compose up -d --build
```

The web app is available at `http://localhost:8080`; the API is at `http://localhost:3000`. Startup applies versioned Prisma migrations and runs the idempotent tariff seed before accepting traffic.

PostgreSQL uses the `postgres_data` volume. The reserved `meter_photos` volume is mounted at `/data/meter-photos` for the OCR slice. Back up both volumes together with the deployment configuration.

Because this version has no authentication, restrict both production routes at the Dokploy proxy or network layer and serve them only over HTTPS.

## Local development

Requirements: Node.js 22.12 or newer, pnpm 10.17.1, and Docker.

```bash
pnpm install
docker compose -f compose.test.yaml up -d --wait
DATABASE_URL=postgresql://sesb:sesb@localhost:55432/sesb_monitoring_test pnpm --filter @sesb/database db:migrate
DATABASE_URL=postgresql://sesb:sesb@localhost:55432/sesb_monitoring_test pnpm --filter @sesb/database db:seed
pnpm dev
```

Use `.env.example` for the local API and web environment values.

## Verification

```bash
DATABASE_URL=postgresql://sesb:sesb@localhost:55432/sesb_monitoring_test pnpm test
pnpm typecheck
pnpm build
docker compose up -d --build
pnpm --filter @sesb/web exec playwright install chromium
pnpm --filter @sesb/web e2e
```

Health checks:

- API: `GET /health`
- Web: `GET /healthz`
- PostgreSQL: `pg_isready`
