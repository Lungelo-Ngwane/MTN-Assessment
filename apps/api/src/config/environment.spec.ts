import { validateEnvironment } from './environment';

const DATABASE_URL = 'postgresql://example@localhost:5432/example';

describe('validateEnvironment', () => {
  it('provides local defaults', () => {
    expect(validateEnvironment({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('converts a valid port to a number', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL,
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL,
    });
  });

  it.each(['', 'abc', '3.5', '0', '65536', ' 3000', 3000])(
    'rejects invalid port %p',
    (PORT) => {
      expect(() => validateEnvironment({ PORT })).toThrow(
        'PORT must be an integer',
      );
    },
  );

  it('rejects an unsupported runtime mode', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV must be development, test, or production',
    );
  });

  it.each([
    undefined,
    'https://user@localhost/db',
    'postgresql://localhost/db',
    'postgresql://user@localhost/',
  ])('rejects an invalid or missing DATABASE_URL (%p)', (databaseUrl) => {
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
      'DATABASE_URL must be a PostgreSQL URL',
    );
  });
});
