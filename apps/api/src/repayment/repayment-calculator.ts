export const REPAYMENT_CALCULATOR = Symbol('repaymentCalculator');
export const DEVICE_AMOUNT_FORMAT = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export interface RepaymentOption {
  termMonths: number;
  monthlyRepayment: string;
  finalRepayment: string;
  totalRepayment: string;
  totalInterest: string;
}

export interface RepaymentCalculator {
  readonly method: string;
  calculate(
    principal: string,
    annualRate: string,
    termMonths: number,
  ): RepaymentOption;
}

export class InvalidRepaymentAmountError extends RangeError {}
