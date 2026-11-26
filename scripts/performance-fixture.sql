INSERT INTO "User" ("email", "passwordHash")
SELECT 'fixture-' || n || '@example.test', 'disabled fixture'
FROM generate_series(1, 20) AS n;

INSERT INTO "Contract" (
  "userId", "deviceAmount", "interestRate", "termMonths", "monthlyRepayment",
  "finalRepayment", "totalRepayment", "totalInterest", "calculationMethod",
  "calculationVersion", "createdAt"
)
SELECT u.id, 15000, 6.500000, 12, 1294.45, 1294.41, 15533.36, 533.36,
       'reducing-balance-amortisation', 1, now() - n * interval '1 second'
FROM "User" u
CROSS JOIN LATERAL generate_series(1, CASE WHEN u.email = 'benchmark@example.test' THEN 2000 ELSE 1000 END) AS n;

ANALYZE "Contract";
SELECT id AS owner_id FROM "User" WHERE email = 'benchmark@example.test' \gset

BEGIN ISOLATION LEVEL REPEATABLE READ;
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT * FROM "Contract" WHERE "userId" = :'owner_id'::uuid
ORDER BY "createdAt" DESC, "id" DESC LIMIT 20 OFFSET 0;

EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT * FROM "Contract" WHERE "userId" = :'owner_id'::uuid
ORDER BY "createdAt" DESC, "id" DESC LIMIT 20 OFFSET 1980;

EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT count(*) FROM "Contract" WHERE "userId" = :'owner_id'::uuid;
COMMIT;
