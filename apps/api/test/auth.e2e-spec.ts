import { INestApplication, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { UserRepository } from '../src/users/user.repository';

const root = '/api/v1/auth';
const valid = { email: 'client@example.test', password: 'test passphrase!' };

describe('Authentication HTTP boundaries', () => {
  let app: INestApplication<Server>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    { ...valid, email: 'invalid' },
    { ...valid, email: 123 },
    { ...valid, password: 123 },
    { ...valid, password: 'too-short' },
    { ...valid, password: 'x'.repeat(129) },
    { ...valid, unexpected: 'input' },
  ])('rejects an invalid registration body', async (body) => {
    await http().post(`${root}/register`).send(body).expect(400);
  });

  it('rejects unknown fields on login too', async () => {
    await http()
      .post(`${root}/login`)
      .send({ ...valid, role: 'admin' })
      .expect(400);
  });

  it('limits body sizes and redacts invalid JSON errors', async () => {
    await http()
      .post(`${root}/register`)
      .send({ ...valid, password: 'x'.repeat(17000) })
      .expect(413);
    await http()
      .post(`${root}/register`)
      .type('json')
      .send('fixture-private-token')
      .expect(400, {
        statusCode: 400,
        message: 'Bad Request',
      });
  });

  it('sends security headers and allows only explicitly configured browser origins', async () => {
    await http()
      .get('/api/v1/health')
      .set('Origin', 'https://client.example.test')
      .expect('Access-Control-Allow-Origin', 'https://client.example.test')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(200);
    const denied = await http()
      .get('/api/v1/health')
      .set('Origin', 'https://other.example.test')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('rejects missing, malformed, tampered, expired and invalid JWT claims', async () => {
    const jwt = app.get(JwtService);
    const sub = randomUUID();
    const signed = await jwt.signAsync({ sub }, { expiresIn: 900 });
    const [header, payload, signature] = signed.split('.');
    const tampered = `${header}.${payload}.${signature?.startsWith('a') ? 'b' : 'a'}${signature?.slice(1)}`;
    const tokens = [
      'not-a-jwt',
      tampered,
      await jwt.signAsync({ sub }, { expiresIn: -60 }),
      await jwt.signAsync({ sub }, { expiresIn: 900, issuer: 'wrong-issuer' }),
      await jwt.signAsync(
        { sub },
        { expiresIn: 900, audience: 'wrong-audience' },
      ),
      await jwt.signAsync({ sub }, { expiresIn: 900, algorithm: 'HS384' }),
      await jwt.signAsync({ sub: 'not-a-uuid' }, { expiresIn: 900 }),
      await jwt.signAsync({ sub }),
    ];
    await http().get(`${root}/me`).expect(401);
    for (const token of tokens) {
      await http()
        .get(`${root}/me`)
        .auth(token, { type: 'bearer' })
        .expect(401);
    }
  });

  it('sanitizes unexpected persistence errors before sending or logging them', async () => {
    const lookup = jest
      .spyOn(app.get(UserRepository), 'findCredentialsByEmail')
      .mockRejectedValue(new Error('fixture-private-token'));
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await http().post(`${root}/login`).send(valid).expect(500, {
        statusCode: 500,
        message: 'Internal Server Error',
      });
      expect(log).toHaveBeenCalledWith('Authentication request failed');
    } finally {
      lookup.mockRestore();
      log.mockRestore();
    }
  });

  it('limits authentication attempts and ignores forwarded IP headers', async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await http()
        .post(`${root}/register`)
        .set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
        .send({});
      if (response.status === 429) {
        await http()
          .post(`${root}/register`)
          .set('X-Forwarded-For', '198.51.100.1')
          .send({})
          .expect(429);
        await http().get('/api/v1/health').expect(200);
        return;
      }
      expect(response.status).toBe(400);
    }
    throw new Error('Expected the authentication rate limit to apply');
  });
});
