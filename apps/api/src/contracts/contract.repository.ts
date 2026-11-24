import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Contract } from '../generated/prisma/client';

export interface ContractSnapshot {
  userId: string;
  deviceAmount: string;
  interestRate: string;
  termMonths: number;
  monthlyRepayment: string;
  totalRepayment: string;
  totalInterest: string;
}

function toRecord(contract: Contract) {
  return {
    ...contract,
    deviceAmount: contract.deviceAmount.toFixed(2),
    interestRate: contract.interestRate.toFixed(6),
    monthlyRepayment: contract.monthlyRepayment.toFixed(2),
    totalRepayment: contract.totalRepayment.toFixed(2),
    totalInterest: contract.totalInterest.toFixed(2),
  };
}

@Injectable()
export class ContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(snapshot: ContractSnapshot) {
    return toRecord(
      await this.prisma.client.contract.create({ data: snapshot }),
    );
  }

  async findByUserId(userId: string) {
    const contracts = await this.prisma.client.contract.findMany({
      where: { userId },
    });
    return contracts.map(toRecord);
  }
}
