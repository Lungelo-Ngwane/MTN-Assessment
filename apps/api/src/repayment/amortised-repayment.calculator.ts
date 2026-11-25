import Decimal from 'decimal.js';
import {
  DEVICE_AMOUNT_FORMAT,
  InvalidRepaymentAmountError,
  type RepaymentCalculator,
  type RepaymentOption,
} from './repayment-calculator';

const Exact = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
const MAX_MONEY = '999999999999.99';
const RATE_FORMAT = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/;
const MAX_TERM = 2_147_483_647;

export class AmortisedRepaymentCalculator implements RepaymentCalculator {
  readonly method = 'reducing-balance-amortisation';
  readonly version = 1;

  calculate(
    amount: string,
    annualRate: string,
    termMonths: number,
  ): RepaymentOption {
    if (!DEVICE_AMOUNT_FORMAT.test(amount) || !new Exact(amount).gt(0)) {
      throw new InvalidRepaymentAmountError(
        'Device amount must be a positive monetary amount',
      );
    }
    if (!RATE_FORMAT.test(annualRate)) {
      throw new RangeError(
        'Annual rate must be a nonnegative percentage fitting NUMERIC(9,6)',
      );
    }
    if (
      !Number.isInteger(termMonths) ||
      termMonths < 1 ||
      termMonths > MAX_TERM
    ) {
      throw new RangeError('Term must be a positive PostgreSQL INTEGER');
    }

    const principal = new Exact(amount);
    const rate = new Exact(annualRate).div(1200);
    let exactMonthly = principal.div(termMonths);
    if (!rate.isZero()) {
      const growth = rate.plus(1).pow(termMonths);
      exactMonthly = principal.times(rate).times(growth).div(growth.minus(1));
    }

    const total = exactMonthly.times(termMonths).toDecimalPlaces(2);
    if (total.gt(MAX_MONEY)) {
      throw new InvalidRepaymentAmountError(
        'Device amount produces a repayment total outside the supported range',
      );
    }

    let monthly = exactMonthly.toDecimalPlaces(2);
    let final = total.minus(monthly.times(termMonths - 1));
    if (final.lt(0)) {
      // On tiny balances, rounding every regular instalment up can overpay the quote.
      monthly = exactMonthly.toDecimalPlaces(2, Decimal.ROUND_DOWN);
      final = total.minus(monthly.times(termMonths - 1));
    }

    return {
      termMonths,
      monthlyRepayment: monthly.toFixed(2),
      finalRepayment: final.toFixed(2),
      totalRepayment: total.toFixed(2),
      totalInterest: total.minus(principal).toFixed(2),
    };
  }
}
