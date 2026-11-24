const shared = {
  rootDir: __dirname,
  testEnvironment: 'node',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: `${__dirname}/tsconfig.json` }],
  },
};

module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/generated/**',
    '!src/main.ts',
  ],
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...shared,
      displayName: 'e2e',
      setupFiles: ['<rootDir>/test/setup-e2e.cjs'],
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
    },
  ],
};
