require('./setup-auth.cjs');

const isolatedUrl =
  'postgresql://phase2_test:phase2_test@db-test:5432/contract_repayment_test';

if (process.env.DATABASE_URL !== isolatedUrl) {
  throw new Error(
    'Run integration tests through npm run test:integration at the repository root',
  );
}
