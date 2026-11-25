import { rate, zar } from '@/lib/utils';

export function RepaymentValues({
  values,
  annualRate,
}: {
  values: {
    finalRepayment: string | null;
    totalInterest: string;
    totalRepayment: string;
  };
  annualRate?: string;
}) {
  return (
    <dl className="repayment-values">
      <div>
        <dt>Final instalment</dt>
        <dd>{zar(values.finalRepayment)}</dd>
      </div>
      <div>
        <dt>Total interest</dt>
        <dd>{zar(values.totalInterest)}</dd>
      </div>
      <div>
        <dt>Total repayment</dt>
        <dd>{zar(values.totalRepayment)}</dd>
      </div>
      {annualRate && (
        <div>
          <dt>Annual interest</dt>
          <dd>{rate(annualRate)}</dd>
        </div>
      )}
    </dl>
  );
}
