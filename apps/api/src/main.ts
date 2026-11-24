import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Environment } from './config/environment';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApp(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Environment, true>);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exitCode = 1;
});
