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
node -e "const fs=require('node:fs'); const key=require('node:crypto').randomBytes(32).toString('base64url'); fs.writeFileSync('.env',fs.readFileSync('.env','utf8').replace(/^JWT_SECRET=$/m,'JWT_SECRET='+key))"
docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
npm run db:migrate:deploy
npm run dev
```

Copy the example when setting up a new checkout. Keep existing settings when
updating a checkout. In PowerShell, use `Copy-Item .env.example .env`. Use
`npm.cmd` if the execution policy blocks `npm.ps1`.

The command fills an empty `JWT_SECRET` with a 43-character unpadded base64url
value. A 128-character hexadecimal key fails validation. If a local key needs
replacement, clear only the `JWT_SECRET` value and rerun the generation command.
Replacing the key invalidates existing tokens. Leave `CORS_ORIGINS` empty for
same-origin Swagger requests.

```bash
curl -i http://localhost:3000/api/v1/health
curl -i http://localhost:3000/api/v1/health/ready
```

Liveness returns HTTP 200 with `{"status":"ok"}` while the process serves HTTP.
Readiness returns the same response when PostgreSQL answers a connectivity
query, and HTTP 503 with `{"status":"unavailable"}` during a database outage.

## Full Docker Compose stack

Prepare the root `.env` with the copy and JWT generation commands above, then
run `docker compose up --build -d --wait`. The base
stack keeps PostgreSQL on the internal Compose network. A one-shot migration
service waits for PostgreSQL, applies pending migrations, and then lets the API
start. The API runs as an unprivileged user and Compose checks its readiness.
The published API port is bound to loopback.

### Optional Prometheus monitoring

```bash
docker compose -f compose.yaml -f compose.monitoring.yaml up --build -d --wait
docker compose -f compose.yaml -f compose.monitoring.yaml exec -T prometheus promtool check config /etc/prometheus/config/prometheus.yml
docker compose -f compose.yaml -f compose.monitoring.yaml exec -T prometheus promtool check rules /etc/prometheus/config/alerts.yml
```

Open [Prometheus targets](http://localhost:9090/targets) and
[alerts](http://localhost:9090/alerts). The overlay enables a separate listener
on port 9464 inside Docker. It publishes only the Prometheus UI, bound to
loopback on port 9090 by default. The API port does not serve `/metrics`.
Prometheus stores seven days of samples in its own volume.

Outside the overlay, metrics are disabled by default. Set
`METRICS_ENABLED=true` to enable them. The listener defaults to
`METRICS_BIND=127.0.0.1`, `METRICS_PORT=9464` and `METRICS_PATH=/metrics`.
For a container scrape, publish no listener port and restrict network access
to trusted peers. Update the Prometheus target and path together when changing
the listener. See the [architecture guide](docs/architecture.md#monitoring-and-alerting)
for metric labels, alert thresholds and production boundaries.

### Isolated performance and alert verification

```bash
npm run test:performance
npm run test:performance -- --verify-alert
```

The script uses a uniquely named Compose project and disposable volumes. It
registers and logs in once, seeds 22,000 contracts across 21 owners, and reports
query plans, throughput, p50/p95/p99 latency and errors. Defaults are 2,000
measured requests per endpoint, eight concurrent workers and 100 warm-up
requests per endpoint. Set `PERF_REQUESTS` and `PERF_CONCURRENCY` to override
those defaults, or `PERF_API_PORT` and `PERF_PROMETHEUS_PORT` if loopback
ports 35851 and 35852 are in use. The alert option stops only the disposable
API and waits for its target-down alert to become pending, then firing.

The Windows Docker baseline measured 1,010.83 requests/s at 13.88 ms p95 for
repayment calculation, and 534.08 requests/s at 21.18 ms p95 for authenticated
first-page listing, with zero request errors in either scenario. See the
[full results and database plans](docs/architecture.md#performance-and-database-review).

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

The setup command fills the blank JWT placeholder without printing the secret.
Preserve the current secret in an existing checkout unless you intend to
invalidate all issued tokens.

| Authentication setting                        | Purpose                                                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`                                  | Required, 32 random bytes encoded as unpadded base64url.                                                                                        |
| `JWT_ISSUER`, `JWT_AUDIENCE`                  | Default to `contract-repayment-api` and `contract-repayment`.                                                                                   |
| `JWT_TTL_SECONDS`                             | Default 900, accepted range 1–3600 seconds.                                                                                                     |
| `AUTH_RATE_LIMIT`, `AUTH_RATE_WINDOW_SECONDS` | Per route and socket IP. Default 10 requests per 60 seconds.                                                                                    |
| `CORS_ORIGINS`                                | Comma-separated exact HTTP(S) origins, for example `http://localhost:5173,https://app.example.com`. Blank disables browser cross-origin access. |

