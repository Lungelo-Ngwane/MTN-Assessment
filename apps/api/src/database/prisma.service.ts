import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Environment } from '../config/environment';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly client: PrismaClient;

  constructor(config: ConfigService<Environment, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: 2_000,
      query_timeout: 3_000,
    });
    this.client = new PrismaClient({ adapter });
  }

  async isReady(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}
