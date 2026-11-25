import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { AppModule } from './app.module';
import { Environment, EnvironmentValidationError } from './config/environment';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bufferLogs: true,
    autoFlushLogs: false,
  });
  app.useLogger(app.get(Logger));
  app.flushLogs();
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  // Validation errors are built from application-defined field names and rules.
  const diagnostic =
    error instanceof EnvironmentValidationError
      ? {
          errorCode: 'INVALID_ENVIRONMENT',
          field: error.field,
          detail: error.message,
        }
      : { errorCode: 'BOOTSTRAP_FAILED' };
  pino({ level: 'error' }, process.stderr).error(
    { event: 'startup_failed', ...diagnostic },
    'Application startup failed',
  );
  process.exitCode = 1;
});
