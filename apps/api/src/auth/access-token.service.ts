import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Environment } from '../config/environment';

export const ACCESS_TOKEN_ALGORITHM = 'HS256';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async issue(userId: string) {
    const expiresIn = this.config.get('JWT_TTL_SECONDS', { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      { expiresIn },
    );
    return { accessToken, tokenType: 'Bearer', expiresIn };
  }
}
