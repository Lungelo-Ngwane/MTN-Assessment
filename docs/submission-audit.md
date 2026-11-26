# Final submission audit

The original confidential assessment and marking rubric were unavailable in
the repository and supplied attachments. The matrix below traces the phase
briefs available to this review. Only the original rubric can establish
whether a requirement is mandatory or optional for submission.

## Traceability

| Requirement from an available phase brief                                    | Implementation                                                                                                                                      | Verification                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| API foundation, strict typing, environment validation, versioning and health | [Bootstrap](../apps/api/src/main.ts), [app configuration](../apps/api/src/configure-app.ts), [environment](../apps/api/src/config/environment.ts)   | Environment unit tests, health HTTP tests, clean startup                             |
| PostgreSQL, migrations, constraints and isolated tests                       | [Schema](../apps/api/prisma/schema.prisma), [migrations](../apps/api/prisma/migrations), [Compose test setup](../compose.test.yaml)                 | Persistence integration and clean migration replay                                   |
| Registration, login, password hashing and JWT authorization                  | [Auth module](../apps/api/src/auth), [user repository](../apps/api/src/users/user.repository.ts)                                                    | Auth HTTP/integration, password unit tests, browser registration and sign-in         |
| 6.5% calculation and comparison across 12, 24 and 36 months                  | [Repayment engine](../apps/api/src/repayment/amortised-repayment.calculator.ts), [service](../apps/api/src/repayment/repayment.service.ts)          | Financial unit/HTTP cases, independent reference values, browser comparison          |
| Contract CRUD, ownership and pagination                                      | [Controller](../apps/api/src/contracts/contracts.controller.ts), [repository](../apps/api/src/contracts/contract.repository.ts)                     | Wrong-owner HTTP/integration cases, rollback and concurrent PATCH, browser CRUD      |
| Standard errors, request IDs and sanitized logs                              | [HTTP pipeline](../apps/api/src/http)                                                                                                               | Observability HTTP suite, safe frontend error mapping                                |
| Swagger and documented schemas                                               | [OpenAPI setup](../apps/api/src/openapi)                                                                                                            | Swagger HTTP suite, deployment smoke                                                 |
| Private metrics, Prometheus and alerts                                       | [Metrics provider](../apps/api/src/monitoring/http-metrics.ts), [monitoring overlay](../compose.monitoring.yaml), [rules](../monitoring/alerts.yml) | Metrics HTTP tests, Prometheus scrape and rule validation                            |
| Reproducible performance evidence                                            | [Load runner](../scripts/performance.cjs), [fixture](../scripts/performance-fixture.sql)                                                            | [Historical measurements and plans](architecture.md#performance-and-database-review) |
| Accessible web calculator and contract management                            | [Router](../apps/web/src/app.tsx), [features](../apps/web/src/features), [session provider](../apps/web/src/auth/session.tsx)                       | Vitest session isolation/stale quotes and Playwright desktop/mobile                  |
| Quality gates, clean deployment and documentation                            | [Workflow](../.github/workflows/quality.yml), [combined gates](../apps/api/jest.combined.config.cjs), [README](../README.md)                        | Clean source checks and isolated Docker deployment                                   |

The principal test files are
[environment validation](../apps/api/src/config/environment.spec.ts),
[readiness](../apps/api/test/health.e2e-spec.ts),
[persistence](../apps/api/test/persistence.integration-spec.ts),
[authentication](../apps/api/test/auth.e2e-spec.ts),
[repayment arithmetic](../apps/api/src/repayment/amortised-repayment.calculator.spec.ts),
[quote API](../apps/api/test/repayment.e2e-spec.ts),
[contract ownership and concurrent updates](../apps/api/test/contracts.integration-spec.ts),
[safe error handling](../apps/api/test/observability.e2e-spec.ts),
[OpenAPI](../apps/api/test/openapi.e2e-spec.ts),
[metrics](../apps/api/test/metrics.e2e-spec.ts),
[frontend behavior](../apps/web/src/app.test.tsx), and
[browser workflows](../apps/web/e2e/workflow.spec.ts).

The frontend was optional in the initial project objective and implemented in
Phase 10. The case-normalized email rule, Argon2id parameters, JWT format,
decimal library, pagination limits, monitoring thresholds and versioned
snapshot design are engineering choices evidenced in the code. No
mandatory or optional classification beyond the available briefs is inferred.

## Findings

| Severity | Disposition                | Finding and location                                                                                                                                                                                                                                                                         |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | None confirmed             | Review covered source, tests, reachable Git history and isolated runtime.                                                                                                                                                                                                                    |
| High     | None confirmed             | This review does not establish readiness for unrestricted public ingress.                                                                                                                                                                                                                    |
| Medium   | Fixed                      | [Checkout attributes](../.gitattributes) normalize source to LF. Windows checkout conversion previously failed the repository's formatting gate.                                                                                                                                             |
| Medium   | Fixed                      | The [quality workflow](../.github/workflows/quality.yml) omitted frontend build, tests and browser workflows. All three now run sequentially with backend checks and the production audit.                                                                                                   |
| Medium   | Open for public production | [Authentication throttling](../apps/api/src/auth/auth.module.ts) is process-local. The [sample proxy](../apps/web/nginx.conf) keeps the existing API IP-trust policy, so clients behind it share the same auth bucket. Plan trusted ingress and shared abuse controls before public rollout. |
| Medium   | Open for public production | TLS, secrets management, token revocation and backups are deployment work. [Swagger](../apps/api/src/openapi/configure-openapi.ts) can expose operational documentation when enabled. [Metrics](../compose.monitoring.yaml) are unpublished and require a trusted network boundary.          |
| Low      | Fixed                      | The [benchmark fixture](../scripts/performance-fixture.sql) stored 0.065 as the percentage-point rate and mismatched the displayed final instalment. It now matches the 12-month API reference for R15,000. Earlier benchmark figures describe the earlier synthetic fixture.                |
| Low      | Open                       | Development audit findings affect Jest and Nest CLI dependency paths through glob/minimatch. Registry-proposed changes cross tool major versions. Re-evaluate supported updates separately.                                                                                                  |
| Low      | Open                       | Offset pagination and per-page exact counts can become expensive on deep pages. [Repository ordering and index](../apps/api/src/contracts/contract.repository.ts) cover ordinary first-page access.                                                                                          |
| Low      | Open                       | Browser automation covers Chromium on desktop and mobile emulation. Other engines and assistive technologies were outside this audit.                                                                                                                                                        |

## Architecture and security review

Controllers delegate financial and persistence work to injected services and
repositories. The decimal engine isolates rounding and reconciles regular
and final instalments to the total. The API derives snapshots server-side.
The contract repository scopes queries by authenticated owner and locks the
owner's row during PATCH. List rows and the exact count share a repeatable-read
snapshot. PostgreSQL enforces normalized unique email, foreign keys and
financial reconciliation for new or updated snapshots. Existing legacy
snapshots can lack later-added fields.

The global JWT guard defaults to protected routes. The strategy restricts
algorithm, issuer, audience, expiry and subject. Passwords use Argon2id with a
dummy verification path for unknown accounts. DTOs, the request body limit,
explicit CORS origins and Helmet define the HTTP boundary. HTTP error and
log tests exercise sanitized output and request IDs. Metric labels use route
templates, methods and statuses. Swagger uses synthetic examples. The frontend
holds credentials in memory for the request, keeps the resulting token in
memory, and clears or disconnects the prior session on sign-out and expiry.
Contract delete confirmation has explicit keyboard focus and cancellation.

The Git review searched reachable history for private-key markers, common
provider tokens, literal JWT assignments and unexpected environment file
paths. Those searches returned no candidates. The lockfile contains package
author metadata. Git commit authorship remains ordinary repository metadata.
A targeted pattern search does not prove the absence of every possible
secret. No private environment file, confidential document, dump, build
output or raw test artifact appeared in the audited paths. The two selected
screenshots use synthetic accounts and values.

## Verification results

A clean directory was prepared from the committed tree with the audit changes
overlaid. It started without dependencies, generated clients or a local
environment file. On Windows, Node.js 24.21.0 and npm 11.19.0 installed the
lockfile with `npm ci`. The documented key command also ran from Git Bash,
and Prisma Client 7.10.1 generated successfully.

| Check                                                | Result                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Backend build, types, lint and formatting            | Passed from the LF source snapshot                                 |
| Combined backend suite                               | 186 passed across 17 suites                                        |
| Combined coverage                                    | 98.84% statements, 89.16% branches, 99.11% functions, 99.19% lines |
| Existing backend gates                               | 90% statements, 85% branches, 90% functions, 90% lines             |
| Frontend production build and Vitest                 | Passed, 10 tests                                                   |
| Clean Playwright browser installation and tests      | Passed, desktop and mobile emulation in Chromium                   |
| npm production audit including optional dependencies | 0 findings                                                         |
| npm full dependency audit                            | 19 moderate findings, no high or critical findings                 |

The npm audit covers npm packages. No container OS vulnerability scan was
performed. No audit fix forced an incompatible upgrade.

The clean Docker deployment used separate loopback ports and disposable
volumes. API and database readiness, the frontend, Swagger UI and assets,
all three migrations, Prometheus scraping and all three Prometheus rules
passed. The smoke check registered two users, signed in, checked the R15,000
quote against independent rational arithmetic, exercised CRUD, and verified
that a second user received 404 on read, update and delete. It also verified
request-ID correlation, bounded metric labels, absence of fixture credentials
and contract IDs in sampled logs, empty browser storage after sign-in, and
re-authentication after reload. The corrected SQL fixture loaded successfully.
This audit checked Prometheus configuration and scraping. The existing
benchmark command reproduces the earlier target-down firing demonstration.

The isolated stacks and their database volumes were removed after verification.
The original local stack and database were preserved.

## Submission notes

Use the source ZIP for a history-free hand-off or commit the reviewed changes
and submit the GitHub repository according to the assessment instructions.
The source ZIP should exclude local credentials, dependency directories,
reports and database data. Suggested commit message:
`chore: finalize submission audit and complete quality gates`.

The original rubric remains a verification limitation. Hosted GitHub Actions
did not run against these uncommitted changes. The local results above
distinguish verification on Windows Docker Desktop from the intended hosted
Linux workflow.
