import {
  BadRequestException,
  ParseUUIDPipe,
  ValidationPipe,
  type ArgumentMetadata,
} from '@nestjs/common';

export const parseUuid = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException({ code: 'INVALID_UUID' }),
});

function validationError() {
  return new BadRequestException({ code: 'VALIDATION_FAILED' });
}

export class RequestValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationError,
    });
  }

  override transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    if (
      (metadata.type === 'body' || metadata.type === 'query') &&
      value &&
      typeof value === 'object' &&
      ['__proto__', 'prototype', 'constructor'].some((key) =>
        Object.hasOwn(value, key),
      )
    ) {
      // Nest strips these names before DTO validation can reject them.
      return Promise.reject(validationError());
    }
    return super.transform(value, metadata) as Promise<unknown>;
  }
}
