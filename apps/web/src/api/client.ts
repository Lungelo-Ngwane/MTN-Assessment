import { z } from 'zod';

export const terms = [12, 24, 36] as const;
export type Term = (typeof terms)[number];
export type Credentials = { email: string; password: string };
export type User = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};
export type AccessToken = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};
export type ContractInput = { deviceAmount: string; termMonths: Term };

type Repayment = {
  monthlyRepayment: string;
  totalRepayment: string;
  totalInterest: string;
};
export type Option = Repayment & { termMonths: Term; finalRepayment: string };
export type Quote = {
  currency: 'ZAR';
  deviceAmount: string;
  annualInterestRate: string;
  calculationMethod: string;
  options: Option[];
};
export type Contract = Repayment & {
  id: string;
  userId: string;
  deviceAmount: string;
  termMonths: number;
  interestRate: string;
  finalRepayment: string | null;
  calculationMethod: string | null;
  calculationVersion: number | null;
  createdAt: string;
  updatedAt: string;
};
export type ContractPage = {
  items: Contract[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const errorEnvelope = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  requestId: z.uuid(),
  timestamp: z.string(),
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly retryAfter?: number,
  ) {
    super('API request failed');
  }
}

export function apiMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return 'The service could not be reached. Check your connection and try again.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED')
    return 'An account already exists for this email. Sign in instead.';
  if (error.status === 401) return 'Your email or password is incorrect.';
  if (error.status === 404) return 'This contract could not be found.';
  if (error.status === 429)
    return error.retryAfter
      ? `Too many attempts. Try again in ${error.retryAfter} seconds.`
      : 'Too many attempts. Wait a moment and try again.';
  if (error.status === 503)
    return 'The service is temporarily unavailable. Try again shortly.';
  if (error.status === 400) return 'Check your details and try again.';
  return 'Something went wrong. Please try again.';
}

type SessionRequest = {
  token: string;
  signal: AbortSignal;
  expired: () => void;
};

async function send<T>(
  path: string,
  {
    method = 'GET',
    body,
    session,
    signal,
  }: {
    method?: string;
    body?: object;
    session?: SessionRequest;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  const signals = [signal, session?.signal, AbortSignal.timeout(15_000)].filter(
    (value) => value !== undefined,
  );
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.any(signals),
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401) session?.expired();
    const envelope = errorEnvelope.safeParse(
      await response.json().catch(() => undefined),
    );
    const header = z.uuid().safeParse(response.headers.get('X-Request-ID'));
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new ApiError(
      response.status,
      envelope.data?.code,
      header.data ?? envelope.data?.requestId,
      retryAfter > 0 ? retryAfter : undefined,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createApi(session?: SessionRequest) {
  return {
    login: (body: Credentials, signal?: AbortSignal) =>
      send<AccessToken>('/auth/login', { method: 'POST', body, signal }),
    register: (body: Credentials, signal?: AbortSignal) =>
      send<User>('/auth/register', { method: 'POST', body, signal }),
    calculate: (deviceAmount: string, signal?: AbortSignal) =>
      send<Quote>('/contracts/calculate', {
        method: 'POST',
        body: { deviceAmount },
        session,
        signal,
      }),
    list: (page: number, signal?: AbortSignal) =>
      send<ContractPage>(`/contracts?page=${page}&pageSize=20`, {
        session,
        signal,
      }),
    get: (id: string, signal?: AbortSignal) =>
      send<Contract>(`/contracts/${encodeURIComponent(id)}`, {
        session,
        signal,
      }),
    create: (body: ContractInput) =>
      send<Contract>('/contracts', { method: 'POST', body, session }),
    update: (id: string, body: Partial<ContractInput>) =>
      send<Contract>(`/contracts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        session,
      }),
    delete: (id: string) =>
      send<void>(`/contracts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        session,
      }),
  };
}
