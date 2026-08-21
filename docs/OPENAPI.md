# OpenAPI / Swagger

The API contract is generated from the NestJS controllers and DTOs in this
repository.

## Runtime URLs

- Swagger UI: `/docs`
- OpenAPI JSON: `/docs-json`
- Legacy aliases kept for compatibility: `/api/docs`, `/api/docs-json`

Swagger is controlled by `ENABLE_SWAGGER`. The default behavior is:

- non-production: enabled
- production: disabled unless explicitly enabled

## Commands

```bash
npm run openapi:generate
npm run openapi:validate
```

`openapi:generate` builds the NestJS app and writes the deterministic
OpenAPI document to `docs/openapi.json`.

`openapi:validate` rebuilds the expected document and compares it with the
generated file so accidental contract drift is caught during verification.

## Security Contract

- Protected endpoints are documented with HTTP Bearer auth (`Authorization: Bearer <JWT>`)
- Public endpoints remain public in the generated document:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `GET /api/v1/health`

Browser clients may still use the httpOnly session cookie set by the login
endpoint. Bearer support exists primarily for API tooling, Swagger testing,
and Bruno.

## Verification Notes

OpenAPI generation is part of Phase 23-25 verification alongside:

- `npx tsc --noEmit`
- `npm run build`
- `npm run lint`
- `npm test -- --runInBand`
- `npm run test:e2e`
