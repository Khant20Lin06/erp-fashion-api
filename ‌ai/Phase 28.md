# Phase 28 — Docker Production

## Fashion ERP Backend

## Production-Grade Docker Architecture & Deployment Prompt

You are implementing **Phase 28 — Docker Production** of the Fashion ERP Backend.

The goal of this phase is to transform the existing Docker setup into a **secure, reliable, reproducible, production-ready container architecture**.

The system must be capable of running:

```text
NestJS API
BullMQ Workers
MySQL
Redis
Reverse Proxy
Health Checks
Observability
```

in a production environment.

---

# 1. EXISTING STACK

The backend uses:

```text
NestJS
TypeScript
MySQL
TypeORM
Redis
BullMQ
Docker
Docker Compose
JWT
Dynamic RBAC
Data Visibility
Audit Log
Outbox Pattern
REST API
```

Completed phases:

```text
Phase 00 — AI Rules / Source of Truth
Phase 01 — Project Foundation
Phase 02 — Docker / Infrastructure
Phase 03 — Database Architecture
Phase 04 — Core / Shared Infrastructure
Phase 05 — Authentication
Phase 06 — Dynamic RBAC + Data Visibility
Phase 07 — Organization / Company / Branch / Warehouse
Phase 08 — User / Employee / Account Management
Phase 09 — Master Data
Phase 10 — Product / Variant / Pricing
Phase 11 — Customer / Supplier
Phase 12 — Sales
Phase 13 — Purchase
Phase 14 — Inventory
Phase 15 — Inventory Ledger
Phase 16 — Payment
Phase 17 — Accounting / Double Entry
Phase 18 — Outbox Pattern
Phase 19 — Redis
Phase 20 — BullMQ Workers
Phase 21 — Notifications
Phase 22 — Reports / Dashboard
Phase 23 — API Security
Phase 24 — Automated Testing
Phase 25 — Bruno API Testing
Phase 26 — Performance
Phase 27 — Observability
```

---

# 2. SOURCE OF TRUTH

Before changing anything:

```text
Inspect the existing repository.

Do not invent a new architecture if the current architecture already supports the requirement.

Do not rewrite application business logic.

Do not replace existing Docker configuration blindly.

Do not duplicate services.

Do not break Phase 27 observability.

Do not break BullMQ workers.

Do not break migrations.

Do not break health checks.

Do not break environment configuration.
```

Inspect:

```text
Dockerfile
Dockerfile.*
docker-compose.yml
docker-compose.*.yml
.dockerignore
.env*
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
src/
scripts/
```

Also inspect:

```text
NestJS bootstrap
database configuration
TypeORM configuration
Redis configuration
BullMQ configuration
health checks
logger
observability
shutdown hooks
migration commands
```

---

# 3. TARGET PRODUCTION ARCHITECTURE

Target architecture:

```text
                         Internet
                            │
                            ▼
                    Reverse Proxy
                   / Load Balancer
                            │
                            ▼
                   ┌─────────────────┐
                   │   NestJS API    │
                   │   Container(s)  │
                   └────────┬────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
           MySQL          Redis        BullMQ
             │                             │
             │                             ▼
             │                        Worker(s)
             │
             ▼
        Persistent Storage
```

Important:

```text
API and Worker must be separate processes/containers.

Do not run API and BullMQ worker inside the same production process
unless the existing architecture explicitly requires it.
```

---

# 4. PRODUCTION SERVICES

Evaluate the required production services:

```text
api
worker
mysql
redis
reverse-proxy
```

Optional:

```text
scheduler
migration
backup
monitoring
```

Only add services that are actually required.

---

# 5. API CONTAINER

The API container must:

```text
Start NestJS production build
Use NODE_ENV=production
Use compiled JavaScript
Avoid ts-node in production
Avoid development watchers
Avoid unnecessary source files
```

Example conceptual flow:

```text
Docker build
   ↓
Install dependencies
   ↓
Build NestJS
   ↓
Production runtime image
   ↓
node dist/main.js
```

---

# 6. WORKER CONTAINER

BullMQ workers must have a dedicated production image or shared production image with a different command.

