import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ContractRepository } from '../src/contracts/contract.repository';
import { PrismaService } from '../src/database/prisma.service';
import {
  DuplicateEmailError,
  UserRepository,
} from '../src/users/user.repository';

const snapshot = {
  deviceAmount: '123456789012.34',
  termMonths: 24,
  interestRate: '6.500001',
  monthlyRepayment: '500.10',
  totalRepayment: '12000.00',
  totalInterest: '0.01',
};

describe('PostgreSQL persistence', () => {
  let app: INestApplication<Server>;
  let users: UserRepository;
  let contracts: ContractRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
    users = app.get(UserRepository);
    contracts = app.get(ContractRepository);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports readiness against the migrated database', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200, { status: 'ok' });
  });

  it('persists a user, filters the password hash, and enforces unique email', async () => {
    const data = {
      email: 'unique@example.test',
      passwordHash: 'test-fixture-hash',
    };
    const saved = await users.create(data);
    expect(saved.email).toBe(data.email);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved).not.toHaveProperty('passwordHash');
    await expect(users.findByEmail(data.email)).resolves.toEqual(saved);
    await expect(users.findByEmail('absent@example.test')).resolves.toBeNull();
    await expect(users.create(data)).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
    await expect(
      prisma.client.user.findUnique({ where: { id: saved.id } }),
    ).resolves.toMatchObject(data);
  });

  it('round-trips fixed-scale decimals and scopes the lookup by owner', async () => {
    const owner = await users.create({
      email: 'owner@example.test',
      passwordHash: 'test-fixture-hash',
    });
    const other = await users.create({
      email: 'other@example.test',
      passwordHash: 'test-fixture-hash',
    });
    const data = { ...snapshot, userId: owner.id };
    const saved = await contracts.create(data);
    await contracts.create({ ...snapshot, userId: other.id });
    expect(saved).toMatchObject(data);
    await expect(contracts.findByUserId(owner.id)).resolves.toEqual([saved]);
    await expect(
      prisma.client.user.delete({ where: { id: owner.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a contract whose owner does not exist', async () => {
    await expect(
      contracts.create({ ...snapshot, userId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a nonpositive term and negative monetary values at the database', async () => {
    const { id: userId } = await users.create({
      email: 'checks@example.test',
      passwordHash: 'test-fixture-hash',
    });
    await expect(
      contracts.create({ ...snapshot, userId, termMonths: 0 }),
    ).rejects.toThrow('Contract_positive_term');
    await expect(
      contracts.create({ ...snapshot, userId, monthlyRepayment: '-0.01' }),
    ).rejects.toThrow('Contract_nonnegative_snapshot');
  });
});
