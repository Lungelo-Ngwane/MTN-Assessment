import type { Response } from 'supertest';
import type { ErrorCode, ErrorResponse } from '../src/http/http-errors';

export function expectApiError(
  response: Response,
  statusCode: number,
  code: ErrorCode,
  message?: string,
) {
  const requestId: unknown = response.headers['x-request-id'];
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  const payload = response.body as ErrorResponse;
  expect(Object.keys(payload).sort()).toEqual([
    'code',
    'message',
    'requestId',
    'statusCode',
    'timestamp',
  ]);
  expect(payload.statusCode).toBe(statusCode);
  expect(payload.code).toBe(code);
  expect(payload.requestId).toBe(requestId);
  expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  if (message) expect(payload.message).toBe(message);
  return {
    statusCode: payload.statusCode,
    code: payload.code,
    message: payload.message,
  };
}
