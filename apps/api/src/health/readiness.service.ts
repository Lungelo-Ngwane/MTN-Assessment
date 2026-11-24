import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  isReady(): Promise<boolean> {
    return this.prisma.isReady();
  }
}
