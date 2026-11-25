import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { BODY_ERRORS, DocumentOperation } from '../openapi/api-operation';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './credentials.dto';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './jwt.strategy';
import { Public } from './public.decorator';

@Controller({ path: 'auth', version: '1' })
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @DocumentOperation({
    summary: 'Register an account',
    description:
      'Creates a user profile. Email is trimmed and lowercased, and duplicate addresses are rejected.',
    status: 201,
    response: 'UserProfile',
    public: true,
    errors: [
      ...BODY_ERRORS,
      'EMAIL_ALREADY_REGISTERED',
      'RATE_LIMITED',
      'DATABASE_UNAVAILABLE',
    ],
  })
  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() credentials: RegisterDto) {
    return this.auth.register(credentials);
  }

  @Public()
  @DocumentOperation({
    summary: 'Log in and obtain an access token',
    description:
      'Verifies the credentials and returns a JWT with its lifetime in seconds. The default lifetime is 900 seconds.',
    status: 200,
    response: 'AccessToken',
    public: true,
    errors: [
      ...BODY_ERRORS,
      'INVALID_CREDENTIALS',
      'RATE_LIMITED',
      'DATABASE_UNAVAILABLE',
    ],
  })
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() credentials: LoginDto) {
    return this.auth.login(credentials);
  }

  @Get('me')
  @DocumentOperation({
    summary: 'Read the authenticated user profile',
    description:
      'Returns the profile associated with the bearer token. The user must still exist.',
    status: 200,
    response: 'UserProfile',
    errors: ['DATABASE_UNAVAILABLE'],
  })
  @Header('Cache-Control', 'no-store')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.profile(user.id);
  }
}
