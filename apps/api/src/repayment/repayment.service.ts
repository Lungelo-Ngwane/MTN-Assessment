import { Inject, Injectable } from '@nestjs/common';
import {
  REPAYMENT_CALCULATOR,
  type RepaymentCalculator,
} from './repayment-calculator';

const TERMS = [12, 24, 36];
const ANNUAL_RATE = '6.500000';

@Injectable()
export class RepaymentService {
  constructor(
    @Inject(REPAYMENT_CALCULATOR)
    private readonly calculator: RepaymentCalculator,
  ) {}

  calculate(amount: string) {
    const options = TERMS.map((term) =>
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
}
