const { spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { resolve } = require('node:path');

const project = `repayment-browser-${randomUUID()}`;
const webPort = process.env.BROWSER_WEB_PORT || '36850';
const apiPort = process.env.BROWSER_API_PORT || '36851';
for (const port of [webPort, apiPort]) {
  if (!/^[1-9]\d{0,4}$/.test(port) || +port > 65535)
    throw new Error('Invalid browser test port');
}
if (webPort === apiPort) throw new Error('Browser test ports must differ');
const env = {
  ...process.env,
  WEB_PORT: webPort,
  PORT: apiPort,
  BROWSER_TEST_URL: `http://127.0.0.1:${webPort}`,
  POSTGRES_USER: 'contract_repayment',
  POSTGRES_PASSWORD: 'disposable-browser-fixture',
  POSTGRES_DB: 'contract_repayment',
  DATABASE_URL_DOCKER:
    'postgresql://contract_repayment:disposable-browser-fixture@db:5432/contract_repayment',
  JWT_SECRET: randomBytes(32).toString('base64url'),
  SWAGGER_ENABLED: 'false',
  METRICS_ENABLED: 'false',
};
const args = [
  'compose',
  '--env-file',
  '.env.example',
  '-p',
  project,
  '-f',
  'compose.yaml',
  '-f',
  'compose.web.yaml',
];

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 600_000,
  });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}

const workspace = resolve('apps/web');
const playwright = require.resolve('@playwright/test/cli', {
  paths: [workspace],
});
try {
  process.exitCode = run('docker', [
    ...args,
    'up',
    '--build',
    '-d',
    '--wait',
    '--wait-timeout',
    '120',
  ]);
  if (!process.exitCode)
    process.exitCode = run(
      process.execPath,
      [playwright, 'test', ...process.argv.slice(2)],
      workspace,
    );
} finally {
  const cleanup = run('docker', [
    ...args,
    'down',
    '--volumes',
    '--rmi',
    'local',
  ]);
  process.exitCode ||= cleanup;
}
