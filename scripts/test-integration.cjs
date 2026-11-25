const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const withCoverage = process.argv.includes('--coverage');

const args = [
  'compose',
  '-f',
  'compose.test.yaml',
  '-p',
  `contract-repayment-test-${randomUUID()}`,
];

function compose(command) {
  const result = spawnSync('docker', [...args, ...command], {
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}

const run = ['run', '--build', '--rm'];
if (withCoverage) {
  const output = resolve('apps/api/coverage/combined');
  mkdirSync(output, { recursive: true });
  run.push('--volume', `${output}:/app/apps/api/coverage/combined`);
}
run.push('test');
if (withCoverage) {
  run.push(
    'sh',
    '-ec',
    'npm run db:migrate:deploy && npm run test:cov:all:run --workspace apps/api',
  );
}

try {
  process.exitCode = compose(run);
} finally {
  const cleanup = compose(['down', '--rmi', 'local']);
  process.exitCode ||= cleanup;
}
