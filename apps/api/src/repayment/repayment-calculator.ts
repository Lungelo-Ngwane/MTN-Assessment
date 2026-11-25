export const REPAYMENT_CALCULATOR = Symbol('repaymentCalculator');
export const REPAYMENT_TERMS = [12, 24, 36] as const;
export type RepaymentTerm = (typeof REPAYMENT_TERMS)[number];
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
  readonly version: number;
  calculate(
    principal: string,
    annualRate: string,
    termMonths: number,
  ): RepaymentOption;
}

export class InvalidRepaymentAmountError extends RangeError {}
