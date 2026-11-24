# Contract Repayment API

Phase 1 provides a NestJS API foundation and a versioned liveness endpoint.
See [architecture decisions](docs/architecture.md) for the module and configuration design.

## Local setup

Use Node.js 24.21.0 and npm 11.19.0. Run these commands from the repository
root in Git Bash.

```bash
npm ci
cp .env.example .env
npm run dev
```

Copying `.env.example` is optional because the application has local defaults.
In PowerShell, use `Copy-Item .env.example .env`. If the execution policy blocks
`npm.ps1`, use `npm.cmd` in place of `npm`.

```bash
curl -i http://localhost:3000/api/v1/health
```

Expect HTTP 200 with the JSON body `{"status":"ok"}`.

## Configuration

| Variable   | Default       | Accepted values                                        |
| ---------- | ------------- | ------------------------------------------------------ |
| `NODE_ENV` | `development` | `development`, `test`, `production`                    |
| `PORT`     | `3000`        | A whole number from 1 through 65535, written as digits |

Process environment variables take precedence over the root `.env` file.
Invalid values prevent startup. Local `.env` files are ignored by Git.

## Verification and production build

| Command                | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run typecheck`    | Check application and test TypeScript                      |
| `npm run lint`         | Lint TypeScript with type information                      |
| `npm run format:check` | Check Prettier formatting                                  |
| `npm run format`       | Apply Prettier formatting                                  |
| `npm test`             | Run unit tests followed by end-to-end tests                |
| `npm run test:unit`    | Run unit tests                                             |
| `npm run test:e2e`     | Run Supertest against the Nest HTTP application            |
| `npm run test:cov`     | Run both suites and write coverage to `apps/api/coverage/` |
| `npm run build`        | Compile the API into `apps/api/dist/`                      |
| `npm start`            | Run the compiled API after a successful build              |

## Docker Compose

With Docker Desktop running, use `docker compose up --build` from the
repository root. Compose publishes the API on loopback and runs a liveness
check in the container. The root `.env` or shell `PORT` sets the published
host port. The container uses port 3000 and `NODE_ENV=production`.
Run `docker compose down` to stop and remove the Compose service.
