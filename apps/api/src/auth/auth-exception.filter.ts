import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { DuplicateEmailError } from '../users/user.repository';
import {
  AccountUnavailableError,
  InvalidCredentialsError,
} from './auth.service';

@Catch()
export class AuthExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  constructor(adapter: HttpAdapterHost) {
    super(adapter.httpAdapter);
  }

  catch(error: unknown, host: ArgumentsHost): void {
    if (error instanceof DuplicateEmailError) {
      super.catch(new ConflictException('Email already registered'), host);
      return;
    }
    if (error instanceof InvalidCredentialsError) {
      super.catch(new UnauthorizedException('Invalid email or password'), host);
      return;
    }
    if (error instanceof AccountUnavailableError) {
      super.catch(new UnauthorizedException(), host);
      return;
    }
    if (error instanceof HttpException) {
      super.catch(error, host);
      return;
    }
    this.logger.error('Authentication request failed');
    super.catch(new InternalServerErrorException(), host);
  }
}
