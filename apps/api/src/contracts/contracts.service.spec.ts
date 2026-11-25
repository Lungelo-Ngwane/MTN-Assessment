import { Test } from '@nestjs/testing';
import { AmortisedRepaymentCalculator } from '../repayment/amortised-repayment.calculator';
import { RepaymentService } from '../repayment/repayment.service';
import {
  ContractRepository,
  type ContractRecord,
  type ContractSnapshot,
} from './contract.repository';
import {
  ContractsService,
  InvalidContractUpdateError,
} from './contracts.service';

const current: ContractRecord = {
  id: 'contract',
  userId: 'owner',
  deviceAmount: '15000.00',
  termMonths: 12,
  calculationMethod: null,
  calculationVersion: null,
  finalRepayment: null,
  interestRate: '6.500000',
  monthlyRepayment: '1294.45',
  totalRepayment: '15533.36',
  totalInterest: '533.36',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe('ContractsService', () => {
  let service: ContractsService;
  const create = jest.fn<Promise<ContractRecord>, [string, ContractSnapshot]>();
  const update = jest.fn<
    Promise<ContractRecord | null>,
    [string, string, (record: ContractRecord) => ContractSnapshot]
  >();

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: ContractRepository, useValue: { create, update } },
        {
          provide: RepaymentService,
          useValue: new RepaymentService(new AmortisedRepaymentCalculator()),
        },
      ],
    }).compile();
    service = module.get(ContractsService);
  });

  it('sends a selected versioned snapshot and a separately supplied owner to persistence', async () => {
    create.mockResolvedValue(current);
    await service.create('owner', '15000', 36);
    expect(create).toHaveBeenCalledWith('owner', {
      deviceAmount: '15000.00',
      termMonths: 36,
      interestRate: '6.500000',
      monthlyRepayment: '459.74',
      finalRepayment: '459.56',
      totalRepayment: '16550.46',
      totalInterest: '1550.46',
      calculationMethod: 'reducing-balance-amortisation',
      calculationVersion: 1,
    });
  });

  it('merges the patch with the locked row and refreshes the snapshot', async () => {
    update.mockImplementation((_userId, _id, derive) =>
      Promise.resolve().then(() => ({
        ...current,
        ...derive({ ...current, deviceAmount: '7999.99' }),
      })),
    );
    await expect(
      service.update('owner', 'contract', { termMonths: 24 }),
    ).resolves.toMatchObject({
      deviceAmount: '7999.99',
      termMonths: 24,
      totalRepayment: '8552.87',
      calculationVersion: 1,
    });
  });

  it('rejects empty updates without accessing persistence', () => {
    expect(() => service.update('owner', 'contract', {})).toThrow(
      InvalidContractUpdateError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('requires a replacement term for legacy contracts with an unsupported term', async () => {
    update.mockImplementation((_userId, _id, derive) =>
      Promise.resolve().then(() => ({
        ...current,
        ...derive({ ...current, termMonths: 3 }),
      })),
    );
    await expect(
      service.update('owner', 'contract', { deviceAmount: '10' }),
    ).rejects.toThrow(InvalidContractUpdateError);
    await expect(
      service.update('owner', 'contract', { termMonths: 12 }),
    ).resolves.toMatchObject({
      termMonths: 12,
      finalRepayment: '1294.41',
      calculationVersion: 1,
    });
  });
});
