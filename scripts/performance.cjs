const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { availableParallelism, release } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');

function setting(name, fallback, maximum) {
  const value = Number(process.env[name] ?? fallback);
  assert(Number.isInteger(value) && value > 0 && value <= maximum, name);
  return value;
}

const port = setting('PERF_API_PORT', 35851, 65535);
const promPort = setting('PERF_PROMETHEUS_PORT', 35852, 65535);
const concurrency = setting('PERF_CONCURRENCY', 8, 100);
const requests = setting('PERF_REQUESTS', 2000, 100000);
const verifyAlert = process.argv.includes('--verify-alert');
const project = `repayment-perf-${randomUUID()}`;
const env = {
  ...process.env,
  PORT: String(port),
  PROMETHEUS_PORT: String(promPort),
  JWT_SECRET: randomBytes(32).toString('base64url'),
  POSTGRES_USER: 'contract_repayment',
  POSTGRES_PASSWORD: 'isolated-benchmark-only',
  POSTGRES_DB: 'contract_repayment',
  DATABASE_URL_DOCKER:
    'postgresql://contract_repayment:isolated-benchmark-only@db:5432/contract_repayment',
  SWAGGER_ENABLED: 'false',
  LOG_LEVEL: 'info',
};
const origin = `http://127.0.0.1:${port}`;
const prometheus = `http://127.0.0.1:${promPort}`;

function compose(args, options = {}) {
  const command = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      '.env.example',
      '-p',
      project,
      '-f',
      'compose.yaml',
      '-f',
      'compose.monitoring.yaml',
      ...args,
    ],
    { env, stdio: 'inherit', timeout: 600000, ...options },
  );
  if (command.error) throw command.error;
  assert.equal(command.status, 0, `Compose ${args[0]} failed`);
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${origin}/api/v1${path}`, {
    method,
    body: JSON.stringify(body),
    headers,
    signal: AbortSignal.timeout(10000),
  });
}

async function benchmark(name, run, count = requests) {
  const latencies = [];
  const errors = {};
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: Math.min(count, concurrency) }, async () => {
      while (next++ < count) {
        const requestStarted = performance.now();
        try {
          const response = await run();
          await response.arrayBuffer();
          if (response.status !== 200)
            errors[response.status] = (errors[response.status] ?? 0) + 1;
        } catch {
          errors.transport = (errors.transport ?? 0) + 1;
        }
        latencies.push(performance.now() - requestStarted);
      }
    }),
  );
  const elapsed = (performance.now() - started) / 1000;
  const errorCount = Object.values(errors).reduce(
    (sum, count) => sum + count,
    0,
  );
  latencies.sort((a, b) => a - b);
  const percentile = (q) => +latencies[Math.ceil(q * count) - 1].toFixed(2);
  console.log(
    JSON.stringify({
      name,
      count,
      concurrency,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      requestsPerSecond: +(count / elapsed).toFixed(2),
      errorPercent: +((100 * errorCount) / count).toFixed(2),
      errors,
    }),
  );
  return errorCount;
}

async function waitFor(read, accept, label) {
  const deadline = performance.now() + 120000;
  while (performance.now() < deadline) {
    try {
      const result = await read();
      if (accept(result)) {
        console.log(`Verified ${label}`);
        return;
      }
    } catch {
      // Prometheus may still be starting.
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function prom(path) {
  const response = await fetch(prometheus + path, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

async function main() {
  compose(['up', '--build', '-d', '--wait', '--wait-timeout', '120']);
  console.log(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      os: release(),
      logicalParallelism: availableParallelism(),
    }),
  );
  const readiness = await api('/health/ready');
  assert.equal(readiness.status, 200);
  assert.deepEqual(await readiness.json(), { status: 'ok' });
  const publicMetrics = await fetch(origin + '/metrics');
  assert.equal(publicMetrics.status, 404);
  await publicMetrics.arrayBuffer();

  compose([
    'exec',
    '-T',
    'prometheus',
    'promtool',
    'check',
    'config',
    '/etc/prometheus/config/prometheus.yml',
  ]);
  compose([
    'exec',
    '-T',
    'prometheus',
    'promtool',
    'check',
    'rules',
    '/etc/prometheus/config/alerts.yml',
  ]);
  await waitFor(
    () => prom('/api/v1/targets'),
    ({ activeTargets }) =>
      activeTargets.some((target) => target.health === 'up'),
    'Prometheus scraping the private API metrics target',
  );

  const credentials = {
    email: 'benchmark@example.test',
    password: randomBytes(28).toString('base64url'),
  };
  const register = await api('/auth/register', {
    method: 'POST',
    body: credentials,
  });
  assert.equal(register.status, 201);
  await register.arrayBuffer();
  const login = await api('/auth/login', { method: 'POST', body: credentials });
  assert.equal(login.status, 200);
  const { accessToken: token } = await login.json();
  assert(typeof token === 'string' && token.length > 0);

  compose(
    [
      'exec',
      '-T',
      'db',
      'psql',
      '-X',
      '-U',
      env.POSTGRES_USER,
      '-d',
      env.POSTGRES_DB,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: readFileSync('scripts/performance-fixture.sql'),
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
  const calculate = () =>
    api('/contracts/calculate', {
      method: 'POST',
      token,
      body: { deviceAmount: '15000.00' },
    });
  const list = () => api('/contracts?page=1&pageSize=20', { token });
  const listing = await list();
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).items.length, 20);
  let errors = 0;
  for (const [name, run] of [
    ['repayment calculation', calculate],
    ['authenticated contract listing', list],
  ]) {
    errors += await benchmark(`${name} warm-up`, run, 100);
    errors += await benchmark(name, run);
  }
  assert.equal(errors, 0, 'Benchmark observed request failures');
  const query = new URLSearchParams({
    query:
      'http_requests_total{job="contract-repayment-api",route="/api/v1/contracts",status_code="200"}',
  });
  await waitFor(
    () => prom('/api/v1/query?' + query),
    ({ result }) =>
      result.some((series) => Number(series.value[1]) === requests + 101),
    'Prometheus ingesting the expected authenticated listing request count',
  );

  if (verifyAlert) {
    compose(['stop', 'api']);
    const alerts = () => prom('/api/v1/alerts');
    for (const state of ['pending', 'firing']) {
      await waitFor(
        alerts,
        ({ alerts }) =>
          alerts.some(
            (alert) =>
              alert.labels.alertname ===
                'ContractRepaymentApiTargetUnavailable' &&
              alert.state === state,
          ),
        `ContractRepaymentApiTargetUnavailable ${state}`,
      );
    }
  }
}

main()
  .finally(() => {
    // This randomly named project owns only the disposable benchmark data.
    compose(['down', '--volumes', '--remove-orphans']);
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
