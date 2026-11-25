import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { AppModule } from './app.module';
import { Environment } from './config/environment';
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

void bootstrap().catch(() => {
  pino({ level: 'error' }, process.stderr).error(
    { event: 'startup_failed' },
    'Application startup failed',
  );
  process.exitCode = 1;
});
