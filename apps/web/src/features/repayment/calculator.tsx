import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Info,
  Plus,
  Smartphone,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Quote, Term } from '@/api/client';
import { useSession } from '@/auth/session';
import { ErrorNotice, Loading } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { amountSchema, zar } from '@/lib/utils';
import { RepaymentValues } from './repayment-values';

const quoteForm = z.object({ amount: amountSchema });

export function CalculatorPage() {
  const session = useSession();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(quoteForm),
    defaultValues: { amount: '' },
  });
  const [quoted, setQuoted] = useState<{ input: string; quote: Quote } | null>(
    null,
  );
  const [term, setTerm] = useState<Term | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pending = useRef<AbortController | null>(null);
  const save = useMutation({
    mutationFn: session.api.create,
    onSuccess: () => {
      void session.queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
  useEffect(() => () => pending.current?.abort(), []);

  function clearQuote() {
    pending.current?.abort();
    setReading(false);
    setQuoted(null);
    setTerm(null);
    setError(null);
    save.reset();
  }

  const calculate = form.handleSubmit(async ({ amount }) => {
    clearQuote();
    const controller = new AbortController();
    pending.current = controller;
    setReading(true);
    try {
      const result = await session.api.calculate(amount, controller.signal);
      if (!controller.signal.aborted)
        setQuoted({ input: amount, quote: result });
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue);
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  });

  const amount = form.register('amount', { onChange: clearQuote });
  const invalid = form.formState.errors.amount;
  const quote = quoted?.quote;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Smartphone size={15} aria-hidden="true" /> Device Finance{' '}
        <ChevronRight size={14} aria-hidden="true" /> <span>Calculator</span>
      </div>
      <header className="page-heading">
        <h1>Repayment calculator</h1>
        <p>Compare repayment plans and save the option that works for you.</p>
      </header>
      <section className="quote-input-panel" aria-labelledby="device-heading">
        <div className="panel-kicker">
          <span className="section-icon">
            <Calculator size={21} aria-hidden="true" />
          </span>
          <div>
            <h2 id="device-heading">Device purchase amount</h2>
            <p>Enter the full price of the device in South African rand.</p>
          </div>
        </div>
        <form
          className="amount-form"
          noValidate
          onSubmit={(event) => void calculate(event)}
        >
          <div>
            <label htmlFor={id} className="sr-only">
              Device purchase amount
            </label>
            <div className="currency-field">
              <span aria-hidden="true">R</span>
              <input
                {...amount}
                id={id}
                inputMode="decimal"
                placeholder="15000.00"
                disabled={save.isPending}
                aria-invalid={!!invalid}
                aria-describedby={invalid ? `${id}-error` : undefined}
              />
            </div>
            {invalid && (
              <p id={`${id}-error`} className="field-error" role="alert">
                {invalid.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={reading || save.isPending}>
            {reading ? 'Calculating…' : 'Calculate repayments'}
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </form>
      </section>
      <section className="comparison" aria-labelledby="options-heading">
        <div className="section-heading">
          <div>
            <h2 id="options-heading">Repayment options</h2>
            <p>
              Choose a term to see what you’ll pay over the life of the
              contract.
            </p>
          </div>
        </div>
        {error != null && <ErrorNotice error={error} />}
        {reading && <Loading>Calculating repayment options…</Loading>}
        {!quote && !reading && error == null && (
          <div className="empty">
            <span className="section-icon">
              <Calculator size={22} aria-hidden="true" />
            </span>
            <h3>Your options will appear here</h3>
            <p>
              Enter a device amount and calculate repayments to compare 12, 24
              and 36 month terms.
            </p>
          </div>
        )}
        {quote && (
          <>
            <fieldset className="option-grid">
              <legend className="sr-only">Select a repayment term</legend>
              {quote.options.map((option) => (
                <article
                  className={
                    term === option.termMonths ? 'option selected' : 'option'
                  }
                  key={option.termMonths}
                >
                  <div className="option-top">
                    <label htmlFor={`${id}-term-${option.termMonths}`}>
                      {option.termMonths} months
                    </label>
                    <input
                      id={`${id}-term-${option.termMonths}`}
                      type="radio"
                      name="repayment-term"
                      checked={option.termMonths === term}
                      disabled={save.isPending}
                      onChange={() => {
                        setTerm(option.termMonths);
                        save.reset();
                      }}
                    />
                  </div>
                  <div className="option-money">
                    {zar(option.monthlyRepayment)}
                  </div>
                  <p className="option-caption">Regular monthly instalment</p>
                  <RepaymentValues
                    values={option}
                    annualRate={quote.annualInterestRate}
                  />
                </article>
              ))}
            </fieldset>
            <div className="save-bar">
              <p>
                {term
                  ? `${term}-month term selected`
                  : 'Select a repayment term to save a contract.'}
              </p>
              <Button
                disabled={!term || save.isPending || save.isSuccess}
                onClick={() => {
                  if (
                    term &&
                    form.getValues('amount').trim() === quoted?.input &&
                    !pending.current?.signal.aborted
                  )
                    save.mutate({
                      deviceAmount: quote.deviceAmount,
                      termMonths: term,
                    });
                }}
              >
                <Plus size={17} aria-hidden="true" />
                {save.isPending ? 'Saving…' : 'Save contract'}
              </Button>
            </div>
            {save.isError && <ErrorNotice error={save.error} />}
            {save.data && (
              <div className="notice notice-success" role="status">
                <Check size={19} aria-hidden="true" />
                <div>
                  Contract saved.{' '}
                  <Link to={`/contracts/${save.data.id}`}>View contract</Link>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <aside className="calculation-note">
        <Info size={18} aria-hidden="true" />
        <p>
          Interest is calculated on the outstanding balance each month. The
          final instalment may differ slightly so that the instalments add up to
          the total repayment.
        </p>
      </aside>
    </div>
  );
}
