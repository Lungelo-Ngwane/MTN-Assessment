BEGIN;

ALTER TABLE "Contract"
    ADD COLUMN "finalRepayment" DECIMAL(14,2),
    ADD COLUMN "calculationMethod" TEXT,
    ADD COLUMN "calculationVersion" INTEGER;

-- Preserve legacy rows. PostgreSQL enforces these checks on every new or updated row.
ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_snapshot_inputs" CHECK (
        "termMonths" IN (12, 24, 36) AND "deviceAmount" > 0
        AND "calculationMethod" IS NOT NULL AND length(btrim("calculationMethod")) > 0
        AND "calculationVersion" IS NOT NULL AND "calculationVersion" > 0
    ) NOT VALID,
    ADD CONSTRAINT "Contract_snapshot_reconciles" CHECK (
        "finalRepayment" IS NOT NULL AND "finalRepayment" >= 0
        AND "finalRepayment" < 'Infinity'::numeric
        AND "deviceAmount" + "totalInterest" = "totalRepayment"
        AND ("termMonths" - 1)::numeric * "monthlyRepayment" + "finalRepayment" = "totalRepayment"
    ) NOT VALID;

CREATE INDEX "Contract_userId_createdAt_id_idx"
    ON "Contract"("userId", "createdAt" DESC, "id" DESC);
DROP INDEX "Contract_userId_idx";

COMMIT;
