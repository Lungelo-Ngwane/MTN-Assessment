import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthExceptionFilter } from './auth-exception.filter';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './credentials.dto';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './jwt.strategy';
import { Public } from './public.decorator';

@Controller({ path: 'auth', version: '1' })
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() credentials: RegisterDto) {
    return this.auth.register(credentials);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() credentials: LoginDto) {
    return this.auth.login(credentials);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.profile(user.id);
  }
}