## Interactive API documentation

Open `http://localhost:3000/api/docs` for Swagger UI and
`http://localhost:3000/api/docs-json` for the OpenAPI JSON specification.
Use your configured host port if it differs from 3000. The local
`.env.example` enables both routes. `SWAGGER_ENABLED` accepts `true` or
`false`. When unset, the local development process enables documentation
and a production or test process disables it. Compose defaults to disabled
when the variable is absent.

### Demonstration workflow

1. In **Authentication**, use **Try it out** on `POST /api/v1/auth/register`.
   Send `{"email":"assessment@example.test","password":"Demo passphrase! 123"}`
   or choose an unused example address. Expect **201**. If you already
   registered the account, continue to login.
2. Send the same credentials to `POST /api/v1/auth/login`. Expect **200**.
   Copy the `accessToken` value, select **Authorize**, and enter the JWT
   without a `Bearer` prefix. Use `GET /api/v1/auth/me` to verify your profile.
3. In **Repayment**, send `{"deviceAmount":"15000.00"}` to
   `POST /api/v1/contracts/calculate`. Expect **200** with 12-, 24- and
   36-month estimates. The 12-month total is `"15533.36"`.
4. In **Contracts**, send `{"deviceAmount":"15000.00","termMonths":12}` to
   `POST /api/v1/contracts`. Expect **201** and copy the returned contract UUID.
5. List contracts with `GET /api/v1/contracts`, then use the UUID with
   `GET /api/v1/contracts/{id}`. Both return **200**.
6. Patch the contract with `{"termMonths":24}`. Expect **200** and a total of
   `"16036.65"`. Delete the demonstration contract and expect **204**.
   Reading the deleted UUID returns **404**.
7. **Health** operations are public. They can be used without the JWT.

Swagger UI keeps authorization in memory. Reloading the page clears it.
When documentation is explicitly enabled in production, both the UI and
JSON specification are public to anyone who can reach those routes.
Restrict both routes and the UI assets at the ingress if only an internal
audience should have access. Use TLS for real credentials.

## Register, log in, and fetch a profile

Emails are trimmed and lowercased on both credential routes. Registration
accepts passwords of 12–128 characters, including spaces, Unicode and
punctuation. Passwords are verified exactly as supplied.

```bash
api=http://localhost:3000/api/v1
curl -i "$api/auth/register" -H 'Content-Type: application/json' \
  -d '{"email":"  Person@Example.com  ","password":"Example passphrase! 123"}'
curl -i "$api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"person@example.com","password":"Example passphrase! 123"}'
curl -i "$api/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN"
```

Set `ACCESS_TOKEN` to the value returned by login. Register responds with HTTP
201 and `me` responds with HTTP 200. Both return this profile shape.

```json
{
  "id": "e57cb305-a042-4ee5-b58f-24c2bbe5bf6e",
  "email": "person@example.com",
  "createdAt": "2026-11-24T12:00:00.000Z",
  "updatedAt": "2026-11-24T12:00:00.000Z"
}
```

Login returns HTTP 200 with
`{"accessToken":"<JWT>","tokenType":"Bearer","expiresIn":900}`.
Invalid credentials return HTTP 401 with `Invalid email or password`.
Duplicate registration returns HTTP 409, which reveals that an address is
registered. Invalid payloads return HTTP 400, oversized bodies return
HTTP 413, and rate-limited requests return HTTP 429.

Use TLS outside local development and inject keys at runtime from a secret
manager. Short-lived tokens have no per-token revocation. Rotating the key
invalidates all tokens signed with the old key. In-memory rate limits apply
per instance and use the socket IP, so users behind a shared proxy may
share a quota.

## Calculate repayment options

Send a bearer token from login and a JSON body containing only `deviceAmount`.
The endpoint returns a quote for 12, 24 and 36 months in ascending order.
It performs no database writes and creates no contract.

```bash
curl -i "$api/contracts/calculate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deviceAmount":"15000.00"}'
```

The input is a positive ZAR decimal **string** with one to twelve integer
digits and zero to two decimal places. Examples include `"15000"`, `"15000.5"`
and `"0.01"`. Use a period as the decimal separator. Signs, whitespace,
thousands separators, leading zeroes on multi-digit integers, scientific
notation and extra properties return HTTP 400. At the current rate and terms,
the supported purchase range is **R0.01 to R906,319,135,069.39**. The 36-month
total for one cent above that ceiling rounds to R1,000,000,000,000.00, which
exceeds the database's `NUMERIC(14,2)` limit. Missing or invalid JWTs return
HTTP 401.

**Financial assumptions for this implementation.** The quote uses a nominal
annual rate of 6.5%, monthly reducing-balance amortisation, and equal end-of-month
instalments with a final cent adjustment. It assumes no deposit, fees,
insurance or balloon payment.

