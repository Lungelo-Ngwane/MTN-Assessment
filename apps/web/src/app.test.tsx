import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import type { Contract, Quote } from './api/client';
import { AuthProvider, useAuth } from './auth/session';

const userEmail = 'fixture@example.test';
const password = 'Sufficient fixture password';
const id = 'e62810e2-9bd3-4d62-acec-21ef3839c783';
const requestId = '6fbfad04-606e-4d29-9640-2a873467df51';
const quote: Quote = {
  currency: 'ZAR',
  deviceAmount: '15000.00',
  annualInterestRate: '6.500000',
  calculationMethod: 'reducing-balance-amortisation',
  options: [
    {
      termMonths: 12,
      monthlyRepayment: '1294.45',
      finalRepayment: '1294.41',
      totalInterest: '533.36',
      totalRepayment: '15533.36',
    },
    {
      termMonths: 24,
      monthlyRepayment: '668.19',
      finalRepayment: '668.28',
      totalInterest: '1036.65',
      totalRepayment: '16036.65',
    },
    {
      termMonths: 36,
      monthlyRepayment: '459.74',
      finalRepayment: '459.56',
      totalInterest: '1550.46',
      totalRepayment: '16550.46',
    },
  ],
};
const contract: Contract = {
  ...quote.options[0],
  id,
  userId: id,
  deviceAmount: '15000.00',
  interestRate: '6.500000',
  calculationMethod: quote.calculationMethod,
  calculationVersion: 1,
  createdAt: '2026-01-01T12:00:00Z',
  updatedAt: '2026-01-01T12:00:00Z',
};
const list = (items: Contract[]) => ({
  items,
  pagination: {
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
  },
});
const errorResponse = (
  statusCode: number,
  code: string,
  headers?: Record<string, string>,
) =>
  Response.json(
    {
      statusCode,
      code,
      message: 'Untrusted API text',
      requestId,
      timestamp: '2026-01-01T12:00:00Z',
    },
    { status: statusCode, headers },
  );
const loginResponse = (accessToken = 'fixture-token') =>
  Response.json({ accessToken, tokenType: 'Bearer', expiresIn: 900 });

type Handler = (
  url: string,
  options?: RequestInit,
) => Response | Promise<Response>;
function start(
  path = '/',
  handler: Handler = () => errorResponse(500, 'INTERNAL_ERROR'),
) {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) =>
    handler(url, options),
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return { fetcher, user: userEvent.setup() };
}

async function signIn(
  user: ReturnType<typeof userEvent.setup>,
  email = userEmail,
) {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password', { exact: true }), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Repayment calculator' });
}

async function requestQuote(user: ReturnType<typeof userEvent.setup>) {
  const amount = screen.getByRole('textbox', {
    name: 'Device purchase amount',
  });
  await user.type(amount, '15000.00');
  await user.click(
    screen.getByRole('button', { name: 'Calculate repayments' }),
  );
  return amount;
}

