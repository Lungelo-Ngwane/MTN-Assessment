BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "deviceAmount" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(9,6) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "monthlyRepayment" DECIMAL(14,2) NOT NULL,
    "totalRepayment" DECIMAL(14,2) NOT NULL,
    "totalInterest" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Retain storage invariants without defining the repayment calculation.
ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_positive_term" CHECK ("termMonths" > 0),
    ADD CONSTRAINT "Contract_nonnegative_snapshot" CHECK (
        "deviceAmount" >= 0 AND "deviceAmount" < 'Infinity'::numeric
        AND "interestRate" >= 0 AND "interestRate" < 'Infinity'::numeric
        AND "monthlyRepayment" >= 0 AND "monthlyRepayment" < 'Infinity'::numeric
        AND "totalRepayment" >= 0 AND "totalRepayment" < 'Infinity'::numeric
        AND "totalInterest" >= 0 AND "totalInterest" < 'Infinity'::numeric
    );

COMMIT;
