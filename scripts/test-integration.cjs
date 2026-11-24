const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

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

const tests = compose(['run', '--build', '--rm', 'test']);
const cleanup = compose(['down', '--rmi', 'local']);
process.exitCode = tests || cleanup;
