# AI_CONTEXT.md

# Fashion ERP Backend — Phase Tracking

This file tracks the current implementation phase of the Fashion ERP Backend.
It is the source of truth for "which phase are we on" across AI sessions.

Read this file, then `docs/AI_RULES.md`, before starting any new work.
The full phase specifications live in this same `‌ai/` folder (`PHASE 00.md`,
`Phase 01.md`, ... `Phase 31.md`).

---

## Current Phase

**Phase 01 — Project Foundation**

Status: **Completed**

---

## Phase History

### Phase 00 — AI Rules / Source of Truth

Not a code phase. Equivalent content lives in `docs/AI_RULES.md`.

### Phase 01 — Project Foundation

Status: Completed.

Implemented:

- NestJS application bootstrap (`src/main.ts`, `src/app.module.ts`)
- Centralized environment configuration with Joi validation
  (`src/config/app.config.ts`, `src/config/env.validation.ts`)
- Global `ValidationPipe` (transform, whitelist, forbidNonWhitelisted)
- Global exception filter with a consistent, safe error response shape
  (`src/common/filters/http-exception.filter.ts`)
- Request correlation ID middleware (`x-request-id`)
  (`src/common/middleware/request-id.middleware.ts`)
- Structured logging via `nestjs-pino` with sensitive-field redaction
  (`src/common/logging/logger.options.ts`)
- API prefix (`/api`) + URI versioning (`/api/v1`)
- Swagger/OpenAPI at `/api/docs` with Bearer auth placeholder (no real auth yet)
- Liveness-only health check: `GET /api/v1/health`
  (`src/health/`)
- CORS via environment-configured allowlist (`CORS_ORIGINS`)
- Security headers via `helmet`
- Graceful shutdown hooks enabled
- Jest unit test foundation (13 tests) + e2e test foundation (8 tests)

Explicitly NOT implemented (deferred to later phases per Phase 01 scope):
authentication, RBAC, database/TypeORM, Redis, BullMQ, any business modules.

Known/accepted risks:

- `@nestjs/swagger`'s transitive `js-yaml` dependency has a known high-severity
  advisory (ReDoS in YAML flow-collection parsing). It is a dev-time
  OpenAPI-generation dependency, not part of the runtime request path, and no
  untrusted YAML is parsed by this application. Fixing requires a breaking
  downgrade of `@nestjs/swagger`; left as-is for Phase 01. Revisit when
  `@nestjs/swagger` publishes a patched release.

### Phase 02 — Docker / Infrastructure

Not started.

---

## Notes for Future Sessions

- The NestJS project root is `erp-pos fashion api/` itself (no separate
  `backend/` subfolder).
- `docs/API_CONTRACTS.md` does not exist yet — will be needed starting around
  Phase 05+ once real business endpoints are introduced.
- The `‌ai/` folder name begins with an invisible zero-width non-joiner
  character (U+200C). Do not rename it; tools must reference it by copying the
  exact folder name rather than retyping "ai".
- Git repository was initialized as part of Phase 01 with an initial commit.