Example:

```text
API:
node dist/main.js

Worker:
node dist/worker.js
```

Use the project's actual entrypoint architecture.

Do not invent `worker.ts` if the project does not have one.

---

# 7. MULTI-STAGE BUILD

Use a multi-stage Docker build where appropriate.

Concept:

```text
Stage 1
───────
Base

Stage 2
───────
Dependencies

Stage 3
───────
Build

Stage 4
───────
Production runtime
```

The final image should contain only what is required to run the application.

---

# 8. PRODUCTION IMAGE

The production image should NOT contain unnecessary:

```text
source maps
test files
documentation
.git
development tooling
test dependencies
local configuration
```

unless required.

---

# 9. NODE ENVIRONMENT

Production must use:

```text
NODE_ENV=production
```

Do not hardcode secrets into the image.

---

# 10. PACKAGE INSTALLATION

Use the existing package manager.

If the repository uses:

```text
npm
```

use npm.

If:

```text
pnpm
```

use pnpm.

If:

```text
yarn
```

use yarn.

Do not change package managers during this phase without a strong reason.

---

# 11. LOCKFILE

Production builds must respect the lockfile.

Use deterministic installation.

For example:

```text
npm ci
```

or the equivalent command for the actual package manager.

Do not use an unconstrained install in production.

---

# 12. .DOCKERIGNORE

Review or create:

```text
.dockerignore
```

Exclude unnecessary files such as:

```text
.git
node_modules
coverage
.env
.env.*
test
tests
docs
*.log
```

Only exclude files that are not needed during build/runtime.

---

# 13. SECRETS

Never bake secrets into Docker images.

Never put production secrets directly into:

```text
Dockerfile
docker-compose.yml
```

Examples:

```text
DATABASE_PASSWORD
JWT_SECRET
REDIS_PASSWORD
SENTRY_DSN
API_KEYS
PAYMENT_SECRETS
```

must come from secure runtime configuration.

---

# 14. ENVIRONMENT CONFIGURATION

Separate:

```text
development
test
staging
production
```

Use appropriate configuration files or secret management.

Example:

```text
.env.example
.env.production.example
```

Do not commit actual production credentials.

---

# 15. ENVIRONMENT VALIDATION

Application startup should validate required production environment variables.

Examples:

```text
DATABASE_URL
JWT_SECRET
REDIS_URL
NODE_ENV
```

Use the project's existing configuration validation system.

If missing:

```text
Fail fast
```

Do not start with unsafe defaults.

---

# 16. DATABASE CONNECTION

Production database configuration must support:

```text
connection limits
timeouts
pooling
reconnect behavior
```

Use the configuration established in earlier phases.

Do not arbitrarily increase connection pools.

---

# 17. MYSQL PRODUCTION

If MySQL is containerized for the target environment:

```text
Use a persistent volume.
Do not store database data only inside the container filesystem.
```

Concept:

```text
mysql container
      │
      ▼
persistent volume
      │
      ▼
database data
```

---

# 18. MYSQL VERSION

Pin the MySQL image version.

Do not use:

```text
mysql:latest
```

Use a specific supported version.

The version must match the project's compatibility requirements.

---

# 19. REDIS PRODUCTION

Pin the Redis image version.

Do not use:

```text
redis:latest
```

Use a supported explicit version.

---

# 20. REDIS PERSISTENCE

Determine whether Redis is being used as:

```text
cache
```

or:

```text
durable queue backend
```

Because BullMQ depends on Redis, evaluate persistence requirements carefully.

Do not treat Redis as disposable if queue durability requirements require persistence.

---

# 21. REDIS SECURITY

Production Redis should not be publicly exposed.

Avoid:

```text
0.0.0.0:6379
```

unless explicitly required.

Prefer internal Docker networking.

---

# 22. MYSQL SECURITY

MySQL should not be publicly exposed unless absolutely required.

Avoid unnecessary:

```text
0.0.0.0:3306
```

in production.

API and worker should connect through the internal network.

---

# 23. INTERNAL NETWORK

Create a private Docker network for:

```text
api
worker
mysql
redis
```

