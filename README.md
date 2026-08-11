# Fashion ERP Backend

Backend API for the Fashion ERP / POS system.

## Technology Stack

- NestJS (TypeScript)
- MySQL + TypeORM — planned, not yet implemented (Phase 03)
- Redis — planned, not yet implemented (Phase 19)
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

```bash
npm install
cp .env.example .env
npm run start:dev
```

## Environment Variables

See [`.env.example`](./.env.example) for the current set of supported variables.
Only foundation-level variables exist today; database/Redis/JWT variables will be
added in later phases as those systems are implemented.

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
