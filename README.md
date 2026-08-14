# Fashion ERP Backend

Backend API for the Fashion ERP / POS system.

## Technology Stack

- NestJS (TypeScript)
- MySQL + TypeORM
- Redis
- BullMQ
- Kafka (transactional outbox transport)
- Swagger / OpenAPI
- Jest + Supertest

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the architecture and
the phased roadmap under [ai](./%E2%80%8Cai).

## Status

This repository currently implements Phases 01-22.

### Implemented

- Core infrastructure, auth, RBAC, organization, users/employees, master data, products, customers/suppliers, and sales
- Purchase orders, inventory, inventory ledger, payments, accounting, general ledger, and trial balance
- Transactional outbox, Kafka consumers/producers, Redis cache, BullMQ queues/workers, notifications, and reports/dashboard
- Request correlation ID, structured logging, validated configuration, Swagger/OpenAPI, and Jest unit/e2e coverage

### Not Implemented Yet

Phase 23 and beyond remain out of scope for the current repository state.

## Development Setup

### Option A - Local Node + Docker Infrastructure Only

```bash
npm install
cp .env.example .env
docker compose up -d mysql redis kafka
npm run start:dev
```

### Option B - Full Docker Stack (API + MySQL + Redis + Kafka)

```bash
cp .env.example .env
docker compose up -d
```

The API container uses NestJS watch mode and bind-mounts the source
directory, so local edits are picked up automatically. `node_modules` is
kept in a separate Docker volume so host/container dependency installs do
not conflict.

## Docker Architecture

```text
                    Fashion ERP Backend
                           |
                    fashion-erp-network
        +------------------+------------------+------------------+
        |                  |                  |                  |
      api                mysql              redis              kafka
   (NestJS)           MySQL 8.0.40      Redis 7.4.1         Kafka 3.9.0
```

- `api` depends on `mysql`, `redis`, and `kafka` reporting healthy before starting
- `mysql` persists data in the `mysql_data` named volume
- `redis` persists data in the `redis_data` named volume
- `kafka` runs as a single-broker KRaft transport for the transactional outbox flow

Container-to-container communication uses Docker service names (`mysql`,
`redis`, `kafka`), never `localhost`. Host ports are configurable via
`.env` (`API_HOST_PORT`, `DB_HOST_PORT`, `REDIS_HOST_PORT`,
`KAFKA_HOST_PORT`).

## Docker Commands

```bash
docker compose up -d
docker compose ps
docker compose logs -f api
docker compose logs -f mysql
docker compose logs -f redis
docker compose logs -f kafka
docker compose down
```

`docker compose down -v` is destructive and deletes local Docker volumes.

## Troubleshooting

- Port already in use: change `API_HOST_PORT`, `DB_HOST_PORT`, `REDIS_HOST_PORT`, or `KAFKA_HOST_PORT` in `.env`
- MySQL, Redis, or Kafka not ready: `docker compose ps` will show health starting until checks pass
- API cannot connect inside Docker: verify `DB_HOST=mysql`, `REDIS_HOST=redis`, and `KAFKA_BROKERS=kafka:9092`
- Docker daemon not running: start Docker Desktop before using `docker compose`

## Environment Variables

See [.env.example](./.env.example) for the supported variables. Database,
Redis, Kafka, outbox, and auth settings are active in the current
repository state.

## Run Commands

```bash
npm run start
npm run start:dev
npm run start:prod
npm run build
```

## Test Commands

```bash
npm test
npm run test:e2e
npm run test:cov
npm run lint
```

## API

- Base URL: `/api/v1`
- Health check: `GET /api/v1/health`
- Swagger UI: `/api/docs`

## Project Architecture

```text
src/
|-- config/
|-- common/
|-- core/
|-- database/
|-- health/
|-- modules/
|-- shared/
|-- app.module.ts
`-- main.ts
```

Business modules are already present phase-by-phase per
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
