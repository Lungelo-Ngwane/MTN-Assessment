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

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.use(logRequests(app.get(Logger)));
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
}
