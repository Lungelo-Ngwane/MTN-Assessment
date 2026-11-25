import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ERROR_DEFINITIONS, type ErrorCode } from '../http/http-errors';
import { REQUEST_ID_HEADER } from '../http/request-logging';
import {
  EXAMPLE_REQUEST_ID,
  EXAMPLE_TIMESTAMP,
  ref,
  type responseSchemas,
} from './response-schemas';

export const BEARER_SCHEME = 'bearer';
export const BODY_ERRORS = [
  'VALIDATION_FAILED',
  'MALFORMED_JSON',
  'BAD_REQUEST',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
] as const satisfies readonly ErrorCode[];

const responseHeaders = {
  [REQUEST_ID_HEADER]: {
    description: 'Server-generated ID for this request.',
    schema: { type: 'string', format: 'uuid', example: EXAMPLE_REQUEST_ID },
  },
};

interface DocumentedOperation {
  summary: string;
  description: string;
  status: 200 | 201 | 204;
  response?: keyof typeof responseSchemas;
  public?: true;
  errors?: readonly ErrorCode[];
  readiness?: true;
}

export function DocumentOperation(
  options: DocumentedOperation,
): MethodDecorator {
  const grouped = new Map<number, ErrorCode[]>();
  const codes: ErrorCode[] = [
    ...(options.public ? [] : (['UNAUTHORIZED'] as const)),
    ...(options.errors ?? []),
    'INTERNAL_ERROR',
  ];
  for (const code of codes) {
    const [status] = ERROR_DEFINITIONS[code];
    const existing = grouped.get(status) ?? [];
    existing.push(code);
    grouped.set(status, existing);
  }

  return applyDecorators(
    ApiOperation({
      summary: options.summary,
      description: options.description,
      security: options.public ? [] : [{ [BEARER_SCHEME]: [] }],
    }),
    ApiResponse({
      status: options.status,
      headers: responseHeaders,
      description: options.response
        ? 'Successful response.'
        : 'Contract permanently deleted.',
      ...(options.response && { schema: ref(options.response) }),
    }),
    ...(options.readiness
      ? [
          ApiResponse({
            status: 503,
            description: 'The database did not respond to the readiness probe.',
            headers: responseHeaders,
            schema: ref('HealthUnavailable'),
          }),
        ]
      : []),
    ...Array.from(grouped, ([status, errors]) =>
      ApiResponse({
        status,
        headers:
          status === 429
            ? {
                ...responseHeaders,
                'Retry-After': {
                  description: 'Seconds until another attempt is permitted.',
                  schema: { type: 'integer' },
                },
              }
            : responseHeaders,
        description: errors
          .map((code) => ERROR_DEFINITIONS[code][1])
          .join('; '),
        content: {
          'application/json': {
            schema: ref('ErrorResponse'),
            examples: Object.fromEntries(
              errors.map((code) => [
                code,
                {
                  value: {
                    statusCode: status,
                    code,
                    message: ERROR_DEFINITIONS[code][1],
                    requestId: EXAMPLE_REQUEST_ID,
                    timestamp: EXAMPLE_TIMESTAMP,
                  },
                },
              ]),
            ),
          },
        },
      }),
    ),
  );
}
