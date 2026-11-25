import { Inject, Injectable } from '@nestjs/common';
import {
  REPAYMENT_CALCULATOR,
  REPAYMENT_TERMS,
  type RepaymentCalculator,
  type RepaymentTerm,
} from './repayment-calculator';

const ANNUAL_RATE = '6.500000';

@Injectable()
export class RepaymentService {
  constructor(
    @Inject(REPAYMENT_CALCULATOR)
    private readonly calculator: RepaymentCalculator,
  ) {}

  calculate(amount: string) {
    const options = REPAYMENT_TERMS.map((term) =>
      this.calculator.calculate(amount, ANNUAL_RATE, term),
    );
    const [whole, fraction = ''] = amount.split('.');
    return {
      currency: 'ZAR',
      deviceAmount: `${whole}.${fraction.padEnd(2, '0')}`,
      annualInterestRate: ANNUAL_RATE,
      calculationMethod: this.calculator.method,
      options,
    };
  }

  snapshot(amount: string, term: RepaymentTerm) {
    const quote = this.calculate(amount);
    const selected = quote.options.find((option) => option.termMonths === term);
    if (!selected) {
      throw new RangeError('Unsupported repayment term');
    }
    return {
      ...selected,
      deviceAmount: quote.deviceAmount,
      interestRate: quote.annualInterestRate,
      calculationMethod: quote.calculationMethod,
      calculationVersion: this.calculator.version,
    };
  }
}
