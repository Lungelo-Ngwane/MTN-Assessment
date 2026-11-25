import {
  ArgumentsHost,
  Catch,
  HttpException,
  ServiceUnavailableException,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AccountUnavailableError,
  InvalidCredentialsError,
} from '../auth/auth.service';
import { ContractOwnerUnavailableError } from '../contracts/contract.repository';
import { InvalidContractUpdateError } from '../contracts/contracts.service';
import { isDatabaseUnavailable } from '../database/database-unavailable';
import { InvalidRepaymentAmountError } from '../repayment/repayment-calculator';
import { DuplicateEmailError } from '../users/user.repository';
import {
  matchedRoute,
  writeError,
  type ApiResponse,
  type ErrorCode,
} from './http-errors';

const statusCodes: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<ApiResponse>();
    if (response.headersSent) return;

    if (error instanceof DuplicateEmailError)
      return writeError(response, 'EMAIL_ALREADY_REGISTERED');
    if (error instanceof InvalidCredentialsError)
      return writeError(response, 'INVALID_CREDENTIALS');
    if (
      error instanceof AccountUnavailableError ||
      error instanceof ContractOwnerUnavailableError
    ) {
      return writeError(response, 'UNAUTHORIZED');
    }
    if (error instanceof InvalidRepaymentAmountError)
      return writeError(response, 'INVALID_DEVICE_AMOUNT');
    if (error instanceof InvalidContractUpdateError)
      return writeError(response, 'INVALID_CONTRACT_UPDATE');
    if (isDatabaseUnavailable(error))
      return writeError(response, 'DATABASE_UNAVAILABLE');
    if (!(error instanceof HttpException))
      return writeError(response, 'INTERNAL_ERROR');

    const status = error.getStatus();
    const payload = error.getResponse();
    if (
      error instanceof ServiceUnavailableException &&
      typeof payload === 'object' &&
      'status' in payload &&
      payload.status === 'unavailable'
    ) {
      response.locals.errorCode = 'SERVICE_UNAVAILABLE';
      response.status(503).json({ status: 'unavailable' });
      return;
    }
    if (status === 400 && typeof payload === 'object' && 'code' in payload) {
      if (
        payload.code === 'VALIDATION_FAILED' ||
        payload.code === 'INVALID_UUID'
      ) {
        return writeError(response, payload.code);
      }
    }
    if (status === 404 && !matchedRoute(context.getRequest<Request>())) {
      return writeError(response, 'ROUTE_NOT_FOUND');
    }
    writeError(
      response,
      statusCodes[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR'),
      status,
    );
  }
}