describe('account access', () => {
  it('expires the in-memory session when the server-issued lifetime elapses', () => {
    function SessionFixture() {
      const { expired, session, signIn } = useAuth();
      return (
        <button
          onClick={() =>
            signIn(
              { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 30 },
              userEmail,
            )
          }
        >
          {expired ? 'Expired' : session ? 'Signed in' : 'Start session'}
        </button>
      );
    }
    vi.useFakeTimers();
    try {
      render(
        <AuthProvider>
          <SessionFixture />
        </AuthProvider>,
      );
      act(() => screen.getByRole('button', { name: 'Start session' }).click());
      expect(screen.getByRole('button', { name: 'Signed in' })).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByRole('button', { name: 'Expired' })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('redirects protected routes and validates required login fields', async () => {
    const { fetcher, user } = start('/contracts');
    await screen.findByRole('heading', { name: 'Welcome back' });
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates registration and submits the normalised credentials', async () => {
    const { fetcher, user } = start('/register', () =>
      Response.json({ id }, { status: 201 }),
    );
    await user.type(
      screen.getByLabelText('Email address'),
      'Fixture@EXAMPLE.test',
    );
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'short',
    );
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Use at least 12 characters.'),
    ).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Password', { exact: true }));
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      password,
    );
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Account created. You can now sign in.'),
    ).toBeVisible();
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/auth/register');
    expect(fetcher.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ email: userEmail, password }),
    );
  });

  it('displays safe rate-limit feedback and a request ID instead of raw API text', async () => {
    const { user } = start('/login', () =>
      errorResponse(429, 'RATE_LIMITED', { 'Retry-After': '15' }),
    );
    await user.type(screen.getByLabelText('Email address'), userEmail);
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      password,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Try again in 15 seconds',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(requestId);
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'Untrusted API text',
    );
  });

  it('returns to login on a protected 401 without leaking saved data', async () => {
    const { user } = start('/login', (url) =>
      url.endsWith('/login')
        ? loginResponse()
        : errorResponse(401, 'UNAUTHORIZED'),
    );
    await signIn(user);
    await user.click(screen.getByRole('link', { name: 'My Contracts' }));
    expect(await screen.findByText(/Your session expired/)).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'My Contracts' }),
    ).not.toBeInTheDocument();
  });

  it('discards pending requests and cached contracts when the next user signs in', async () => {
    const old = Promise.withResolvers<Response>();
    let previousSignal: AbortSignal | null | undefined;
    const { user } = start('/login', (url, options) => {
      if (url.endsWith('/login'))
        return loginResponse(
          String(options?.body).includes(userEmail) ? 'first' : 'second',
        );
      if (
        new Headers(options?.headers).get('Authorization') === 'Bearer second'
      )
        return Response.json(list([]));
      if (url.includes('/contracts?')) return Response.json(list([contract]));
      previousSignal = options?.signal;
      return old.promise;
    });
    await signIn(user);
    await user.click(screen.getByRole('link', { name: 'My Contracts' }));
    await user.click(
      await screen.findByRole('link', { name: /R 15,000.00 device/ }),
    );
    expect(await screen.findByText('Loading contract…')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(previousSignal?.aborted).toBe(true);
    expect(screen.queryByText(/Your session expired/)).not.toBeInTheDocument();
    await signIn(user, 'another@example.test');
    await user.click(screen.getByRole('link', { name: 'My Contracts' }));
    await act(async () => {
      old.resolve(errorResponse(401, 'UNAUTHORIZED'));
    });
    expect(await screen.findByText('No saved contracts yet')).toBeVisible();
    expect(screen.queryByText(/R 15,000.00 device/)).not.toBeInTheDocument();
  });
});

