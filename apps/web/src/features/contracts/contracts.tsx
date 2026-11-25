import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { z } from 'zod';
import { type Contract, type Option, terms } from '@/api/client';
import { useSession } from '@/auth/session';
import { ErrorNotice, Loading } from '@/components/feedback';
import { Button, buttonVariants } from '@/components/ui/button';
import { RepaymentValues } from '@/features/repayment/repayment-values';
import { amountSchema, formatDate, zar } from '@/lib/utils';

export function ContractsPage() {
  const { api } = useSession();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const candidate = params.get('page') ?? '1';
  const page = /^(?:[1-9]\d{0,5}|1000000)$/.test(candidate)
    ? Number(candidate)
    : 1;
  const list = useQuery({
    queryKey: ['contracts', 'page', page],
    queryFn: ({ signal }) => api.list(page, signal),
  });
  const data = list.data;
  const changePage = (next: number) =>
    setParams(next === 1 ? {} : { page: String(next) });

  return (
    <div className="page">
      <div className="breadcrumb">
        <FileText size={15} aria-hidden="true" /> Device Finance{' '}
        <ChevronRight size={14} aria-hidden="true" /> <span>My Contracts</span>
      </div>
      <header className="page-heading heading-action">
        <div>
          <h1>My Contracts</h1>
          <p>View, update or delete your saved repayment contracts.</p>
        </div>
        <Link to="/" className={buttonVariants()}>
          <Plus size={18} aria-hidden="true" /> New calculation
        </Link>
      </header>
      {location.state === 'deleted' && (
        <p className="notice notice-success" role="status">
          <Check size={18} aria-hidden="true" />
          Contract deleted.
        </p>
      )}
      {list.isPending && <Loading>Loading contracts…</Loading>}
      {list.isError && (
        <div className="stack">
          <ErrorNotice error={list.error} />
          <Button variant="outline" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {data && !list.isError && (
        <>
          {data.items.length === 0 ? (
            <div className="empty">
              <span className="section-icon">
                <FileText size={22} aria-hidden="true" />
              </span>
              <h2>
                {data.pagination.total
                  ? 'No contracts on this page'
                  : 'No saved contracts yet'}
              </h2>
              <p>
                {data.pagination.total
                  ? 'Return to the first page to view your saved contracts.'
                  : 'Calculate a repayment and save a term to create your first contract.'}
              </p>
              {data.pagination.total > 0 ? (
                <Button variant="outline" onClick={() => changePage(1)}>
                  First page
                </Button>
              ) : (
                <Link to="/" className={buttonVariants({ variant: 'outline' })}>
                  Open calculator <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : (
            <ul className="contract-list" aria-label="Saved contracts">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link to={`/contracts/${item.id}`}>
                    <span className="section-icon">
                      <FileText size={20} aria-hidden="true" />
                    </span>
                    <span className="contract-name">
                      <strong>{zar(item.deviceAmount)} device</strong>
                      <small>
                        {item.termMonths} months · {formatDate(item.createdAt)}
                      </small>
                    </span>
                    <span className="contract-price">
                      <strong>{zar(item.monthlyRepayment)}</strong>
                      <small>per month</small>
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.pagination.totalPages > 1 && (
            <nav className="pagination" aria-label="Contract pages">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Button>
              <span>
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={
                  page >= Math.min(data.pagination.totalPages, 1_000_000)
                }
                onClick={() => changePage(page + 1)}
              >
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export function ContractDetail() {
  const { id = '' } = useParams();
  const session = useSession();
  const detail = useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: ({ signal }) => session.api.get(id, signal),
  });
  return (
    <div className="page">
      <Link className="back-link" to="/contracts">
        <ArrowLeft size={17} aria-hidden="true" /> Back to contracts
      </Link>
      {detail.isPending && <Loading>Loading contract…</Loading>}
      {detail.isError && (
        <div className="stack">
          <ErrorNotice error={detail.error} />
          <Button variant="outline" onClick={() => void detail.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {detail.data && !detail.isError && (
        <ContractSnapshot key={id} contract={detail.data} />
      )}
    </div>
  );
}

function ContractSnapshot({ contract }: { contract: Contract }) {
  const session = useSession();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => session.api.delete(contract.id),
    onSuccess: () => {
      void navigate('/contracts', { replace: true, state: 'deleted' });
      session.queryClient.removeQueries({
        queryKey: ['contracts', 'detail', contract.id],
      });
      void session.queryClient.invalidateQueries({
        queryKey: ['contracts', 'page'],
      });
    },
  });

  return (
    <>
      <header className="page-heading heading-action">
        <div>
          <h1>Contract details</h1>
          <p>
            Saved {formatDate(contract.createdAt)} · {contract.termMonths}{' '}
            months
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setUpdated(false);
            setEditing(!editing);
          }}
        >
          <Pencil size={17} aria-hidden="true" />
          {editing ? 'Close editor' : 'Edit contract'}
        </Button>
      </header>
      {updated && (
        <p role="status" className="notice notice-success">
          <Check size={18} aria-hidden="true" /> Contract updated.
        </p>
      )}
      <section className="snapshot" aria-label="Saved repayment">
        <div className="snapshot-price">
          <span>Device purchase amount</span>
          <strong>{zar(contract.deviceAmount)}</strong>
          <span>Regular monthly instalment</span>
          <strong>{zar(contract.monthlyRepayment)}</strong>
        </div>
        <div>
          <RepaymentValues
            values={contract}
            annualRate={contract.interestRate}
          />
          {contract.calculationVersion !== null && (
            <p className="field-help">
              Calculation version {contract.calculationVersion}
            </p>
          )}
        </div>
      </section>
      {editing && (
        <ContractEditor
          contract={contract}
          onSaved={() => {
            setEditing(false);
            setUpdated(true);
          }}
        />
      )}
      <AlertDialog.Root
        open={confirming}
        onOpenChange={(open) => {
          if (remove.isPending) return;
          if (open) remove.reset();
          setConfirming(open);
        }}
      >
        <AlertDialog.Trigger asChild>
          <Button className="delete-trigger" variant="destructive">
            <Trash2 size={17} aria-hidden="true" /> Delete contract
          </Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog-content">
            <AlertDialog.Title>Delete this contract?</AlertDialog.Title>
            <AlertDialog.Description>
              This permanently removes the saved contract from My Contracts.
            </AlertDialog.Description>
            {remove.isError && <ErrorNotice error={remove.error} />}
            <div className="dialog-actions">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" disabled={remove.isPending}>
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    remove.mutate();
                  }}
                >
                  {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

const termSchema = z.enum(['12', '24', '36'], {
  error: 'Choose a supported repayment term.',
});
const updateSchema = z.object({
  deviceAmount: amountSchema,
  term: z.string().pipe(termSchema),
});

function ContractEditor({
  contract,
  onSaved,
}: {
  contract: Contract;
  onSaved: () => void;
}) {
  const session = useSession();
  const initialTerm = terms.some((term) => term === contract.termMonths)
    ? String(contract.termMonths)
    : '';
  const form = useForm({
    resolver: zodResolver(updateSchema),
    defaultValues: { deviceAmount: contract.deviceAmount, term: initialTerm },
  });
  const [preview, setPreview] = useState<{
    option: Option;
    annualRate: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const update = useMutation({
    mutationFn: (body: {
      deviceAmount: string;
      termMonths: (typeof terms)[number];
    }) => session.api.update(contract.id, body),
    onSuccess: (data) => {
      session.queryClient.setQueryData(
        ['contracts', 'detail', contract.id],
        data,
      );
      void session.queryClient.invalidateQueries({
        queryKey: ['contracts', 'page'],
      });
      onSaved();
    },
  });

  function invalidatePreview() {
    pending.current?.abort();
    setPreview(null);
    setPreviewError(null);
    setReading(false);
    update.reset();
  }

  const submit = form.handleSubmit(({ deviceAmount, term }) => {
    const termMonths = terms.find((value) => String(value) === term);
    if (
      termMonths &&
      (deviceAmount !== contract.deviceAmount ||
        termMonths !== contract.termMonths)
    )
      update.mutate({ deviceAmount, termMonths });
  });
  const calculate = form.handleSubmit(async ({ deviceAmount, term }) => {
    invalidatePreview();
    const controller = new AbortController();
    pending.current = controller;
    setReading(true);
    try {
      const result = await session.api.calculate(
        deviceAmount,
        controller.signal,
      );
      const option = result.options.find(
        (value) => String(value.termMonths) === term,
      );
      if (!controller.signal.aborted && option)
        setPreview({ option, annualRate: result.annualInterestRate });
    } catch (error) {
      if (!controller.signal.aborted) setPreviewError(error);
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  });
  const { errors, isDirty } = form.formState;
  return (
    <section className="editor" aria-labelledby="edit-heading">
      <h2 id="edit-heading">Edit repayment</h2>
      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div>
          <label htmlFor="edit-amount">Device purchase amount (ZAR)</label>
          <input
            id="edit-amount"
            inputMode="decimal"
            disabled={update.isPending}
            aria-invalid={!!errors.deviceAmount}
            aria-describedby={
              errors.deviceAmount ? 'edit-amount-error' : undefined
            }
            {...form.register('deviceAmount', { onChange: invalidatePreview })}
          />
          {errors.deviceAmount && (
            <p className="field-error" id="edit-amount-error" role="alert">
              {errors.deviceAmount.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="edit-term">Repayment term</label>
          <select
            id="edit-term"
            disabled={update.isPending}
            aria-invalid={!!errors.term}
            aria-describedby={errors.term ? 'edit-term-error' : undefined}
            {...form.register('term', { onChange: invalidatePreview })}
          >
            <option value="">Choose a term</option>
            {terms.map((term) => (
              <option key={term} value={term}>
                {term} months
              </option>
            ))}
          </select>
          {errors.term && (
            <p className="field-error" id="edit-term-error" role="alert">
              {errors.term.message}
            </p>
          )}
        </div>
        <div className="editor-actions">
          <Button
            variant="outline"
            disabled={reading || update.isPending}
            onClick={() => void calculate()}
          >
            Preview repayment
          </Button>
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
      {reading && <Loading>Calculating preview…</Loading>}
      {previewError != null && <ErrorNotice error={previewError} />}
      {update.isError && <ErrorNotice error={update.error} />}
      {preview && (
        <div className="edit-preview" role="status">
          <h3>{zar(preview.option.monthlyRepayment)} per month</h3>
          <RepaymentValues
            values={preview.option}
            annualRate={preview.annualRate}
          />
        </div>
      )}
    </section>
  );
}