The exact monthly payment is `M = P × r × (1 + r)^n / ((1 + r)^n − 1)`,
where `P` is principal, `r = 0.065 / 12` and `n` is the term in months.
The engine retains 60 significant decimal digits. It rounds `M × n` and the
regular payment half up to cents. The final payment is the rounded total
minus the first `n − 1` payments. If rounding up those payments would make
the final one negative, the regular payment uses the lower cent. This can
produce zero regular payments for very small balances. Total interest is
the rounded total minus principal. The quote provides a regular and a final
payment amount for each term. It has no dated ledger or monthly breakdown
of principal and interest.

HTTP 200 for a R15,000 device:

```json
{
  "currency": "ZAR",
  "deviceAmount": "15000.00",
  "annualInterestRate": "6.500000",
  "calculationMethod": "reducing-balance-amortisation",
  "options": [
    {
      "termMonths": 12,
      "monthlyRepayment": "1294.45",
      "finalRepayment": "1294.41",
      "totalRepayment": "15533.36",
      "totalInterest": "533.36"
    },
    {
      "termMonths": 24,
      "monthlyRepayment": "668.19",
      "finalRepayment": "668.28",
      "totalRepayment": "16036.65",
      "totalInterest": "1036.65"
    },
    {
      "termMonths": 36,
      "monthlyRepayment": "459.74",
      "finalRepayment": "459.56",
      "totalRepayment": "16550.46",
      "totalInterest": "1550.46"
    }
  ]
}
```

