import { Injectable } from '@nestjs/common';
import {
  REPAYMENT_TERMS,
  type RepaymentTerm,
} from '../repayment/repayment-calculator';
import { RepaymentService } from '../repayment/repayment.service';
import { ContractRepository } from './contract.repository';

export class InvalidContractUpdateError extends Error {}

@Injectable()
export class ContractsService {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly repayments: RepaymentService,
  ) {}

  create(userId: string, amount: string, term: RepaymentTerm) {
    return this.contracts.create(
      userId,
      this.repayments.snapshot(amount, term),
    );
  }

  async list(userId: string, page: number, pageSize: number) {
    const { items, total } = await this.contracts.list(userId, page, pageSize);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  find(userId: string, id: string) {
    return this.contracts.find(userId, id);
  }

  update(
    userId: string,
    id: string,
    changes: { deviceAmount?: string; termMonths?: RepaymentTerm },
  ) {
    if (
      changes.deviceAmount === undefined &&
      changes.termMonths === undefined
    ) {
      throw new InvalidContractUpdateError('Supply deviceAmount or termMonths');
    }
    return this.contracts.update(userId, id, (current) => {
      const term =
        changes.termMonths ??
        REPAYMENT_TERMS.find((supported) => supported === current.termMonths);
      if (term === undefined) {
        throw new InvalidContractUpdateError(
          'Supply a supported term to update this legacy contract',
        );
      }
      return this.repayments.snapshot(
        changes.deviceAmount ?? current.deviceAmount,
        term,
      );
    });
  }

  delete(userId: string, id: string) {
    return this.contracts.delete(userId, id);
  }
}