Only the reverse proxy should expose the public HTTP/HTTPS interface.

Concept:

```text
Internet
   │
   ▼
Reverse Proxy
   │
   ▼
Private Network
 ┌──────┬──────┬──────┐
 API   Worker  Redis  MySQL
```

---

# 24. PORT EXPOSURE

Only expose ports that are actually required.

Example:

```text
Reverse Proxy
80
443
```

Avoid exposing:

```text
3306
6379
```

to the public host unless necessary.

---

# 25. API PORT

The NestJS application should listen on the configured internal port.

Example:

```text
0.0.0.0:3000
```

inside the container.

Do not bind the NestJS application only to:

```text
localhost
127.0.0.1
```

inside the container.

---

# 26. HEALTH CHECK

Integrate Phase 27 health endpoints.

For example:

```text
/health/live
/health/ready
```

Use the actual project routes.

---

# 27. DOCKER HEALTHCHECK

Add appropriate Docker health checks.

Example conceptual behavior:

```text
API container
    │
    ▼
GET /health/live
    │
    ├── success → healthy
    └── failure → unhealthy
```

Do not use an unnecessarily expensive health check.

---

# 28. READINESS

Use readiness to determine whether:

```text
MySQL
Redis
required dependencies
```

are available.

The container should not receive traffic before readiness.

---

# 29. STARTUP ORDER

Do not rely only on:

```text
depends_on
```

for actual application readiness.

Containers can start before dependencies are ready.

Use:

```text
healthchecks
retry logic
connection handling
readiness
```

where appropriate.

---

# 30. GRACEFUL SHUTDOWN

NestJS must support graceful shutdown.

When receiving:

```text
SIGTERM
SIGINT
```

the application should:

```text
Stop accepting new requests
Finish active requests where practical
Close database connections
Close Redis connections
Close queue connections
Stop workers gracefully
Flush telemetry/logs where appropriate
Exit
```

---

# 31. WORKER SHUTDOWN

BullMQ workers must not terminate in the middle of jobs unnecessarily.

On shutdown:

```text
Stop accepting new jobs
Finish current job where possible
Close worker
Close Redis connection
Exit cleanly
```

Follow BullMQ's supported shutdown behavior.

---

# 32. DATABASE MIGRATIONS

Production migrations must be explicit.

Do not automatically execute destructive migrations every time the API container starts.

Avoid:

```text
synchronize: true
```

in production.

---

# 33. MIGRATION SERVICE

Evaluate whether production deployment should use a separate migration command/container.

Concept:

```text
Deploy
  │
  ▼
Migration
  │
  ├── success → start API
  └── failure → stop deployment
```

Use the project's existing TypeORM migration architecture.

---

# 34. MIGRATION SAFETY

Never automatically run:

```text
drop schema
drop database
destructive migration
```

in production.

Production migrations must be reviewed and deterministic.

---

# 35. DATABASE BACKUP

Production architecture must include a backup strategy.

Document:

```text
Backup frequency
Retention
Storage
Encryption
Restore procedure
Backup verification
```

Docker volumes alone are NOT a complete backup strategy.

---

# 36. MYSQL BACKUP

If MySQL runs in Docker:

```text
database volume
        +
external backup
```

must be considered.

Do not assume:

```text
docker volume = backup
```

---

# 37. RESTORE TEST

Document how to verify:

```text
Backup
↓
Restore
↓
Database starts
↓
Application connects
↓
Data integrity verified
```

A backup that has never been restored is not sufficiently verified.

---

# 38. REVERSE PROXY

Use a reverse proxy where appropriate.

Possible:

```text
Nginx
Traefik
Cloud Load Balancer
Managed Reverse Proxy
```

If an existing infrastructure decision already exists, use it.

Do not add Nginx merely because it is common.

---

# 39. HTTPS

Production traffic should use:

```text
HTTPS
```

TLS termination may happen at:

```text
reverse proxy
load balancer
cloud platform
```

depending on deployment architecture.

---

# 40. HTTP → HTTPS

Where TLS is terminated by the application infrastructure:

```text
HTTP
 ↓
HTTPS redirect
```

