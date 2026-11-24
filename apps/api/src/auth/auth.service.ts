import { Injectable } from '@nestjs/common';
import { UserRepository } from '../users/user.repository';
import { AccessTokenService } from './access-token.service';
import type { LoginDto, RegisterDto } from './credentials.dto';
import { PasswordService } from './password.service';

export class InvalidCredentialsError extends Error {}
export class AccountUnavailableError extends Error {}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: AccessTokenService,
  ) {}

  async register({ email, password }: RegisterDto) {
    const passwordHash = await this.passwords.hash(password);
    return this.users.create({ email, passwordHash });
  }

  async login({ email, password }: LoginDto) {
    const credentials = await this.users.findCredentialsByEmail(email);
    const matches = await this.passwords.verify(
      password,
      credentials?.passwordHash,
    );
    if (!matches || !credentials) {
      throw new InvalidCredentialsError();
    }
    return this.tokens.issue(credentials.id);
  }

  async profile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AccountUnavailableError();
    }
    return user;
  }
}
