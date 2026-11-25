const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;

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
  LOG_LEVEL: (typeof LOG_LEVELS)[number];
  SWAGGER_ENABLED: boolean;
  METRICS_ENABLED: boolean;
  METRICS_BIND: '127.0.0.1' | '0.0.0.0';
  METRICS_PORT: number;
  METRICS_PATH: string;
}

export class EnvironmentValidationError extends Error {
  constructor(
    readonly field: keyof Environment,
    requirement: string,
  ) {
    super(`${field} ${requirement}`);
    this.name = 'EnvironmentValidationError';
  }
}

function positiveInteger(
  value: unknown,
  key: keyof Environment,
  fallback: string,
  max: number,
): number {
  const raw = value ?? fallback;
  const number =
    typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new EnvironmentValidationError(
      key,
      `must be an integer from 1 to ${max}`,
    );
  }
  return number;
}

function tokenIdentifier(
  value: unknown,
  key: keyof Environment,
  fallback: string,
): string {
  const identifier = value ?? fallback;
  if (
    typeof identifier !== 'string' ||
    !/^[\x21-\x7e]{1,200}$/.test(identifier)
  ) {
    throw new EnvironmentValidationError(
      key,
      'must be a nonempty identifier without spaces',
    );
  }
  return identifier;
}

function corsOrigins(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string')
    throw new EnvironmentValidationError(
      'CORS_ORIGINS',
      'must list HTTP(S) origins',
    );
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
    throw new EnvironmentValidationError(
      'CORS_ORIGINS',
      'must list exact HTTP(S) origins without paths',
    );
  }
  return origins;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const mode = input.NODE_ENV ?? 'development';
  if (mode !== 'development' && mode !== 'test' && mode !== 'production') {
    throw new EnvironmentValidationError(
      'NODE_ENV',
      'must be development, test, or production',
    );
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
    throw new EnvironmentValidationError(
      'DATABASE_URL',
      'must be a PostgreSQL URL with a user, host, and database',
    );
  }

  const secret = input.JWT_SECRET;
  if (
    typeof secret !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(secret) ||
    Buffer.from(secret, 'base64url').toString('base64url') !== secret
  ) {
    throw new EnvironmentValidationError(
      'JWT_SECRET',
      'must be 32 random bytes encoded as unpadded base64url',
    );
  }

  const requestedLevel = input.LOG_LEVEL ?? 'info';
  const logLevel = LOG_LEVELS.find((level) => level === requestedLevel);
  if (!logLevel) {
    throw new EnvironmentValidationError(
      'LOG_LEVEL',
      'must be trace, debug, info, warn, error, fatal, or silent',
    );
  }

  for (const key of ['SWAGGER_ENABLED', 'METRICS_ENABLED'] as const) {
    const value = input[key];
    if (value !== undefined && value !== 'true' && value !== 'false') {
      throw new EnvironmentValidationError(key, 'must be true or false');
    }
  }
  const metricsEnabled = input.METRICS_ENABLED === 'true';
  const metricsBind = input.METRICS_BIND ?? '127.0.0.1';
  if (metricsBind !== '127.0.0.1' && metricsBind !== '0.0.0.0')
    throw new EnvironmentValidationError(
      'METRICS_BIND',
      'must be 127.0.0.1 or 0.0.0.0',
    );
  const metricsPort = positiveInteger(
    input.METRICS_PORT,
    'METRICS_PORT',
    '9464',
    65535,
  );
  if (metricsEnabled && metricsPort === port)
    throw new EnvironmentValidationError(
      'METRICS_PORT',
      'must differ from PORT',
    );
  const metricsPath = input.METRICS_PATH ?? '/metrics';
  if (
    typeof metricsPath !== 'string' ||
    !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(metricsPath)
  )
    throw new EnvironmentValidationError(
      'METRICS_PATH',
      'must be an absolute path with literal segments',
    );

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
    LOG_LEVEL: logLevel,
    SWAGGER_ENABLED:
      input.SWAGGER_ENABLED === undefined
        ? mode === 'development'
        : input.SWAGGER_ENABLED === 'true',
    METRICS_ENABLED: metricsEnabled,
    METRICS_BIND: metricsBind,
    METRICS_PORT: metricsPort,
    METRICS_PATH: metricsPath,
  };
}