must be handled appropriately.

Ensure NestJS understands proxy headers safely.

---

# 41. TRUST PROXY

If running behind a reverse proxy:

```text
X-Forwarded-For
X-Forwarded-Proto
```

must be handled safely.

Do not blindly trust arbitrary proxy headers.

Configure trusted proxies according to the actual deployment topology.

---

# 42. CONTAINER USER

Do not run the application as root unless absolutely necessary.

Prefer:

```text
non-root user
```

for the NestJS API and worker containers.

---

# 43. FILESYSTEM

Where possible, use:

```text
read-only root filesystem
```

or minimize writable locations.

If the application needs temporary files:

```text
/tmp
```

or an explicit writable volume can be used.

---

# 44. CONTAINER CAPABILITIES

Minimize Linux capabilities.

Do not grant:

```text
privileged: true
```

unless absolutely required.

Avoid:

```text
host network
host PID
host filesystem
```

unless specifically justified.

---

# 45. RESOURCE LIMITS

Production containers should have resource boundaries.

Consider:

```text
CPU
Memory
```

for:

```text
API
Worker
MySQL
Redis
```

Do not blindly choose limits.

Use Phase 26 performance results.

---

# 46. API SCALING

The API should be capable of horizontal scaling:

```text
API 1
API 2
API 3
```

behind:

```text
Load Balancer
```

The API should remain stateless where possible.

---

# 47. STATELESS API

Do not store user session state inside a single API container.

Use:

```text
JWT
Redis
Database
```

according to the existing architecture.

This allows multiple API replicas.

---

# 48. WORKER SCALING

BullMQ workers should be independently scalable.

Example:

```text
Worker 1
Worker 2
Worker 3
```

Use queue concurrency carefully.

Do not create unlimited workers.

---

# 49. WORKER CONCURRENCY

Tune concurrency using:

```text
CPU
memory
database capacity
Redis capacity
external API limits
job type
```

Use Phase 26 performance results.

---

# 50. LOGGING

Integrate Phase 27 structured logging.

Container logs should be sent to:

```text
stdout
stderr
```

rather than relying on files inside the container.

---

# 51. LOG ROTATION

If Docker's local logging driver is used:

```text
configure rotation
```

to prevent unlimited disk usage.

If using centralized logging:

```text
ship stdout/stderr
```

to the logging system.

---

# 52. OBSERVABILITY

Preserve Phase 27:

```text
Logs
Metrics
Traces
Health checks
Request ID
Correlation ID
```

Do not disable observability in production because of containerization.

---

# 53. METRICS

If using a metrics endpoint:

```text
/metrics
```

protect it appropriately.

Do not expose internal telemetry publicly.

---

# 54. TRACE EXPORT

If using OpenTelemetry:

```text
API
Worker
```

must be able to export traces according to production configuration.

Telemetry exporter failure must not normally crash the ERP.

---

# 55. CONTAINER STARTUP

Startup sequence should be predictable.

Example:

```text
Container starts
      ↓
Load environment
      ↓
Validate configuration
      ↓
Initialize application
      ↓
Connect required dependencies
      ↓
Start server
      ↓
Health check passes
      ↓
Receive traffic
```

---

# 56. WORKER STARTUP

Worker:

```text
Container starts
      ↓
Validate configuration
      ↓
Connect Redis
      ↓
Initialize worker
      ↓
Health/readiness available
      ↓
Process jobs
```

---

# 57. FAILED STARTUP

If critical configuration is invalid:

```text
Application should fail fast.
```

Do not keep restarting indefinitely without a clear error.

Docker/orchestrator may restart it, but logs must explain why.

---

# 58. RESTART POLICY

Production services may use restart policies appropriate to the deployment platform.

For example:

```text
unless-stopped
```

or an orchestrator-managed restart strategy.

Do not rely on restart policies as a substitute for fixing application failures.

---

# 59. DEPENDENCY RECOVERY

If MySQL or Redis temporarily becomes unavailable:

```text
Application should recover where supported.
```

Use:

```text
connection retry
backoff
health checks
readiness
```

