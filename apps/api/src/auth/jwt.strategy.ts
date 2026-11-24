import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Environment } from '../config/environment';
import { ACCESS_TOKEN_ALGORITHM } from './access-token.service';

export interface AuthenticatedUser {
  id: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Environment, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: Buffer.from(
        config.getOrThrow<string>('JWT_SECRET'),
        'base64url',
      ),
      algorithms: [ACCESS_TOKEN_ALGORITHM],
      issuer: config.get('JWT_ISSUER', { infer: true }),
      audience: config.get('JWT_AUDIENCE', { infer: true }),
    });
  }

  validate(payload: unknown): AuthenticatedUser {
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp)
    ) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub };
  }
}
