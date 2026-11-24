import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('provides local defaults', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('converts a valid port to a number', () => {
    expect(
      validateEnvironment({ NODE_ENV: 'production', PORT: '8080' }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
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
});
