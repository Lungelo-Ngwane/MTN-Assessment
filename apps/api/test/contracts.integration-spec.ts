import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import type { ContractRecord } from '../src/contracts/contract.repository';
import { PrismaService } from '../src/database/prisma.service';
import { expectApiError } from './expect-api-error';

const path = '/api/v1/contracts';
const options = [
  {
    termMonths: 12,
    monthlyRepayment: '1294.45',
    finalRepayment: '1294.41',
    totalRepayment: '15533.36',
    totalInterest: '533.36',
  },
  {
    termMonths: 24,
    monthlyRepayment: '668.19',
    finalRepayment: '668.28',
    totalRepayment: '16036.65',
    totalInterest: '1036.65',
  },
  {
    termMonths: 36,
    monthlyRepayment: '459.74',
    finalRepayment: '459.56',
    totalRepayment: '16550.46',
    totalInterest: '1550.46',
  },
] as const;

describe('Contract CRUD against PostgreSQL', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let alice: string;
  const http = () => request(app.getHttpServer());
  const bearer = { type: 'bearer' } as const;

  async function account(email: string) {
    const credentials = { email, password: 'A contracts fixture password' };
    await http().post('/api/v1/auth/register').send(credentials).expect(201);
    const response = await http()
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  async function create(token: string, termMonths: number) {
    const response = await http()
      .post(path)
      .auth(token, bearer)
      .send({ deviceAmount: '15000', termMonths })
      .expect(201);
    return response.body as ContractRecord;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    alice = await account('crud-alice@example.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns an empty owner-scoped page with defaults', async () => {
    const emptyOwner = await account('crud-empty@example.test');
    await http()
      .get(path)
      .auth(emptyOwner, bearer)
      .expect(200, {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
  });

  it('stores complete and accurate snapshots for all three terms', async () => {
    for (const option of options) {
      const record = await create(alice, option.termMonths);
      expect(record).toMatchObject({
        ...option,
        deviceAmount: '15000.00',
        interestRate: '6.500000',
        calculationMethod: 'reducing-balance-amortisation',
        calculationVersion: 1,
      });
      const saved = await prisma.client.contract.findUniqueOrThrow({
        where: { id: record.id },
      });
      expect(saved.userId).toBe(record.userId);
      expect(saved.calculationVersion).toBe(1);
      expect(saved.monthlyRepayment.toFixed(2)).toBe(option.monthlyRepayment);
      expect(saved.finalRepayment?.toFixed(2)).toBe(option.finalRepayment);
      expect(saved.totalRepayment.toFixed(2)).toBe(option.totalRepayment);
      expect(saved.totalInterest.toFixed(2)).toBe(option.totalInterest);
    }
  });

  it('makes foreign objects indistinguishable from missing ones and paginates by date and ID', async () => {
    const owner = await account('crud-pagination-owner@example.test');
    const bob = await account('crud-pagination-other@example.test');
    const foreign = await create(bob, 12);
    const first = await create(owner, 12);
    const second = await create(owner, 24);
    await prisma.client.contract.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { createdAt: new Date('2099-01-01T00:00:00Z') },
    });
    const ids = [first.id, second.id].sort().reverse();
    for (let page = 1; page <= 2; page++) {
      const response = await http()
        .get(path)
        .query({ page, pageSize: 1 })
        .auth(owner, bearer)
        .expect(200);
      expect(response.body).toMatchObject({ items: [{ id: ids[page - 1] }] });
      const body = response.body as {
        pagination: { total: number; totalPages: number };
      };
      expect(body.pagination.totalPages).toBe(body.pagination.total);
      expect(body.pagination.total).toBe(2);
    }
    const hidden = await http()
      .get(`${path}/${foreign.id}`)
      .auth(owner, bearer)
      .expect(404);
    const missing = await http()
      .get(`${path}/${randomUUID()}`)
      .auth(owner, bearer)
      .expect(404);
    expect(expectApiError(hidden, 404, 'NOT_FOUND')).toEqual(
      expectApiError(missing, 404, 'NOT_FOUND'),
    );
    await http()
      .patch(`${path}/${foreign.id}`)
      .auth(owner, bearer)
      .send({ termMonths: 36 })
      .expect(404);
    await http()
      .delete(`${path}/${foreign.id}`)
      .auth(owner, bearer)
      .expect(404);
    await http()
      .get(`${path}/${foreign.id}`)
      .auth(bob, bearer)
      .expect(200, foreign);
    await http()
      .get(path)
      .query({ page: 2, pageSize: 1 })
      .auth(bob, bearer)
      .expect(200, {
        items: [],
        pagination: { page: 2, pageSize: 1, total: 1, totalPages: 1 },
      });
  });

  it('rejects persistence for a valid JWT whose owner no longer exists', async () => {
    const missing = '1c7a3425-7846-4ce0-9794-59d011c46acc';
    const token = await app
      .get(JwtService)
      .signAsync({ sub: missing }, { expiresIn: 900 });
    const response = await http()
      .post(path)
      .auth(token, bearer)
      .send({ deviceAmount: '15000.00', termMonths: 12 })
      .expect(401);
    expectApiError(response, 401, 'UNAUTHORIZED');
    await expect(
      prisma.client.contract.count({ where: { userId: missing } }),
    ).resolves.toBe(0);
  });

  it('serializes concurrent partial updates and rolls back a rejected recalculation', async () => {
    const contract = await create(alice, 12);
    const previousUpdate = new Date('2020-01-01T00:00:00Z');
    await prisma.client.contract.update({
      where: { id: contract.id },
      data: { updatedAt: previousUpdate },
    });
    const target = `${path}/${contract.id}`;
    const patch = (body: object) =>
      http().patch(target).auth(alice, bearer).send(body);
    let notifyLocked!: () => void;
    let notifyLockFailure!: (error: unknown) => void;
    const locked = new Promise<void>((resolve, reject) => {
      notifyLocked = resolve;
      notifyLockFailure = reject;
    });
    const blocker = prisma.client
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Contract" WHERE "id" = ${contract.id}::uuid FOR UPDATE`;
        notifyLocked();
        const deadline = performance.now() + 2_000;
        do {
          const [activity] = await prisma.client.$queryRaw<
            { waiting: number }[]
          >`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE ${'%FOR UPDATE%'} AND query LIKE ${'%"Contract"%'}
        `;
          if (activity?.waiting === 2) return;
        } while (performance.now() < deadline);
        throw new Error(
          'Expected both PATCH transactions to wait for the row lock',
        );
      })
      .catch((error: unknown) => {
        notifyLockFailure(error);
        throw new Error('Concurrency fixture failed', { cause: error });
      });
    const updates = locked.then(() =>
      Promise.all([
        patch({ deviceAmount: '7999.99' }).expect(200),
        patch({ termMonths: 24 }).expect(200),
      ]),
    );
    for (const result of await Promise.allSettled([blocker, updates])) {
      if (result.status === 'rejected') {
        throw new Error('Concurrent PATCH check failed', {
          cause: result.reason,
        });
      }
    }
    const result = await http().get(target).auth(alice, bearer).expect(200);
    expect(result.body).toMatchObject({
      deviceAmount: '7999.99',
      termMonths: 24,
      monthlyRepayment: '356.37',
      finalRepayment: '356.36',
      totalRepayment: '8552.87',
      totalInterest: '552.88',
      createdAt: contract.createdAt,
    });
    const updated = result.body as ContractRecord;
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      previousUpdate.getTime(),
    );
    await patch({ deviceAmount: '906319135069.40' }).expect(400);
    await http().get(target).auth(alice, bearer).expect(200, updated);
    const deleted = await http().delete(target).auth(alice, bearer).expect(204);
    expect(deleted.text).toBe('');
    await http().get(target).auth(alice, bearer).expect(404);
    await http().delete(target).auth(alice, bearer).expect(404);
  });

  it('enforces current snapshot constraints and rolls back failed database transactions', async () => {
    const record = await create(alice, 12);
    const where = { id: record.id };
    for (const data of [
      { termMonths: 13 },
      { deviceAmount: '0.00' },
      { finalRepayment: '-0.01' },
      { totalInterest: '533.37' },
      { finalRepayment: '1294.42' },
      { calculationVersion: null },
    ]) {
      await expect(
        prisma.client.contract.update({ where, data }),
      ).rejects.toThrow(/Contract_snapshot_/);
    }
    await expect(
      prisma.client.$transaction([
        prisma.client.contract.delete({ where }),
        prisma.client.contract.create({
          data: {
            userId: record.userId,
            deviceAmount: '100',
            termMonths: 12,
            interestRate: '6.5',
            monthlyRepayment: '10',
            totalRepayment: '120',
            totalInterest: '20',
          },
        }),
      ]),
    ).rejects.toThrow(/Contract_snapshot_/);
    await http()
      .get(`${path}/${record.id}`)
      .auth(alice, bearer)
      .expect(200, record);
  });
});
