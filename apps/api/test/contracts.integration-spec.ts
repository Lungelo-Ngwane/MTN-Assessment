import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import type { ContractRecord } from '../src/contracts/contract.repository';
import { PrismaService } from '../src/database/prisma.service';

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
  let bob: string;
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
    bob = await account('crud-bob@example.test');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns an empty owner-scoped page with defaults', async () => {
    await http()
      .get(path)
      .auth(alice, bearer)
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
    const foreign = await create(bob, 12);
    const first = await create(alice, 12);
    const second = await create(alice, 24);
    await prisma.client.contract.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { createdAt: new Date('2099-01-01T00:00:00Z') },
    });
    const ids = [first.id, second.id].sort().reverse();
    for (let page = 1; page <= 2; page++) {
      const response = await http()
        .get(path)
        .query({ page, pageSize: 1 })
        .auth(alice, bearer)
        .expect(200);
      expect(response.body).toMatchObject({ items: [{ id: ids[page - 1] }] });
      const body = response.body as {
        pagination: { total: number; totalPages: number };
      };
      expect(body.pagination.totalPages).toBe(body.pagination.total);
    }
    const hidden = await http()
      .get(`${path}/${foreign.id}`)
      .auth(alice, bearer)
      .expect(404);
    const missing = await http()
      .get(`${path}/${randomUUID()}`)
      .auth(alice, bearer)
      .expect(404);
    expect(hidden.body).toEqual(missing.body);
    await http()
      .patch(`${path}/${foreign.id}`)
      .auth(alice, bearer)
      .send({ termMonths: 36 })
      .expect(404);
    await http()
      .delete(`${path}/${foreign.id}`)
      .auth(alice, bearer)
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

  it('serializes concurrent partial updates and rolls back a rejected recalculation', async () => {
    const contract = await create(alice, 12);
    const target = `${path}/${contract.id}`;
    const patch = (body: object) =>
      http().patch(target).auth(alice, bearer).send(body);
    await Promise.all([
      patch({ deviceAmount: '7999.99' }).expect(200),
      patch({ termMonths: 24 }).expect(200),
    ]);
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
      new Date(contract.updatedAt).getTime(),
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