The annual rate is in percentage points, as in the existing database schema.
See the [strategy and rounding decisions](docs/architecture.md#repayment-calculation)
for details on changing the engine.

## Manage contracts

Contracts are editable repayment arrangements. They represent saved quotes.
The API uses the bearer token's subject as the owner, and only the owner can
list, read, update or delete a contract.

| Method and path                            | Success                                      |
| ------------------------------------------ | -------------------------------------------- |
| `POST /api/v1/contracts`                   | HTTP 201 with the server-calculated snapshot |
| `GET /api/v1/contracts?page=1&pageSize=20` | HTTP 200 with an owner-scoped page           |
| `GET /api/v1/contracts/:id`                | HTTP 200 with the selected contract          |
| `PATCH /api/v1/contracts/:id`              | HTTP 200 with the recalculated snapshot      |
| `DELETE /api/v1/contracts/:id`             | HTTP 204 with an empty body                  |

```bash
curl -i "$api/contracts" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deviceAmount":"15000.00","termMonths":12}'

curl -i "$api/contracts?page=1&pageSize=20" -H "Authorization: Bearer $ACCESS_TOKEN"
curl -i "$api/contracts/$CONTRACT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
curl -i -X PATCH "$api/contracts/$CONTRACT_ID" -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"termMonths":24}'
curl -i -X DELETE "$api/contracts/$CONTRACT_ID" -H "Authorization: Bearer $ACCESS_TOKEN"
```

Set `CONTRACT_ID` to the UUID returned by creation. The example create response
contains the stored inputs and financial snapshot.

```json
{
  "id": "b3f6ce37-57f2-493b-bfd1-9dc4b3c4a05c",
  "userId": "e57cb305-a042-4ee5-b58f-24c2bbe5bf6e",
  "deviceAmount": "15000.00",
  "termMonths": 12,
  "interestRate": "6.500000",
  "monthlyRepayment": "1294.45",
  "finalRepayment": "1294.41",
  "totalRepayment": "15533.36",
  "totalInterest": "533.36",
  "calculationMethod": "reducing-balance-amortisation",
  "calculationVersion": 1,
  "createdAt": "2026-11-25T12:00:00.000Z",
  "updatedAt": "2026-11-25T12:00:00.000Z"
}
```

Create requires a decimal string in the same range as the comparison quote and
a JSON number of 12, 24 or 36 for `termMonths`. Patch requires at least one of
these fields. Request bodies that include financial outputs, ownership or
other properties return HTTP 400. Invalid UUIDs and pagination also return
HTTP 400. Missing or invalid tokens return HTTP 401. Missing and foreign
contract IDs both return HTTP 404.

Page numbering starts at 1. The default page size is 20 and the maximum is 100. The maximum page number is 1,000,000. Results sort by descending
`createdAt` and descending UUID for ties. An empty first page looks like this.

```json
{
  "items": [],
  "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
}
```

Deletion is permanent. Existing records from before Phase 5 may return null
for `finalRepayment`, `calculationMethod` and `calculationVersion`. A successful
PATCH generates a complete snapshot under the current policy. For a legacy
record with unsupported inputs, provide replacements for those inputs.

## API errors and request IDs

Errors use the following JSON shape. Each request receives a new server-generated
UUID in the `X-Request-ID` response header. Error bodies include the same ID and
an ISO 8601 UTC timestamp. Clients should branch on `code` and use the ID when
reporting an issue.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "requestId": "5eaaa702-477a-4f3a-93ad-864ff5bbb83d",
  "timestamp": "2026-11-25T10:00:00.000Z"
}
```

```json
{
  "statusCode": 401,
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "requestId": "b07de9e2-d849-493d-94e6-df7a6059f955",
  "timestamp": "2026-11-25T10:00:01.000Z"
}
```

| HTTP      | Codes                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| 400       | `VALIDATION_FAILED`, `MALFORMED_JSON`, `INVALID_UUID`, `INVALID_DEVICE_AMOUNT`, `INVALID_CONTRACT_UPDATE`, `BAD_REQUEST` |
| 401       | `UNAUTHORIZED`, `INVALID_CREDENTIALS`                                                                                    |
| 403       | `FORBIDDEN`                                                                                                              |
| 404       | `NOT_FOUND` for missing and inaccessible resources, `ROUTE_NOT_FOUND` for unmatched routes                               |
| 409       | `EMAIL_ALREADY_REGISTERED`, `CONFLICT`                                                                                   |
| 413 / 415 | `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE`                                                                           |
| 429       | `RATE_LIMITED`, with the existing `Retry-After` header                                                                   |
| 500       | `INTERNAL_ERROR`                                                                                                         |
| 503       | `DATABASE_UNAVAILABLE` for recognized connection failures, `SERVICE_UNAVAILABLE` for other expressed outages             |

Other HTTP exceptions retain their status with a generic `HTTP_ERROR` or
`INTERNAL_ERROR` code. Validation messages omit input values and unknown field
names. Phase 6 replaces the previous Nest and parser error shapes, and recognized
database connectivity failures now return 503. Readiness still returns
`{"status":"unavailable"}` on failure, with the correlation ID in the header.

## Logs and local troubleshooting

`LOG_LEVEL` defaults to `info`. Supported levels are `trace`, `debug`, `info`,
`warn`, `error`, `fatal` and `silent`. Local and container runs emit JSON.
HTTP completion logs use info for successful requests, warn for 4xx and error
for 5xx. Startup and HTTP events go to stdout. A bootstrap failure emits a
generic JSON event to stderr. Compose injects the API log level at runtime.

```json
{
  "level": 40,
  "time": 1795600800000,
  "event": "http_request_completed",
  "requestId": "5eaaa702-477a-4f3a-93ad-864ff5bbb83d",
  "method": "POST",
  "route": "/api/v1/contracts",
  "statusCode": 400,
  "durationMs": 2.41,
  "errorCode": "VALIDATION_FAILED"
}
```

Use `curl -i` to see the request ID and search for it in the local console or
`docker compose logs --tail=200 api`. For database failures, check
`/api/v1/health/ready` and the PostgreSQL and migration service logs. If the
process logs `startup_failed` with `INVALID_ENVIRONMENT`, use the reported field
and validation rule to correct the configuration. For `BOOTSTRAP_FAILED`, check
whether the configured port is free and review the Compose service status.

HTTP records use only server-defined route templates and safe metadata. URLs,
query strings, bodies, headers, emails, credentials and SQL are omitted.
Pino redaction and sanitized error serialization provide a second layer.
Correlation is local to this API instance and does not include downstream spans,
aggregated metrics or a log retention service.

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

The Phase 3 migration canonicalizes existing emails in one transaction.
Resolve any normalized duplicates before deploying. A collision rolls back
the migration.

The Phase 5 migration keeps historical values intact, adds snapshot
metadata and final repayment fields, and enforces reconciliation on new
and updated rows. It also replaces the owner-only index with an index
covering owner, creation time and UUID.

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
| `npm audit --omit=dev --include=optional`  | Audit production dependencies including optional packages.                                                                                           |
| `npm run test:cov:all`                     | Run unit, HTTP and PostgreSQL suites in one Jest invocation and enforce coverage thresholds. Requires Docker.                                        |
| `npm run check`                            | Build, typecheck, lint, check formatting and run the combined coverage gate. Requires Docker.                                                        |

For quick local feedback, use `npm test` or `npm run test:cov`. The latter
writes its unit and HTTP report to `apps/api/coverage/`. Use
`npm run test:integration` to run only the PostgreSQL suite. Both Docker
test commands deploy migrations into a disposable database with no published
port and remove the test stack on exit. They require a running Docker
engine and no development database or local `.env`.

The combined report is generated directly by Jest in the test container
and written to `apps/api/coverage/combined/`. Open
`apps/api/coverage/combined/lcov-report/index.html` for file-level results.
The gate requires **90% statements, 85% branches, 90% functions and 90% lines**.
The combined command also checks for open handles. GitHub Actions runs the
same quality command and the production audit on pull requests.
