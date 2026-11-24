import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';

const root = '/api/v1/auth';
const email = 'member@example.test';
const password = '  correct phrase! 🔑  ';

describe('Authentication with PostgreSQL', () => {
  let app: INestApplication<Server>;
  let jwt: JwtService;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const login = (name = email, value = password) =>
    http().post(`${root}/login`).send({ email: name, password: value });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
    prisma = app.get(PrismaService);
    await http().post(`${root}/register`).send({ email, password }).expect(201);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('normalizes registration, stores an Argon2id hash and returns a profile', async () => {
    const response = await http()
      .post(`${root}/register`)
      .send({ email: '  New.Member@Example.TEST  ', password })
      .expect(201);
    expect(response.body).toEqual({
      id: expect.any(String) as unknown,
      email: 'new.member@example.test',
      createdAt: expect.any(String) as unknown,
      updatedAt: expect.any(String) as unknown,
    });
    const stored = await prisma.client.user.findUniqueOrThrow({
      where: { email: 'new.member@example.test' },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toBe(password);
  });

  it('accepts only one concurrent registration for the normalized email', async () => {
    const register = (address: string) =>
      http().post(`${root}/register`).send({ email: address, password });
    const responses = await Promise.all([
      register(' Concurrent@Example.Test '),
      register('concurrent@example.test'),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    await register('CONCURRENT@example.test').expect(409);
    await expect(
      prisma.client.user.count({ where: { email: 'concurrent@example.test' } }),
    ).resolves.toBe(1);
  });

  it('logs in with a normalized email and returns only token metadata and a safe profile', async () => {
    const response = await login('  MEMBER@EXAMPLE.TEST  ').expect(200);
    const body = response.body as {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    };
    expect(body).toEqual({
      accessToken: expect.any(String) as unknown,
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const claims = jwt.decode<Record<string, unknown>>(body.accessToken);
    expect(Object.keys(claims).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'sub',
    ]);
    expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
    const me = await http()
      .get(`${root}/me`)
      .auth(body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(me.body).toEqual({
      id: claims.sub,
      email,
      createdAt: expect.any(String) as unknown,
      updatedAt: expect.any(String) as unknown,
    });
  });

  it('uses the same credential rejection for incorrect passwords and unknown emails', async () => {
    const wrong = await login(email, 'wrong passphrase').expect(401);
    const unknown = await login('missing@example.test').expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body).toMatchObject({ message: 'Invalid email or password' });
  });

  it('rejects tokens for nonexistent and deleted users', async () => {
    const reject = (token: string) =>
      http().get(`${root}/me`).auth(token, { type: 'bearer' }).expect(401);
    await reject(
      await jwt.signAsync({ sub: randomUUID() }, { expiresIn: 900 }),
    );
    const address = 'deleted@example.test';
    await http()
      .post(`${root}/register`)
      .send({ email: address, password })
      .expect(201);
    const response = await login(address).expect(200);
    const { accessToken } = response.body as { accessToken: string };
    await prisma.client.user.delete({ where: { email: address } });
    await reject(accessToken);
  });
});
