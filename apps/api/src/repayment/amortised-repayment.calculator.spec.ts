import { AmortisedRepaymentCalculator } from './amortised-repayment.calculator';
import { InvalidRepaymentAmountError } from './repayment-calculator';

const calculator = new AmortisedRepaymentCalculator();

function cents(amount: string): bigint {
  return BigInt(amount.replace('.', ''));
}

describe('AmortisedRepaymentCalculator', () => {
  // Reference figures from exact integer fractions using the monthly rate 13/2400.
  it.each([
    ['15000.00', 12, '1294.45', '1294.41', '15533.36', '533.36'],
    ['15000.00', 24, '668.19', '668.28', '16036.65', '1036.65'],
    ['15000.00', 36, '459.74', '459.56', '16550.46', '1550.46'],
    ['7999.99', 24, '356.37', '356.36', '8552.87', '552.88'],
    ['0.01', 12, '0.00', '0.01', '0.01', '0.00'],
    ['0.18', 36, '0.00', '0.20', '0.20', '0.02'],
    [
      '900000000000.00',
      36,
      '27584102588.86',
      '27584102588.82',
      '993027693198.92',
      '93027693198.92',
    ],
    [
      '906319135069.39',
      36,
      '27777777777.78',
      '27777777777.69',
      '999999999999.99',
      '93680864930.60',
    ],
  ])(
    'calculates and reconciles %s over %i months',
    (amount, term, regular, final, total, interest) => {
      const expected = {
        termMonths: term,
        monthlyRepayment: regular,
        finalRepayment: final,
        totalRepayment: total,
        totalInterest: interest,
      };
      const result = calculator.calculate(amount, '6.5', term);
      expect(result).toEqual(expected);
      expect(calculator.calculate(amount, '6.5', term)).toEqual(result);
      expect(
        cents(result.monthlyRepayment) * BigInt(term - 1) +
          cents(result.finalRepayment),
      ).toBe(cents(result.totalRepayment));
      expect(cents(result.totalRepayment) - cents(amount)).toBe(
        cents(result.totalInterest),
      );
    },
  );

  it.each([
    ['100.01', '50.01', '50.00'],
    ['100.00', '50.00', '50.00'],
  ])(
    'splits %s at zero interest and rounds exact half-cent ties up',
    (amount, regular, final) => {
      expect(calculator.calculate(amount, '0', 2)).toEqual({
        termMonths: 2,
        monthlyRepayment: regular,
        finalRepayment: final,
        totalRepayment: amount,
        totalInterest: '0.00',
      });
    },
  );

  it('rounds just below a half-cent boundary down', () => {
    expect(calculator.calculate('150.01', '0', 3)).toMatchObject({
      monthlyRepayment: '50.00',
      finalRepayment: '50.01',
      totalInterest: '0.00',
    });
  });

  it.each(['0.00', '-10.00', '906319135069.40', '1000000000000.00'])(
    'rejects an invalid or unpersistable amount %s for 36 months',
    (amount) =>
      expect(() => calculator.calculate(amount, '6.5', 36)).toThrow(
        InvalidRepaymentAmountError,
      ),
  );

  it.each(['-1', 'NaN', 'Infinity', '1e1', '6.5000001', '1000'])(
    'rejects rate %s',
    (rate) => {
      expect(() => calculator.calculate('100.00', rate, 12)).toThrow(
        RangeError,
      );
    },
  );

  it.each([0, -1, 1.5, 2_147_483_648, NaN, Infinity])(
    'rejects term %s',
    (term) => {
      expect(() => calculator.calculate('100.00', '6.5', term)).toThrow(
        RangeError,
      );
    },
  );
});
