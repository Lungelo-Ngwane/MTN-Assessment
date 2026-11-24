export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const mode = input.NODE_ENV ?? 'development';
  if (mode !== 'development' && mode !== 'test' && mode !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const rawPort = input.PORT ?? '3000';
  const port =
    typeof rawPort === 'string' && /^\d+$/.test(rawPort)
      ? Number(rawPort)
      : NaN;
  if (port < 1 || port > 65535 || !Number.isInteger(port)) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }

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

  return { NODE_ENV: mode, PORT: port, DATABASE_URL: databaseUrl };
}
