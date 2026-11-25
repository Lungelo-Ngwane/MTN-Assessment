import type { Request, Response } from 'express';

const errors = {
  BAD_REQUEST: [400, 'Bad Request'],
  VALIDATION_FAILED: [400, 'Request validation failed'],
  MALFORMED_JSON: [400, 'Malformed JSON'],
  INVALID_UUID: [400, 'Invalid UUID'],
  INVALID_DEVICE_AMOUNT: [400, 'Invalid device amount'],
  INVALID_CONTRACT_UPDATE: [400, 'A supported contract update is required'],
  UNAUTHORIZED: [401, 'Unauthorized'],
  INVALID_CREDENTIALS: [401, 'Invalid email or password'],
  FORBIDDEN: [403, 'Forbidden'],
  NOT_FOUND: [404, 'Not Found'],
  ROUTE_NOT_FOUND: [404, 'Route not found'],
  CONFLICT: [409, 'Conflict'],
  EMAIL_ALREADY_REGISTERED: [409, 'Email already registered'],
  PAYLOAD_TOO_LARGE: [413, 'Payload Too Large'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'Unsupported Media Type'],
  RATE_LIMITED: [429, 'Too Many Requests'],
  INTERNAL_ERROR: [500, 'Internal Server Error'],
  DATABASE_UNAVAILABLE: [503, 'Database temporarily unavailable'],
  SERVICE_UNAVAILABLE: [503, 'Service Unavailable'],
  HTTP_ERROR: [400, 'Request failed'],
} as const;

export type ErrorCode = keyof typeof errors;

export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  requestId: string;
  timestamp: string;
}

export type ApiResponse = Response<
  unknown,
  { requestId: string; errorCode?: ErrorCode }
>;

export function matchedRoute(request: Request): string | undefined {
  const route: unknown = request.route;
  if (
    route &&
    typeof route === 'object' &&
    'path' in route &&
    typeof route.path === 'string'
  ) {
    return route.path;
  }
}

export function writeError(
  response: ApiResponse,
  code: ErrorCode,
  statusOverride?: number,
): void {
  const [defaultStatus, message] = errors[code];
  const statusCode = statusOverride ?? defaultStatus;
  const body: ErrorResponse = {
    statusCode,
    code,
    message,
    requestId: response.locals.requestId,
    timestamp: new Date().toISOString(),
  };
  response.locals.errorCode = code;
  response.status(statusCode).json(body);
}
