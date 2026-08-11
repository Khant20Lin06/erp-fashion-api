# Fashion ERP Backend

Backend API for the Fashion ERP / POS system.

## Technology Stack

- NestJS (TypeScript)
- MySQL + TypeORM — MySQL infrastructure available via Docker (Phase 02); TypeORM integration planned (Phase 03)
- Redis — infrastructure available via Docker (Phase 02); application integration planned (Phase 19)
- BullMQ — planned, not yet implemented (Phase 20)
- Swagger / OpenAPI
- Jest + Supertest

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the target architecture and
[`‌ai/`](./‌ai) for the phased engineering roadmap (Phase 00–31).

## Status

This repository currently implements **Phase 01 — Project Foundation** only.

### Implemented

- NestJS application bootstrap
- Centralized, validated environment configuration
- Global validation pipe (DTO validation)
- Global exception filter with a consistent, safe error response shape
- Request correlation ID (`x-request-id`)
- Structured logging (pino) with sensitive-field redaction
- API prefix + versioning (`/api/v1`)
- Swagger/OpenAPI documentation
- Liveness health check
- CORS (environment-configured allowlist)
- Security headers (helmet)
- Graceful shutdown foundation
- Jest unit + e2e testing foundation

### Planned (not implemented yet)

Authentication, RBAC, data visibility, organizations/branches/warehouses, users,
products, customers/suppliers, sales, purchases, inventory, payments, accounting,
Redis, BullMQ, reports, and all other business modules. See the phase files under
`‌ai/` for the full roadmap.

## Development Setup

### Option A — Local Node + Docker infrastructure only

```bash
npm install
cp .env.example .env
docker compose up -d mysql redis
npm run start:dev
```

### Option B — Full Docker stack (API + MySQL + Redis)

```bash
cp .env.example .env
docker compose up -d
```

The API container uses NestJS watch mode and bind-mounts the source directory, so
local edits are picked up automatically. `node_modules` is kept in a separate
Docker volume so host/container dependency installs never conflict.

## Docker Architecture

```text
                    Fashion ERP Backend
                           │
                    fashion-erp-network (bridge)
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      api                mysql              redis
   (NestJS)           MySQL 8.0.40      Redis 7.4.1-alpine
```

- `api` — depends on `mysql` and `redis` reporting healthy before starting
- `mysql` — data persisted in the `mysql_data` named volume; healthcheck uses `mysqladmin ping`
- `redis` — data persisted in the `redis_data` named volume; healthcheck uses `redis-cli ping`

Container-to-container communication uses Docker service names (`mysql`, `redis`),
never `localhost`. Host ports are configurable via `.env` (`API_HOST_PORT`,
`DB_HOST_PORT`, `REDIS_HOST_PORT`) in case of local port conflicts.

## Docker Commands

```bash
docker compose up -d          # start all services in the background
docker compose ps             # service status
docker compose logs -f api    # follow API logs
docker compose logs -f mysql  # follow MySQL logs
docker compose logs -f redis  # follow Redis logs
docker compose down           # stop and remove containers (volumes are preserved)
```

**Destructive:** `docker compose down -v` also deletes the `mysql_data` and
`redis_data` volumes — this permanently erases local database contents. Only use
it when you intentionally want a clean-slate database.

## Troubleshooting

- **Port already in use** — change `API_HOST_PORT` / `DB_HOST_PORT` / `REDIS_HOST_PORT`
  in `.env` and re-run `docker compose up -d`.
- **MySQL/Redis not ready** — `docker compose ps` shows `(health: starting)` until
  the healthcheck passes; the `api` container waits for both automatically.
- **API can't connect to MySQL/Redis inside Docker** — verify `DB_HOST=mysql` and
  `REDIS_HOST=redis` (not `localhost`) are set for the `api` service.
- **Docker daemon not running** — start Docker Desktop (or the Docker daemon) before
  running any `docker compose` command.

## Environment Variables

See [`.env.example`](./.env.example) for the current set of supported variables.
Database and Redis infrastructure variables were added in Phase 02; JWT/auth
variables will be added in a later phase.

## Run Commands

```bash
npm run start        # start
npm run start:dev    # start with watch mode
npm run start:prod    # start compiled build
npm run build         # production build
```

## Test Commands

```bash
npm test              # unit tests
npm run test:e2e      # end-to-end tests
npm run test:cov      # unit tests with coverage
npm run lint          # ESLint
```

## API

- Base URL: `/api/v1`
- Health check: `GET /api/v1/health`
- Swagger UI: `/api/docs`

## Project Architecture

```text
src/
├── config/     # centralized configuration + environment validation
├── common/     # cross-cutting infrastructure (filters, middleware, logging)
├── health/     # liveness health check
├── app.module.ts
└── main.ts
```

Business modules (`sales/`, `inventory/`, `products/`, etc.) will be added
phase-by-phase per [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
