import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, type Contract } from '../generated/prisma/client';

export interface ContractSnapshot {
  deviceAmount: string;
  interestRate: string;
  termMonths: number;
  monthlyRepayment: string;
  finalRepayment: string;
  totalRepayment: string;
  totalInterest: string;
  calculationMethod: string;
  calculationVersion: number;
}

export interface ContractRecord extends Omit<
  ContractSnapshot,
  'finalRepayment' | 'calculationMethod' | 'calculationVersion'
> {
  id: string;
  userId: string;
  finalRepayment: string | null;
  calculationMethod: string | null;
  calculationVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ContractOwnerUnavailableError extends Error {}

function toRecord(contract: Contract): ContractRecord {
  return {
    id: contract.id,
    userId: contract.userId,
    termMonths: contract.termMonths,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    calculationMethod: contract.calculationMethod,
    calculationVersion: contract.calculationVersion,
    deviceAmount: contract.deviceAmount.toFixed(2),
    interestRate: contract.interestRate.toFixed(6),
    monthlyRepayment: contract.monthlyRepayment.toFixed(2),
    finalRepayment: contract.finalRepayment?.toFixed(2) ?? null,
    totalRepayment: contract.totalRepayment.toFixed(2),
    totalInterest: contract.totalInterest.toFixed(2),
  };
}

@Injectable()
export class ContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    snapshot: ContractSnapshot,
  ): Promise<ContractRecord> {
    try {
      return toRecord(
        await this.prisma.client.contract.create({
          data: { ...snapshot, userId },
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ContractOwnerUnavailableError();
      }
      throw error;
    }
  }

  async list(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [rows, total] = await this.prisma.client.$transaction(
      [
        this.prisma.client.contract.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.client.contract.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items: rows.map(toRecord), total };
  }

  async find(userId: string, id: string): Promise<ContractRecord | null> {
    const row = await this.prisma.client.contract.findUnique({
      where: { id, userId },
    });
    return row ? toRecord(row) : null;
  }

  update(
    userId: string,
    id: string,
    deriveSnapshot: (current: ContractRecord) => ContractSnapshot,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<Contract[]>`
        SELECT * FROM "Contract"
        WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid
        FOR UPDATE
      `;
        if (!row) return null;
        return toRecord(
          await tx.contract.update({
            where: { id, userId },
            data: deriveSnapshot(toRecord(row)),
          }),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const { count } = await this.prisma.client.contract.deleteMany({
      where: { id, userId },
    });
    return count === 1;
  }
}
