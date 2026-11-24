export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_TTL_SECONDS: number;
  AUTH_RATE_LIMIT: number;
  AUTH_RATE_WINDOW_SECONDS: number;
  CORS_ORIGINS: string[];
}

function positiveInteger(
  value: unknown,
  key: string,
  fallback: string,
  max: number,
): number {
  const raw = value ?? fallback;
  const number =
    typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${key} must be an integer from 1 to ${max}`);
  }
  return number;
}

function tokenIdentifier(
  value: unknown,
  key: string,
  fallback: string,
): string {
  const identifier = value ?? fallback;
  if (
    typeof identifier !== 'string' ||
    !/^[\x21-\x7e]{1,200}$/.test(identifier)
  ) {
    throw new Error(`${key} must be a nonempty identifier without spaces`);
  }
  return identifier;
}

function corsOrigins(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string')
    throw new Error('CORS_ORIGINS must list HTTP(S) origins');
  const origins = value.split(',').map((origin) => origin.trim());
  if (
    origins.some((origin) => {
      const url = URL.parse(origin);
      return (
        !url ||
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin
      );
    })
  ) {
    throw new Error(
      'CORS_ORIGINS must list exact HTTP(S) origins without paths',
    );
  }
  return origins;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const mode = input.NODE_ENV ?? 'development';
  if (mode !== 'development' && mode !== 'test' && mode !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const port = positiveInteger(input.PORT, 'PORT', '3000', 65535);

  const databaseUrl = input.DATABASE_URL;
  const parsed =
    typeof databaseUrl === 'string' ? URL.parse(databaseUrl) : null;
  if (
    typeof databaseUrl !== 'string' ||
    !parsed ||
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.pathname.length < 2
  ) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a user, host, and database',
    );
  }

  const secret = input.JWT_SECRET;
  if (
    typeof secret !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
    Buffer.from(secret, 'base64url').toString('base64url') !== secret
  ) {
    throw new Error(
      'JWT_SECRET must be 32 random bytes encoded as unpadded base64url',
    );
  }

  return {
    NODE_ENV: mode,
    PORT: port,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: secret,
    JWT_ISSUER: tokenIdentifier(
      input.JWT_ISSUER,
      'JWT_ISSUER',
      'contract-repayment-api',
    ),
    JWT_AUDIENCE: tokenIdentifier(
      input.JWT_AUDIENCE,
      'JWT_AUDIENCE',
      'contract-repayment',
    ),
    JWT_TTL_SECONDS: positiveInteger(
      input.JWT_TTL_SECONDS,
      'JWT_TTL_SECONDS',
      '900',
      3600,
    ),
    AUTH_RATE_LIMIT: positiveInteger(
      input.AUTH_RATE_LIMIT,
      'AUTH_RATE_LIMIT',
      '10',
      1000,
    ),
    AUTH_RATE_WINDOW_SECONDS: positiveInteger(
      input.AUTH_RATE_WINDOW_SECONDS,
      'AUTH_RATE_WINDOW_SECONDS',
      '60',
      3600,
    ),
    CORS_ORIGINS: corsOrigins(input.CORS_ORIGINS),
  };
}
