import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(password: string, storedHash?: string): Promise<boolean> {
    const usableHash = storedHash?.startsWith('$argon2id$')
      ? storedHash
      : undefined;
    const matches = await verify(usableHash ?? this.dummyHash, password);
    return usableHash !== undefined && matches;
  }
}