describe('repayment and contracts', () => {
  it('loads the requested page and handles a contract removed since listing', async () => {
    const { user, fetcher } = start('/login', (url) => {
      if (url.endsWith('/login')) return loginResponse();
      if (url.includes('page=1&'))
        return Response.json({
          items: [contract],
          pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
        });
      if (url.includes('page=2&'))
        return Response.json({
          items: [{ ...contract, deviceAmount: '12000.00' }],
          pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
        });
      return errorResponse(404, 'NOT_FOUND');
    });
    await signIn(user);
    await user.click(screen.getByRole('link', { name: 'My Contracts' }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(
      await screen.findByRole('link', { name: /R 12,000.00 device/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This contract could not be found.',
    );
    expect(fetcher.mock.calls.map(([url]) => url)).toContain(
      '/api/v1/contracts?page=2&pageSize=20',
    );
  });

  it('renders the API results and saves the selected term as a decimal-string request', async () => {
    const pending = Promise.withResolvers<Response>();
    const { user, fetcher } = start('/login', (url) => {
      if (url.endsWith('/login')) return loginResponse();
      if (url.endsWith('/calculate')) return pending.promise;
      return Response.json(contract, { status: 201 });
    });
    await signIn(user);
    expect(screen.getByText('Your options will appear here')).toBeVisible();
    await requestQuote(user);
    expect(screen.getByText('Calculating repayment options…')).toBeVisible();
    await act(async () => {
      pending.resolve(Response.json(quote));
    });
    const option = await screen.findByRole('radio', { name: '12 months' });
    expect(screen.getByText('R 1,294.45')).toBeVisible();
    expect(screen.getAllByText('6.5%')).toHaveLength(3);
    await user.click(option);
    await user.click(screen.getByRole('button', { name: 'Save contract' }));
    expect(await screen.findByText(/Contract saved/)).toBeVisible();
    const [, calculation, creation] = fetcher.mock.calls;
    expect(calculation[1]?.body).toBe(
      JSON.stringify({ deviceAmount: '15000.00' }),
    );
    expect(new Headers(calculation[1]?.headers).get('Authorization')).toBe(
      'Bearer fixture-token',
    );
    expect(creation[1]?.body).toBe(
      JSON.stringify({ deviceAmount: '15000.00', termMonths: 12 }),
    );
    expect(new Headers(creation[1]?.headers).get('Authorization')).toBe(
      'Bearer fixture-token',
    );
  });

  it('invalidates the quote when the amount changes and ignores an older pending result', async () => {
    const stale = Promise.withResolvers<Response>();
    let calculations = 0;
    const { user } = start('/login', (url) => {
      if (url.endsWith('/login')) return loginResponse();
      return ++calculations === 1 ? Response.json(quote) : stale.promise;
    });
    await signIn(user);
    const amount = await requestQuote(user);
    await user.click(await screen.findByRole('radio', { name: '12 months' }));
    await user.type(amount, '1');
    expect(
      screen.queryByRole('button', { name: 'Save contract' }),
    ).not.toBeInTheDocument();
    await user.clear(amount);
    await user.type(amount, '12000');
    await user.click(
      screen.getByRole('button', { name: 'Calculate repayments' }),
    );
    await user.type(amount, '1');
    await act(async () => {
      stale.resolve(Response.json(quote));
    });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText('Your options will appear here')).toBeVisible();
  });

  it('supports unavailable listing recovery, edit feedback and a confirmed deletion', async () => {
    let listing = 0;
    let removed = false;
    const updated = { ...contract, deviceAmount: '12000.00', termMonths: 36 };
    const { user, fetcher } = start('/login', (url, options) => {
      if (url.endsWith('/login')) return loginResponse();
      if (url.includes('/contracts?')) {
        return ++listing === 1
          ? errorResponse(503, 'DATABASE_UNAVAILABLE')
          : Response.json(list(removed ? [] : [contract]));
      }
      if (options?.method === 'PATCH') return Response.json(updated);
      if (options?.method === 'DELETE') {
        removed = true;
        return new Response(null, { status: 204 });
      }
      return Response.json(contract);
    });
    await signIn(user);
    await user.click(screen.getByRole('link', { name: 'My Contracts' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'temporarily unavailable',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.click(
      await screen.findByRole('link', { name: /R 15,000.00 device/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Edit contract' }),
    );
    const amount = screen.getByLabelText('Device purchase amount (ZAR)');
    await user.clear(amount);
    await user.type(amount, '12000.00');
    await user.selectOptions(screen.getByLabelText('Repayment term'), '36');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Contract updated.')).toBeVisible();
    expect(screen.getByText('R 12,000.00')).toBeVisible();
    const patch = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    );
    expect(patch?.[1]?.body).toBe(
      JSON.stringify({ deviceAmount: '12000.00', termMonths: 36 }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete contract' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm delete' }),
    );
    expect(await screen.findByText('Contract deleted.')).toBeVisible();
    expect(await screen.findByText('No saved contracts yet')).toBeVisible();
  });
});
