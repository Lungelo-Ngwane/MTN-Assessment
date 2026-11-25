import { createHash } from 'node:crypto';
import { EnvironmentValidationError, validateEnvironment } from './environment';

const DATABASE_URL = 'postgresql://example@localhost:5432/example';
const JWT_SECRET = createHash('sha256')
  .update('unit fixture')
  .digest('base64url');
const required = { DATABASE_URL, JWT_SECRET };

describe('validateEnvironment', () => {
  it.each([
    ['development', undefined, true],
    ['production', undefined, false],
    ['test', undefined, false],
    ['development', 'false', false],
    ['production', 'true', true],
  ])(
    'configures Swagger in %s with override %s',
    (NODE_ENV, SWAGGER_ENABLED, enabled) => {
      expect(
        validateEnvironment({ ...required, NODE_ENV, SWAGGER_ENABLED })
          .SWAGGER_ENABLED,
      ).toBe(enabled);
    },
  );

  it('provides local defaults', () => {
    expect(validateEnvironment(required)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      JWT_TTL_SECONDS: 900,
      AUTH_RATE_LIMIT: 10,
      AUTH_RATE_WINDOW_SECONDS: 60,
      CORS_ORIGINS: [],
      LOG_LEVEL: 'info',
      METRICS_ENABLED: false,
      METRICS_BIND: '127.0.0.1',
      METRICS_PORT: 9464,
      METRICS_PATH: '/metrics',
    });
  });

  it.each([
    ['METRICS_ENABLED', 'yes'],
    ['METRICS_BIND', 'public.example.test'],
    ['METRICS_PORT', '3000'],
    ['METRICS_PATH', '/metrics?query=value'],
  ])('rejects invalid monitoring configuration for %s', (key, value) => {
    expect(() =>
      validateEnvironment({
        ...required,
        METRICS_ENABLED: 'true',
        [key]: value,
      }),
    ).toThrow(key);
  });

  it('identifies a 128-character hex JWT secret without including its value', () => {
    const hexSecret = 'ab'.repeat(64);
    const input = {
      ...required,
      NODE_ENV: 'production',
      CORS_ORIGINS: '',
      SWAGGER_ENABLED: 'true',
    };
    const validate = () =>
      validateEnvironment({ ...input, JWT_SECRET: hexSecret });

    expect(validate).toThrow(EnvironmentValidationError);
    expect(validate).toThrow(
      /^JWT_SECRET must be 32 random bytes encoded as unpadded base64url$/,
    );
    expect(validateEnvironment(input)).toMatchObject({
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
    });
  });

  it('converts a valid port to a number', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_URL,
        JWT_SECRET,
      }),
    ).toMatchObject({
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

  it.each([undefined, '', 'short', 'x'.repeat(43)])(
    'rejects invalid JWT secrets (%p)',
    (secret) => {
      expect(() =>
        validateEnvironment({ DATABASE_URL, JWT_SECRET: secret }),
      ).toThrow('JWT_SECRET');
    },
  );

  it.each([
    ['JWT_TTL_SECONDS', '3601'],
    ['AUTH_RATE_LIMIT', '0'],
    ['AUTH_RATE_WINDOW_SECONDS', '0.5'],
    ['JWT_AUDIENCE', ''],
    ['CORS_ORIGINS', '*'],
    ['CORS_ORIGINS', 'https://example.test/path'],
    ['LOG_LEVEL', 'verbose'],
    ['SWAGGER_ENABLED', '1'],
  ])('rejects invalid %s settings', (key, value) => {
    expect(() => validateEnvironment({ ...required, [key]: value })).toThrow(
      key,
    );
  });

  it('parses an explicit origin allowlist and expiration', () => {
    const result = validateEnvironment({
      ...required,
      JWT_TTL_SECONDS: '120',
      CORS_ORIGINS: 'https://example.test, http://localhost:3000',
    });
    expect(result.JWT_TTL_SECONDS).toBe(120);
    expect(result.CORS_ORIGINS).toEqual([
      'https://example.test',
      'http://localhost:3000',
    ]);
  });

  it('rejects a non-string CORS origin configuration', () => {
    expect(() =>
      validateEnvironment({
        ...required,
        CORS_ORIGINS: ['https://example.test'],
      }),
    ).toThrow('CORS_ORIGINS must list HTTP(S) origins');
  });
});
