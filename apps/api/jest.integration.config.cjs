const { projects } = require('./jest.config.cjs');
const e2e = projects.find((project) => project.displayName === 'e2e');

module.exports = {
  ...e2e,
  displayName: 'integration',
  setupFiles: ['<rootDir>/test/setup-integration.cjs'],
  testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
};
