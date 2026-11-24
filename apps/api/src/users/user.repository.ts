import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const userProfile = {
  id: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: { email: string; passwordHash: string }) {
    return this.prisma.client.user.create({ data: input, select: userProfile });
  }

  findByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email },
      select: userProfile,
    });
  }
}
