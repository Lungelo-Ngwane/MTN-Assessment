# Phase 1 architecture

## Workspace and feature boundaries

The private npm workspace owns the lockfile and common quality commands.
`apps/api` owns NestJS runtime dependencies, compilation, and tests. This
lets future applications declare their own dependencies within the same
repository.

`AppModule` composes configuration and `HealthModule`. The health
controller owns route metadata and delegates to the injected health
service. The service returns the liveness result without HTTP or storage
dependencies. Feature modules can follow this pattern as business behavior
is introduced. Add repositories when a feature needs persistence so that
database access sits behind a boundary used by that feature's service.

## HTTP and configuration

The shared application setup adds the `api` prefix and enables URI
versioning. The health controller explicitly declares version 1 so new
versions can be introduced per feature. Supertest uses the same setup as
the application entry point to exercise the public route.

`@nestjs/config` reads the repository-root `.env` and overlays the
process environment. The root module validates the settings before
the HTTP listener starts. Validation supplies development defaults and
converts the port to a number, which the bootstrap reads from typed
configuration. Validation errors identify the invalid variable without
including its supplied value.

`GET /api/v1/health` reports process liveness with `{"status":"ok"}`.
Readiness checks can be introduced when the API depends on external
services. The Compose service runs the compiled application as an
unprivileged user and publishes its port on loopback for local use.

## Verification

The application and tests use strict TypeScript. ESLint checks TypeScript
with type information, and Prettier handles formatting. Jest unit tests
cover liveness and environment validation. Supertest checks HTTP status,
payload, and routing through the configured Nest application. Jest coverage
includes both suites and excludes the production process entry point,
which can be verified by starting the built API and probing it over HTTP.