without creating retry storms.

---

# 60. RETRY STORM PREVENTION

Do not use aggressive infinite retries.

Use:

```text
bounded retry
exponential backoff
jitter
```

where appropriate.

---

# 61. DOCKER COMPOSE PRODUCTION

If Docker Compose is used for production, create a dedicated production configuration.

Example:

```text
docker-compose.prod.yml
```

Do not mix development-only settings into production.

---

# 62. DEVELOPMENT VS PRODUCTION

Development may use:

```text
hot reload
source mounting
debug ports
development dependencies
verbose logs
```

Production should not.

Production should use:

```text
compiled code
minimal image
non-root user
health checks
resource limits
secure networking
```

---

# 63. VOLUME STRATEGY

Identify which services require persistent volumes.

Likely:

```text
MySQL
```

Potentially:

```text
Redis
```

depending on durability requirements.

API and Worker should generally remain stateless.

---

# 64. UPLOADS / MEDIA

Inspect whether the Fashion ERP backend stores:

```text
images
product files
documents
attachments
```

inside the container filesystem.

Do NOT rely on container-local storage for production persistent files.

If the application requires persistent media:

```text
Object Storage
Persistent Volume
Managed Storage
```

should be evaluated.

Do not invent a storage provider.

---

# 65. FILE STORAGE BOUNDARY

If media storage is not part of the current backend implementation:

```text
Document the finding.
```

Do not silently redesign file storage during Phase 28.

---

# 66. NETWORK SECURITY

Production network should follow least privilege.

Example:

```text
Internet
   │
   ▼
Reverse Proxy
   │
   ▼
API
 ┌─┴──────────┐
 ▼            ▼
MySQL       Redis
```

Only necessary communication should be allowed.

---

# 67. MYSQL NETWORK

Only allow:

```text
API → MySQL
Worker → MySQL
Migration → MySQL
```

where actually required.

---

# 68. REDIS NETWORK

Only allow:

```text
API → Redis
Worker → Redis
```

where required.

---

# 69. ADMIN ACCESS

Production database and Redis administration should not be publicly exposed.

Use:

```text
VPN
SSH tunnel
private network
managed administration
```

according to infrastructure.

---

# 70. IMAGE SECURITY

Scan production images for:

```text
critical vulnerabilities
outdated OS packages
vulnerable npm dependencies
```

Use available tools such as:

```text
Trivy
Docker Scout
GitHub Dependabot
```

if appropriate.

Do not add unnecessary tools to runtime images.

---

# 71. DEPENDENCY SECURITY

Run:

```text
npm audit
```

or equivalent.

Review vulnerabilities before production deployment.

Do not blindly force upgrades that break the application.

---

# 72. PIN BASE IMAGE

Do not use:

```text
node:latest
```

Use a specific Node major/minor or approved LTS image.

Match the version used by the project.

---

# 73. BASE IMAGE

Prefer a minimal supported image where compatible.

Evaluate:

```text
node:*-slim
```

or equivalent.

Do not switch to Alpine blindly if native Node dependencies may break.

---

# 74. BUILD REPRODUCIBILITY

Production builds should be reproducible.

Pin:

```text
Node version
package dependencies
base image
MySQL image
Redis image
```

according to project policy.

---

# 75. IMAGE TAGGING

Use meaningful production image tags.

Example:

```text
fashion-erp-api:1.0.0
fashion-erp-worker:1.0.0
```

or:

```text
fashion-erp-api:<git-sha>
```

Prefer immutable tags for deployment.

Do not deploy only:

```text
latest
```

---

# 76. CI/CD COMPATIBILITY

Production Docker configuration should work with CI/CD.

Pipeline concept:

```text
Git Push
   ↓
Test
   ↓
Build
   ↓
Security Scan
   ↓
Build Image
   ↓
Push Registry
   ↓
Deploy
   ↓
Migration
   ↓
Health Check
   ↓
Ready
```

Do not implement a complete CI/CD platform unless required.

---

# 77. ROLLBACK

Document rollback strategy.

Example:

```text
Current version
      ↓
Deploy new version
      ↓
Health check fails
      ↓
Rollback image
      ↓
Restore previous version
```

