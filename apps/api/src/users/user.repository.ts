import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

export class DuplicateEmailError extends Error {}

const userProfile = {
  id: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { email: string; passwordHash: string }) {
    try {
      return await this.prisma.client.user.create({
        data: input,
        select: userProfile,
      });
    } catch (error) {
      // The only caller-supplied unique field is email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateEmailError('Email already registered');
      }
      throw error;
    }
  }

  findByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email },
      select: userProfile,
    });
  }

  findCredentialsByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
  }

  findById(id: string) {
    return this.prisma.client.user.findUnique({
      where: { id },
      select: userProfile,
    });
  }
}
