# CORE_INFRASTRUCTURE.md

Core / Shared infrastructure implemented in Phase 04. This document describes
what exists now, not future business modules.

## Structure

```text
src/
├── core/
│   ├── context/       # RequestContextService (AsyncLocalStorage), middleware
│   ├── transaction/    # TransactionService (wraps TypeORM transactions)
│   └── errors/         # ErrorCode enum, AppException
└── shared/
    ├── decorators/      # @CurrentUser()
    └── dto/             # PaginationDto, resolveSortField()
```

`core/` holds application-wide infrastructure with architectural significance
(request context, transactions, error taxonomy). `shared/` holds reusable
building blocks any module can use without depending on another business
module.

## Request Context

`RequestContextService` (`src/core/context/`) wraps Node's `AsyncLocalStorage`
to carry per-request data (`requestId`, and later `userId`) without threading
it through every function call or using global mutable state.

`RequestContextMiddleware` populates the context at the start of every
request, seeded from the same `x-request-id` header the Phase 01
`RequestIdMiddleware` already sets — no duplicate request-ID mechanism was
introduced.

`userId` is optional and unset until an authentication guard calls
`setUserId()`. Concurrency safety (no leakage between simultaneous requests)
is verified in `request-context.service.spec.ts`.

## Current User

`@CurrentUser()` (`src/shared/decorators/current-user.decorator.ts`) reads
`request.user`, which an authentication guard is responsible for populating.
It throws a clear internal error if used on a route with no such guard,
rather than silently returning `undefined`. No authentication exists yet — a
future auth guard supplies the actual value.

## Transactions

`TransactionService.run(work)` (`src/core/transaction/`) wraps
`DataSource.transaction()`. Repositories/queries inside `work` must use the
`EntityManager` passed to the callback to actually participate in the
transaction — using an unscoped repository inside `run()` will not be part of
it. Commit/rollback behavior is verified against the real Dockerized MySQL in
`transaction.service.integration.spec.ts` (skipped automatically if DB
environment variables are not present, e.g. in CI without Docker).

## Errors

`ErrorCode` (`src/core/errors/error-codes.ts`) is the single source of truth
for stable, machine-readable error codes; the Phase 01
`GlobalExceptionFilter` now derives its response `code` field from this enum
instead of duplicating string literals.

`AppException` (`src/core/errors/app.exception.ts`) lets application code
throw a typed exception carrying one of these codes:

```typescript
throw new AppException(ErrorCode.NotFound, 'User not found');
```

The exception filter recognizes `AppException` and uses its `errorCode`
directly (rather than inferring the code from the HTTP status alone), so
future domain-specific codes are not forced into a 1:1 mapping with HTTP
status codes.

## Pagination

`PaginationDto` (`src/shared/dto/pagination.dto.ts`) provides `page`, `limit`
(capped at `MAX_LIMIT = 100`), `sort`, and `order`, validated via
`class-validator`. It has no knowledge of any specific business entity.

`resolveSortField()` (`src/shared/dto/resolve-sort-field.ts`) enforces an
explicit allowlist for any client-supplied sort field, so a future list
endpoint cannot pass an arbitrary column name into a query.

## Not Implemented (explicitly deferred)

Authentication, RBAC, roles, permissions, data-scope resolution, company/
branch/warehouse context, response-envelope interceptor, health checks beyond
Phase 01's liveness check. `RequestContextStore` intentionally has no
`companyId`/`branchId`/`roleIds` fields yet — those are added by the phases
that own them without needing to redesign this foundation.
