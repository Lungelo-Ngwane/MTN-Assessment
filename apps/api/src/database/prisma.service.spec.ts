import { ConfigService } from '@nestjs/config';
import { Environment } from '../config/environment';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService(
      new ConfigService<Environment, true>({
        DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unused',
      }),
    );
  });

  it('uses a lightweight connectivity query', async () => {
    const query = jest
      .spyOn(prisma.client, '$queryRaw')
      .mockResolvedValue([{ '?column?': 1 }]);
    await expect(prisma.isReady()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(['SELECT 1']);
  });

  it('reports unavailable without forwarding the database error', async () => {
    jest
      .spyOn(prisma.client, '$queryRaw')
      .mockRejectedValue(new Error('Internal connection details'));
    await expect(prisma.isReady()).resolves.toBe(false);
  });

  it('disconnects the client on shutdown', async () => {
    const disconnect = jest
      .spyOn(prisma.client, '$disconnect')
      .mockResolvedValue(undefined);
    await prisma.onApplicationShutdown();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
