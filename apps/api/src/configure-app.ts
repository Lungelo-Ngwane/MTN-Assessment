import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { Environment } from './config/environment';

const handleBodyError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (!(error instanceof Error) || !('status' in error)) {
    next(error);
    return;
  }

  const status =
    error.status === 413 || error.status === 415 ? error.status : 400;
  const message =
    status === 413
      ? 'Payload Too Large'
      : status === 415
        ? 'Unsupported Media Type'
        : 'Bad Request';
  response.status(status).json({ statusCode: status, message });
};

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Environment, true>);
  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });
  app.use(
    json({ limit: '16kb' }),
    urlencoded({ limit: '16kb', extended: false }),
    handleBodyError,
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
}
