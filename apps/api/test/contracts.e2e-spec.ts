import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ContractRepository } from '../src/contracts/contract.repository';

const path = '/api/v1/contracts';
const target = `${path}/${randomUUID()}`;
const input = { deviceAmount: '15000', termMonths: 12 };
const bearer = { type: 'bearer' } as const;

describe('Contract HTTP validation', () => {
  let app: INestApplication<Server>;
  let token: string;
  const list = jest.fn();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ContractRepository)
      .useValue({ list })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    token = await app
      .get(JwtService)
      .signAsync({ sub: randomUUID() }, { expiresIn: 900 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('requires valid JWTs for all CRUD routes', async () => {
    await http().post(path).send(input).expect(401);
    await http().get(path).auth('invalid', bearer).expect(401);
    await http().get(target).expect(401);
    await http().patch(target).send({ termMonths: 24 }).expect(401);
    await http().delete(target).expect(401);
  });

  it.each([
    {},
    { ...input, deviceAmount: '1e3' },
    { ...input, deviceAmount: '0.00' },
    { ...input, termMonths: 18 },
    { ...input, termMonths: '12' },
    { ...input, userId: randomUUID() },
    { ...input, interestRate: '1' },
    { ...input, monthlyRepayment: '1' },
    { ...input, finalRepayment: '1' },
    { ...input, totalRepayment: '1' },
    { ...input, totalInterest: '1' },
  ])('rejects invalid creation input %p', async (body) => {
    await http().post(path).auth(token, bearer).send(body).expect(400);
  });

  it.each([
    {},
    { deviceAmount: null },
    { termMonths: null },
    { termMonths: 13 },
    { deviceAmount: '1.001' },
    { userId: randomUUID() },
    { calculationVersion: 2 },
    { id: randomUUID() },
    { createdAt: '2026-11-25' },
    { totalRepayment: '10' },
  ])('rejects invalid patch %p', async (body) => {
    await http().patch(target).auth(token, bearer).send(body).expect(400);
  });

  it('rejects invalid UUIDs on item routes', async () => {
    const invalid = `${path}/invalid-id`;
    await http().get(invalid).auth(token, bearer).expect(400);
    await http()
      .patch(invalid)
      .auth(token, bearer)
      .send({ termMonths: 12 })
      .expect(400);
    await http().delete(invalid).auth(token, bearer).expect(400);
  });

  it.each([
    'page=0',
    'page=1000001',
    'page=2.5',
    'page=1&page=2',
    'pageSize=0',
    'pageSize=101',
    'pageSize=1e1',
    'userId=foreign',
  ])('rejects invalid pagination %s', async (query) => {
    await http().get(`${path}?${query}`).auth(token, bearer).expect(400);
  });

  it('returns a generic error for persistence failures', async () => {
    list.mockRejectedValueOnce(new Error('fixture database secret'));
    await http()
      .get(path)
      .auth(token, bearer)
      .expect(500, { statusCode: 500, message: 'Internal server error' });
  });
});
