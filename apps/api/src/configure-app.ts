import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { Environment } from './config/environment';
import {
  handleBodyError,
  logRequests,
  REQUEST_ID_HEADER,
} from './http/request-logging';
import { RequestValidationPipe } from './http/request-validation';
import { HttpMetrics } from './monitoring/http-metrics';
import { configureOpenApi } from './openapi/configure-openapi';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  const metrics = app.get(HttpMetrics);
  app.use(logRequests(app.get(Logger), metrics));
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.use(
    json({ limit: '16kb' }),
    urlencoded({ limit: '16kb', extended: false }),
    handleBodyError,
  );
  app.useGlobalPipes(new RequestValidationPipe());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  if (config.get('SWAGGER_ENABLED', { infer: true })) configureOpenApi(app);
}