Database migration rollback must be treated separately.

---

# 78. ZERO-DOWNTIME CONSIDERATION

Evaluate deployment behavior for:

```text
multiple API replicas
graceful shutdown
readiness checks
rolling deployment
```

The architecture should not unnecessarily cause downtime.

---

# 79. DATABASE MIGRATION + ZERO DOWNTIME

Use backward-compatible migration strategy where possible.

Preferred:

```text
Expand
 ↓
Deploy application
 ↓
Migrate data
 ↓
Switch behavior
 ↓
Contract
```

Do not perform destructive schema changes while old API replicas may still be running.

---

# 80. PRODUCTION DOCKER COMPOSE EXAMPLE STRUCTURE

If Compose is appropriate:

```text
services:

  api:
    build:
      target: production
    env_file:
      - .env.production
    depends_on:
      ...
    healthcheck:
      ...
    restart: ...
    networks:
      - backend

  worker:
    build:
      target: production
    command: ...
    env_file:
      - .env.production
    depends_on:
      ...
    restart: ...
    networks:
      - backend

  mysql:
    image: mysql:<pinned-version>
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - backend

  redis:
    image: redis:<pinned-version>
    networks:
      - backend

  reverse-proxy:
    ...
    ports:
      - "80:80"
      - "443:443"
    networks:
      - backend

networks:
  backend:

volumes:
  mysql_data:
```

Adapt this to the actual repository.

Do not copy this blindly.

---

# 81. DOCKERFILE SECURITY CHECKLIST

Verify:

```text
[ ] Multi-stage build
[ ] Production dependencies only
[ ] Non-root user
[ ] No secrets
[ ] No unnecessary packages
[ ] Minimal base image
[ ] Deterministic dependency install
[ ] Correct Node version
[ ] Correct build command
[ ] Correct runtime command
[ ] Proper signal handling
```

---

# 82. API CONTAINER CHECKLIST

Verify:

```text
[ ] Production build
[ ] NODE_ENV=production
[ ] Health endpoint
[ ] Graceful shutdown
[ ] Structured logs
[ ] Metrics
[ ] Tracing
[ ] Non-root
[ ] No public DB access
[ ] No public Redis access
```

---

# 83. WORKER CONTAINER CHECKLIST

Verify:

```text
[ ] Dedicated worker process
[ ] Production build
[ ] Redis connection
[ ] Graceful shutdown
[ ] Job correlation
[ ] Worker logs
[ ] Queue metrics
[ ] Retry behavior
[ ] Non-root
```

---

# 84. MYSQL CHECKLIST

Verify:

```text
[ ] Pinned image
[ ] Persistent storage
[ ] No public exposure unless required
[ ] Strong credentials
[ ] Health check
[ ] Backup strategy
[ ] Restore strategy
[ ] Resource limits
```

---

# 85. REDIS CHECKLIST

Verify:

```text
[ ] Pinned image
[ ] Private network
[ ] Authentication/security where required
[ ] Persistence evaluated
[ ] Health check
[ ] Resource limits
[ ] No public exposure
```

---

# 86. PRODUCTION SECURITY CHECKLIST

Verify:

```text
[ ] No secrets in Git
[ ] No secrets in Dockerfile
[ ] No secrets in image layers
[ ] Non-root containers
[ ] Minimal ports
[ ] Private DB network
[ ] Private Redis network
[ ] HTTPS
[ ] Secure proxy headers
[ ] Image scanning
[ ] Dependency scanning
[ ] Resource limits
[ ] No privileged containers
```

---

# 87. PRODUCTION TESTING

Before declaring completion, test:

```text
docker build
docker compose config
docker compose up
health checks
API startup
worker startup
database connection
Redis connection
BullMQ job processing
migration
graceful shutdown
restart
```

---

# 88. FAILURE TESTING

Test failure scenarios:

```text
MySQL unavailable
Redis unavailable
API restart
Worker restart
container crash
invalid environment variable
failed migration
queue backlog
database connection exhaustion
```

Observe whether the system behaves safely.

---

