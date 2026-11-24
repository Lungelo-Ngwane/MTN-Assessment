# Contract Repayment API architecture

## Modules and persistence

The private npm workspace owns the lockfile and quality commands. `apps/api`
owns the NestJS API, database schema, migrations, and application tests.
`AppModule` composes configuration and the authentication, health, users, and contracts modules.
Health controllers own routing and status codes. Feature repositories own
persistence operations and receive the shared Prisma service through Nest
dependency injection. Each repository exposes the operations demonstrated by
its feature. Callers use TypeScript records and fixed-scale decimal strings
without depending on Prisma input types or `Decimal` objects.

User creation accepts a password hash. Profile lookups and create results
select only profile fields. The internal login lookup selects only a user ID
and password hash. Both credential routes trim and lowercase the email.
The migration canonicalizes existing addresses and the unique index handles
concurrent registrations. A conflicting legacy pair stops the migration for
manual resolution. Review existing internationalized addresses before
migration because PostgreSQL case folding follows the database locale.

## Authentication flow

```mermaid
sequenceDiagram
    participant Client
    participant API as Auth controller and service
    participant DB as User repository and PostgreSQL
    Client->>API: Register with email and password
    API->>API: Normalize email and hash password
    API->>DB: Insert user with hash
    DB-->>API: Safe profile or unique constraint error
    API-->>Client: 201 profile or 409 conflict
    Client->>API: Login with email and password
    API->>DB: Read user ID and hash
    API->>API: Verify Argon2id and sign access token
    API-->>Client: 200 token or generic 401
    Client->>API: Request /me with Bearer token
    API->>API: Verify JWT and extract UUID subject
    API->>DB: Read current profile by UUID
    API-->>Client: 200 profile or 401
```

The global Passport guard protects routes by default. Use `@Public()` for
intentional anonymous routes. Liveness, readiness, registration and login
are public. Protected handlers can use `@CurrentUser()` for the typed UUID
principal. Passport verifies the HS256 signature, expiration, issuer and
audience. The strategy also requires an expiration claim and UUID subject.
Tokens contain subject, issuer, audience, issuance and expiration only.
The profile route checks account existence. Future protected endpoints
must decide whether their operation requires a current-account check.

Argon2id uses 19 MiB, two passes, one lane and a random salt from the library.
Login verifies a precomputed dummy hash for unknown accounts, so both failed
credential paths perform password verification. Database and runtime
variation can still affect timing. HTTP 409 on duplicate registration
allows account enumeration. Both credential failure paths return the
same generic HTTP 401 response.

Helmet, a 16 KiB body limit and the global DTO pipe apply to HTTP requests.
The pipe rejects unexpected properties and avoids implicit conversion.
Authentication errors are sanitized before reaching logs or clients.
The browser origin allowlist is explicit and cookie credentials are disabled.
Rate limiting counts registration and login separately by socket IP in
memory per instance. Forwarded headers are ignored. Users behind a shared
proxy can share a quota. Coordinate rate limiting at trusted ingress before
scaling horizontally. Deploy with TLS and runtime-managed random keys.
Stateless access tokens have no per-token revocation and expire after their
configured lifetime. Rotating the key invalidates all earlier tokens.

## Data model

```mermaid
erDiagram
    USER ||--o{ CONTRACT : owns
    USER {
        uuid id PK
        text email UK
        text passwordHash
        timestamptz createdAt
        timestamptz updatedAt
    }
    CONTRACT {
        uuid id PK
        uuid userId FK
        decimal deviceAmount
        decimal interestRate
        integer termMonths
        decimal monthlyRepayment
        decimal totalRepayment
        decimal totalInterest
        timestamptz createdAt
        timestamptz updatedAt
    }
```

PostgreSQL generates UUID primary keys and provides timestamp defaults. Prisma
maintains `updatedAt` for ORM updates. Every contract has one existing owner.
The foreign key restricts deletion and ID changes for users with contracts,
preserving contract history. An index on `Contract.userId` supports owner
lookups.

Monetary values use `NUMERIC(14,2)`, with 12 integer digits and two
fractional digits. Rates use `NUMERIC(9,6)` in percentage points. A 6.5%
rate is stored as `6.500000`. The migration requires a positive term and
finite nonnegative numeric values. Calculated fields are stored as snapshots
provided by callers. The repository performs no calculation. PostgreSQL
rounds values that exceed the declared scale during insertion, so the future
calculation service should supply values at the chosen business precision.
The calculation feature applies fixed terms and rounding before returning
quotes. The schema remains independent of the calculation policy.

## Repayment calculation

