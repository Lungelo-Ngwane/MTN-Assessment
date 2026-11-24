# Contract Repayment API

The NestJS API provides liveness and PostgreSQL readiness endpoints. Prisma
repositories persist users and contract calculation snapshots. See the
[architecture decisions](docs/architecture.md) for the schema and repository design.

## Local API with PostgreSQL in Docker

Use Node.js 24.21.0, npm 11.19.0, Docker Desktop, and Docker Compose. From the
repository root in Git Bash, run the following commands.

```bash
npm ci
cp .env.example .env
docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
npm run db:migrate:deploy
npm run dev
```

Copy the example when setting up a new checkout. Keep existing settings when
updating a checkout. In PowerShell, use `Copy-Item .env.example .env`. Use
`npm.cmd` if the execution policy blocks `npm.ps1`.

```bash
curl -i http://localhost:3000/api/v1/health
curl -i http://localhost:3000/api/v1/health/ready
```

Liveness returns HTTP 200 with `{"status":"ok"}` while the process serves HTTP.
Readiness returns the same response when PostgreSQL answers a connectivity
query, and HTTP 503 with `{"status":"unavailable"}` during a database outage.

## Full Docker Compose stack

With a root `.env` in place, run `docker compose up --build -d --wait`. The base
stack keeps PostgreSQL on the internal Compose network. A one-shot migration
service waits for PostgreSQL, applies pending migrations, and then lets the API
start. The API runs as an unprivileged user and Compose checks its readiness.
The published API port is bound to loopback.

Use `docker compose down` to remove the stack while retaining its named data
volume. If using the local PostgreSQL override, include the same two `-f`
arguments when stopping that stack. Choose either workflow for a given Compose
project.

## Configuration

| Variable                                            | Purpose                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NODE_ENV`                                          | API mode. Defaults to `development`; accepts `development`, `test`, or `production`.      |
| `PORT`                                              | HTTP port on the host, defaults to 3000. The container listens on 3000.                   |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL initialization settings for a new Compose volume.                              |
| `POSTGRES_PORT`                                     | Loopback port in the local override, defaults to 5432.                                    |
| `DATABASE_URL`                                      | Required PostgreSQL connection URL for the local API and Prisma CLI.                      |
| `DATABASE_URL_DOCKER`                               | Compose connection URL for both the API and migration service, typically using `db:5432`. |

Shell variables take precedence over the root `.env`. Keep the database name and
credentials in both URLs in sync with the database settings. Percent-encode
special characters in URL credentials and adjust the local URL if you change
`POSTGRES_PORT`. The example credentials are for local development. Once a volume
has been initialized, credential changes require updating the database role as
well as the environment.

## Prisma and migrations

```bash
npm run prisma:generate
npm run db:migrate:status
npm run db:migrate:deploy
```

`db:migrate:deploy` applies committed migrations, including the initial
migration, to the configured database. Use
`npm run db:migrate:dev -- --name <change-name>` after editing the schema on a
development database. That workflow checks for drift and uses a shadow database,
which requires the ability to create databases with this local setup. Review
the generated SQL before sharing it. If drift detection offers to reset an
existing database, stop and investigate the drift.

Build and watch mode generate the client automatically. After a fresh
`npm ci`, run `npm run prisma:generate` before standalone TypeScript, lint,
or Jest commands.

## Verification

| Command                                    | Purpose                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                        | Check application and test TypeScript.                                                                                                               |
| `npm run lint`                             | Run type-aware ESLint.                                                                                                                               |
| `npm run format:check` or `npm run format` | Check or apply Prettier formatting.                                                                                                                  |
| `npm test`                                 | Run unit and end-to-end suites without a development database.                                                                                       |
| `npm run test:integration`                 | Start a disposable PostgreSQL instance, deploy migrations, exercise the real repositories and readiness, and remove the test stack. Requires Docker. |
| `npm run test:cov`                         | Measure unit and end-to-end coverage in `apps/api/coverage/`.                                                                                        |
| `npm run build` and `npm start`            | Generate and compile the API, then run it locally.                                                                                                   |
| `npm audit --omit=dev --omit=optional`     | Audit the dependency set installed in the runtime image.                                                                                             |