# 89. GRACEFUL SHUTDOWN TEST

Test:

```text
docker stop api
```

and verify:

```text
active requests handled appropriately
connections closed
logs flushed
container exits cleanly
```

For worker:

```text
docker stop worker
```

verify current jobs are handled safely according to BullMQ semantics.

---

# 90. RESTART TEST

Test:

```text
API restart
Worker restart
MySQL restart
Redis restart
```

and verify recovery behavior.

---

# 91. DATA INTEGRITY

After restarts verify:

```text
Sales
Purchase
Inventory
Inventory Ledger
Payment
Accounting
Outbox
Notifications
```

remain consistent.

Do not perform destructive tests against real production data.

---

# 92. OBSERVABILITY VALIDATION

Phase 27 must remain functional after containerization.

Verify:

```text
logs
metrics
traces
requestId
correlationId
health
errors
queue monitoring
```

---

# 93. PERFORMANCE VALIDATION

Use Phase 26 benchmarks.

Compare:

```text
Before Docker production configuration
vs
After Docker production configuration
```

Check:

```text
latency
throughput
CPU
memory
database
Redis
queue
```

---

# 94. DOCUMENTATION

Create or update:

```text
docs/deployment/
```

Recommended:

```text
production-docker.md
environment.md
database-migration.md
backup-restore.md
rollback.md
security.md
troubleshooting.md
```

Only create documents that are actually useful.

---

# 95. PRODUCTION DEPLOYMENT RUNBOOK

Document:

```text
1. Build image
2. Run tests
3. Security scan
4. Push image
5. Backup database
6. Run migration
7. Deploy API
8. Deploy workers
9. Verify health
10. Verify queues
11. Verify logs
12. Verify metrics
13. Smoke test
14. Monitor
```

---

# 96. ROLLBACK RUNBOOK

Document:

```text
1. Detect failure
2. Stop rollout
3. Identify previous image
4. Roll back API
5. Roll back worker
6. Verify health
7. Verify queue
8. Verify database compatibility
9. Monitor
10. Investigate root cause
```

---

# 97. BACKUP / RESTORE RUNBOOK

Document:

```text
Backup
↓
Verify backup exists
↓
Restore to isolated environment
↓
Run integrity checks
↓
Start application
↓
Run smoke tests
```

---

# 98. TROUBLESHOOTING

Create a production troubleshooting guide for:

```text
API won't start
Worker won't start
MySQL unavailable
Redis unavailable
Health check failing
High CPU
High memory
Slow API
Queue backlog
Database connection exhaustion
Migration failure
Container restart loop
```

---

# 99. PHASE BOUNDARIES

Phase 28 focuses on:

```text
Production Docker
Container security
Container networking
Production images
Health
Persistence
Graceful shutdown
Resource limits
Production configuration
Backup/restore strategy
Deployment/rollback architecture
```

Do NOT turn Phase 28 into:

```text
Kubernetes implementation
Cloud provider migration
Full CI/CD platform
Business logic rewrite
Accounting rewrite
Inventory rewrite
```

Those should be separate concerns unless already required by the repository.

---

# 100. KUBERNETES

Evaluate Kubernetes compatibility conceptually.

The architecture should make future migration possible:

```text
API → stateless
Worker → independently scalable
MySQL → external/managed DB recommended for larger deployments
Redis → managed/external Redis possible
Reverse Proxy → load balancer/ingress
```

Do not implement Kubernetes in this phase unless explicitly requested.

---

# 101. PRODUCTION ARCHITECTURE PRINCIPLE

Follow:

```text
Immutable Images
+
Stateless Application
+
Private Infrastructure Network
+
Externalized Configuration
+
Persistent Database
+
Graceful Shutdown
+
Health Checks
+
Observability
+
Horizontal Scalability
+
Secure Secrets
```

---

# 102. FINAL ACCEPTANCE CHECKLIST

Phase 28 is complete only when:

```text
[ ] Existing Docker architecture audited
[ ] Production Dockerfile implemented/reviewed
[ ] Multi-stage build implemented
[ ] Production image minimized
[ ] Lockfile respected
[ ] .dockerignore reviewed
[ ] Node version pinned
[ ] Base image pinned
[ ] API container production-ready
[ ] Worker container production-ready
[ ] API and Worker separated
[ ] NODE_ENV production configured
[ ] Environment validation verified
[ ] Secrets externalized
[ ] MySQL production configuration reviewed
[ ] MySQL version pinned
[ ] MySQL persistent volume configured where applicable
[ ] Redis production configuration reviewed
[ ] Redis version pinned
[ ] Redis persistence evaluated
[ ] Private Docker network configured
[ ] MySQL not publicly exposed
[ ] Redis not publicly exposed
[ ] Required ports minimized
[ ] Health checks configured
[ ] Liveness verified
[ ] Readiness verified
[ ] Docker HEALTHCHECK configured
[ ] Graceful API shutdown verified
[ ] Graceful Worker shutdown verified
[ ] BullMQ shutdown verified
[ ] Database migrations production-safe
[ ] synchronize disabled in production
[ ] Migration strategy documented
[ ] Backup strategy documented
[ ] Restore strategy documented
[ ] Reverse proxy architecture reviewed
[ ] HTTPS strategy documented
[ ] Proxy headers secured
[ ] Non-root containers configured
[ ] Privileged mode avoided
[ ] Linux capabilities minimized
[ ] Resource limits reviewed
[ ] API horizontal scaling considered
[ ] Worker horizontal scaling considered
[ ] Logging integrated with Phase 27
[ ] Metrics integrated with Phase 27
[ ] Tracing integrated with Phase 27
[ ] Request/correlation IDs preserved
[ ] Image security scanning reviewed
[ ] Dependency security reviewed
[ ] Production image tags defined
[ ] CI/CD compatibility verified
[ ] Rollback strategy documented
[ ] Restart behavior tested
[ ] Dependency failure tested
[ ] Migration failure tested
[ ] Health failure tested
[ ] API restart tested
[ ] Worker restart tested
[ ] Data integrity verified
[ ] Performance compared with Phase 26
[ ] Deployment documentation created
[ ] Troubleshooting runbook created
```

---

# 103. FINAL ACCEPTANCE CRITERIA

Do not report:

```text
"Phase 28 completed"
```

unless the production Docker architecture can demonstrate:

```text
1. API starts reliably.

2. Worker starts reliably.

3. API and Worker are independently deployable.

4. MySQL data survives container restart.

5. Redis behavior matches durability requirements.

6. MySQL and Redis are not unnecessarily public.

7. Secrets are not inside the image.

8. Containers do not unnecessarily run as root.

9. Health checks work.

10. Readiness works.

11. Graceful shutdown works.

12. BullMQ jobs are handled safely during shutdown.

13. Database migrations are controlled.

14. Backup and restore procedures are documented.

15. Rollback strategy exists.

16. Phase 27 observability still works.

17. Phase 26 performance remains acceptable.

18. Production configuration is reproducible.

19. Container failure does not silently corrupt ERP data.

20. The architecture can later scale API and Worker independently.
```

---

# 104. IMPORTANT IMPLEMENTATION RULE

Before writing code:

```text
Inspect first.
Plan second.
Implement third.
Test fourth.
Report last.
```

Do not blindly create files.

For every new production configuration:

```text
Explain why it is required.
Check whether an equivalent already exists.
Reuse existing infrastructure when possible.
```

At the end provide:

```text
1. Files created
2. Files modified
3. Docker architecture
4. Production configuration
5. Security changes
6. Health-check behavior
7. Migration strategy
8. Backup/restore strategy
9. Tests executed
10. Remaining risks
11. Commands to build
12. Commands to run production
13. Commands to verify health
14. Rollback procedure
```

The final objective is:

```text
Fashion ERP Backend
        │
        ▼
Production-Grade Containers
        │
        ├── Secure
        ├── Reproducible
        ├── Scalable
        ├── Observable
        ├── Recoverable
        ├── Maintainable
        └── Deployment-ready
```

Do not optimize for "Docker works".

Optimize for:

```text
Docker works safely
under real production conditions.
```