`RepaymentModule` owns the authenticated `POST /api/v1/contracts/calculate`
route. The controller validates the request through the global DTO pipe and
maps unsupported amounts to HTTP 400. The service fixes the annual rate to
6.500000 percentage points and requests 12, 24 and 36 months in order.
The existing JWT guard authenticates the request. The module has no
persistence dependency, and neither the service nor the calculator reads
or writes the database.

**Implementation assumptions.** The proposed model uses a nominal 6.5%
annual rate, monthly reducing-balance amortisation, equal end-of-month
instalments with a final rounding adjustment, and no deposit, additional fees,
insurance or balloon payment. The model uses `M = P × r × (1 + r)^n / ((1 + r)^n − 1)`
with `r = annual percentage points / 1200`. The internal zero-rate case
uses `P / n`. The API exposes a fixed rate and fixed terms.

The strategy uses an isolated 60-significant-digit decimal.js context with
half-up rounding. The quote rounds the exact payment multiplied by the term
to determine the total. It rounds the regular payment to cents and derives
the final payment as the remainder. For tiny balances where half-up regular
payments would overpay the total before the final month, it uses the lower
cent for the regular payment. The final instalment stays nonnegative and
the payments always sum to the quoted total. Interest equals total minus
principal. Money is serialized with two decimal places. The principal and
all quoted monetary values fit `NUMERIC(14,2)`.

For R15,000 over 12 months, eleven payments of R1,294.45 plus a final
R1,294.41 produce R15,533.36, including R533.36 interest. At the low end,
a R0.18 quote over 36 months produces a R0.20 total collected in the
final payment. This is a quote-level rounding convention. A future payment
ledger may need a separate policy for rounding accrued interest each month
and settling the resulting balance.

The Nest provider token `REPAYMENT_CALCULATOR` binds a small strategy
interface to the pure `AmortisedRepaymentCalculator`. This keeps
the formula directly testable and lets a future policy replace the algorithm
without moving interest or term selection into the controller. The interface
and provider binding add one layer of indirection. To change the strategy,
implement `RepaymentCalculator`, provide its method identifier, update the
binding in `repayment.module.ts`, and validate the new strategy with independent
reference values and the storage bounds. Review the API compatibility and
update the examples if the policy changes an existing quote.

## Prisma, environment, and deployment

Prisma 7 generates TypeScript into an ignored directory beneath `src`. Its
CommonJS output is emitted with the rest of the Nest application. The
PostgreSQL adapter uses `pg` and one shared pool per Nest application.
`prisma.config.ts` loads CLI configuration from the repository-root
`.env` and supports client generation without a live database. Nest validates
the configured URL before it starts accepting requests. The URL and its
credentials are omitted from validation and readiness responses.

The API opens connections on demand, so it can report liveness during an
outage. Nest shutdown hooks close the Prisma pool. Pool connection acquisition
has a two-second timeout and driver queries have a three-second client timeout.
`GET /api/v1/health` performs no database query. The readiness route
`GET /api/v1/health/ready` executes one `SELECT 1` per probe and
returns HTTP 503 if it fails. Readiness verifies connectivity. The migration
job verifies migration application before the API starts in Compose.

Base Compose uses PostgreSQL 17, a named volume, and an internal database
network address. The optional local override publishes a loopback port for
host development. Compose shares one initialization role between the
migration job and the API for local use. A production deployment should give
its migration job and API separate credentials with appropriate privileges.
The runtime image installs production dependencies and omits optional
dependencies, including the Prisma CLI that npm can otherwise install as an
optional client peer.

## Verification and trade-offs

Unit and HTTP end-to-end tests contribute to the Jest coverage report. The
report excludes generated code and the process entry point. Real PostgreSQL
integration tests run on a uniquely named Compose network with an unpublished
database and temporary storage. The suite applies the migration to an empty
database and checks repository behavior, relational constraints, decimal
round-tripping, and readiness. The ordinary end-to-end suite verifies the
unavailable response with a loopback-only fixture connection. Jest enables
Node VM module support so Prisma can dynamically load its query compiler
inside the test runner.

The full npm audit reported 19 moderate development findings. For the Nest
CLI chain through `glob` and `minimatch`, npm proposed Nest CLI 12.0.15. For
the Jest runner and coverage chain through `babel-plugin-istanbul`,
`test-exclude`, `glob`, and `minimatch`, npm proposed Jest 29.7.0. Both
proposed versions cross a major-version boundary and require compatibility
review. The Prisma CLI's Effect advisory was resolved with a targeted override
to `effect` 3.22.5. Remove the override when Prisma depends on a patched
release and the full audit confirms it. The production dependency audit
reported zero findings.
