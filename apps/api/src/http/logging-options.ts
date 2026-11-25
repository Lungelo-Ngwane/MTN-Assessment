import type { Options } from 'pino-http';
import type { Environment } from '../config/environment';

export function loggingOptions(level: Environment['LOG_LEVEL']): Options {
  return {
    level,
    base: null,
    autoLogging: false,
    hooks: {
      logMethod(args, method) {
        const [first] = args as unknown[];
        // Pino can copy err.message to msg before its serializers run.
        if (first instanceof Error) {
          return method.call(this, { err: first }, 'Error details omitted');
        }
        if (
          first &&
          typeof first === 'object' &&
          (('err' in first && first.err instanceof Error) ||
            ('error' in first && first.error instanceof Error))
        ) {
          return method.call(
            this,
            { ...first, context: undefined },
            'Error details omitted',
          );
        }
        return method.apply(this, args);
      },
    },
    redact: {
      remove: true,
      paths: [
        'req',
        'res',
        'request',
        'response',
        'body',
        'headers',
        ...[
          'password',
          'passwordHash',
          'email',
          'authorization',
          'cookie',
          'cookies',
          'token',
          'accessToken',
          'jwt',
          'jwtSecret',
          'databaseUrl',
          'JWT_SECRET',
          'DATABASE_URL',
          'secret',
          'stack',
        ].flatMap((field) => [field, `*.${field}`]),
      ],
    },
    serializers: {
      err: () => ({ message: 'Error details omitted' }),
      error: () => ({ message: 'Error details omitted' }),
    },
  };
}
