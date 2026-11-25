const base = require('./jest.config.cjs');
const integration = require('./jest.integration.config.cjs');

module.exports = {
  ...base,
  projects: [...base.projects, integration],
  coverageDirectory: '<rootDir>/coverage/combined',
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 90, lines: 90 },
  },
};
