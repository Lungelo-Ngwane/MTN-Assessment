import type { NextFunction, Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'nestjs-pino';
import type { HttpMetrics } from '../monitoring/http-metrics';
import { matchedRoute, writeError, type ApiResponse } from './http-errors';

export const REQUEST_ID_HEADER = 'X-Request-ID';

export function logRequests(
  logger: Logger,
  metrics: Pick<HttpMetrics, 'observe'>,
) {
  return (request: Request, response: ApiResponse, next: () => void): void => {
    const started = performance.now();
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.once('close', () => {
      const completed = response.writableFinished;
      const statusCode = completed ? response.statusCode : 499;
      const route = matchedRoute(request) ?? 'unmatched';
      const durationMs = performance.now() - started;
      metrics.observe(request.method, route, statusCode, durationMs);
      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      logger[level]({
        event: completed ? 'http_request_completed' : 'http_request_aborted',
        requestId,
        method: request.method,
        route,
        statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        errorCode: response.locals.errorCode,
      });
    });
    next();
  };
}

export function handleBodyError(
  error: unknown,
  _request: Request,
  response: ApiResponse,
  next: NextFunction,
): void {
  if (!(error instanceof Error) || !('status' in error)) return next(error);
  if (error.status === 413) return writeError(response, 'PAYLOAD_TOO_LARGE');
  if (error.status === 415)
    return writeError(response, 'UNSUPPORTED_MEDIA_TYPE');
  if (error.status !== 400) return next(error);
  writeError(
    response,
    'type' in error && error.type === 'entity.parse.failed'
      ? 'MALFORMED_JSON'
      : 'BAD_REQUEST',
  );
}
