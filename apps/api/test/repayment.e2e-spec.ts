import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Repayment endpoint', () => {
  let app: INestApplication<Server>;
  let token: string;
  const post = () =>
    request(app.getHttpServer()).post('/api/v1/contracts/calculate');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
    token = await app
      .get(JwtService)
      .signAsync({ sub: randomUUID() }, { expiresIn: 900 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns all reference options in ascending order even with PostgreSQL unavailable', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    await post()
      .auth(token, { type: 'bearer' })
      .send({ deviceAmount: '15000' })
      .expect(200, {
        currency: 'ZAR',
        deviceAmount: '15000.00',
        annualInterestRate: '6.500000',
        calculationMethod: 'reducing-balance-amortisation',
        options: [
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
        ],
      });
  });

  it('requires a valid JWT', async () => {
    await post().send({ deviceAmount: '15000.00' }).expect(401);
    await post()
      .auth('invalid', { type: 'bearer' })
      .send({ deviceAmount: '15000.00' })
      .expect(401);
  });

  it.each([
    undefined,
    null,
    15000,
    '',
    '0',
    '0.00',
    '-1.00',
    '+1.00',
    '1.001',
    '01.00',
    '15,000',
    '1e4',
    'NaN',
    'Infinity',
    '10.00\n',
    ' 12',
    '1000000000000.00',
    '906319135069.40',
  ])('rejects invalid input %p', async (deviceAmount) => {
    await post()
      .auth(token, { type: 'bearer' })
      .send({ deviceAmount })
      .expect(400);
  });

  it.each([{ annualInterestRate: '4.5' }, { termMonths: 36 }])(
    'rejects unexpected input %p',
    async (extra) => {
      await post()
        .auth(token, { type: 'bearer' })
        .send({ deviceAmount: '15000.00', ...extra })
        .expect(400);
    },
  );
});
