import {
  BadGatewayException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/environment';
import { configureApp } from '../src/configure-app';
import { ContractRepository } from '../src/contracts/contract.repository';
import { UserRepository } from '../src/users/user.repository';
import { expectApiError } from './expect-api-error';

const contracts = '/api/v1/contracts';
const health = '/api/v1/health';
const email = 'private-fixture@example.test';
const password = 'private fixture password';
const cookie = 'private-fixture-cookie';
const database = 'postgresql://secret:private-fixture-db@host/test';
const injectedId = 'untrusted-inbound-id';
const bearer = { type: 'bearer' } as const;

describe('HTTP errors and request correlation', () => {
  let app: INestApplication<Server>;
  let token: string;
  const lines: string[] = [];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const config = new ConfigService(
      validateEnvironment({ ...process.env, LOG_LEVEL: 'info' }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
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

  beforeEach(() => {
    lines.length = 0;
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string' && chunk.startsWith('{')) lines.push(chunk);
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  function logFor(response: Response) {
    const requestId: unknown = response.headers['x-request-id'];
    const logs = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry.requestId === requestId);
    expect(logs).toHaveLength(1);
    return logs[0];
  }

  it('isolates concurrent request context and logs safe route templates and timings', async () => {
    const [success, invalid, missing, denied] = await Promise.all([
      http()
        .get(`${health}?email=${email}`)
        .set('X-Request-ID', injectedId)
        .expect(200, { status: 'ok' }),
      http()
        .post(contracts)
        .auth(token, bearer)
        .set('Cookie', `session=${cookie}`)
        .send({ deviceAmount: 15000, termMonths: 12, password })
        .expect(400),
      http().get(`/unknown/${email}?token=${token}`).expect(404),
      http().get(`${contracts}/${randomUUID()}`).expect(401),
    ]);
    expectApiError(invalid, 400, 'VALIDATION_FAILED');
    expectApiError(missing, 404, 'ROUTE_NOT_FOUND');
    expectApiError(denied, 401, 'UNAUTHORIZED', 'Unauthorized');
    const ids = [success, invalid, missing, denied].map(
      (response) => response.headers['x-request-id'] as unknown,
    );
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain(injectedId);
    expect(logFor(success)).toMatchObject({
      level: 30,
      event: 'http_request_completed',
      method: 'GET',
      route: '/api/v1/health',
      statusCode: 200,
    });
    const badLog = logFor(invalid);
    expect(badLog).toMatchObject({
      level: 40,
      event: 'http_request_completed',
      method: 'POST',
      route: '/api/v1/contracts',
      statusCode: 400,
      errorCode: 'VALIDATION_FAILED',
    });
    expect(typeof badLog?.durationMs).toBe('number');
    expect(badLog?.durationMs).toBeGreaterThanOrEqual(0);
    expect(logFor(missing)).toMatchObject({
      route: 'unmatched',
      errorCode: 'ROUTE_NOT_FOUND',
    });
    expect(logFor(denied)).toMatchObject({
      route: '/api/v1/contracts/:id',
      errorCode: 'UNAUTHORIZED',
    });
    for (const secret of [email, password, cookie, token, injectedId]) {
      expect(lines.join('')).not.toContain(secret);
    }
  });

  it('assigns context before parsing and preserves security headers on parser errors', async () => {
    const response = await http()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"password":"${password}",`)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(400);
    expectApiError(response, 400, 'MALFORMED_JSON');
    expect(logFor(response)).toMatchObject({
      route: 'unmatched',
      errorCode: 'MALFORMED_JSON',
    });
    expect(response.text).not.toContain(password);
    expect(lines.join('')).not.toContain(password);
  });

  it('rejects reserved keys that Nest would otherwise strip before validation', async () => {
    const response = await http()
      .post(contracts)
      .auth(token, bearer)
      .set('Content-Type', 'application/json')
      .send(
        '{"deviceAmount":"15000","termMonths":12,"__proto__":{},"constructor":{}}',
      )
      .expect(400);
    expectApiError(response, 400, 'VALIDATION_FAILED');
  });

  it('logs unexpected exceptions once without exposing strings, stack traces, or SQL', async () => {
    jest
      .spyOn(app.get(UserRepository), 'findCredentialsByEmail')
      .mockRejectedValueOnce(
        new Error(`SELECT FROM private-table ${database} ${email} ${password}`),
      );
    const response = await http()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(500);
    expectApiError(response, 500, 'INTERNAL_ERROR', 'Internal Server Error');
    expect(logFor(response)).toMatchObject({
      level: 50,
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
    });
    expect(lines).toHaveLength(1);
    for (const sensitive of ['SELECT', database, email, password, 'stack']) {
      expect(response.text).not.toContain(sensitive);
      expect(lines.join('')).not.toContain(sensitive);
    }
  });

  it('maps database unavailability and preserves the readiness response', async () => {
    const response = await http()
      .get(contracts)
      .auth(token, bearer)
      .expect(503);
    expectApiError(response, 503, 'DATABASE_UNAVAILABLE');
    expect(logFor(response)).toMatchObject({
      level: 50,
      statusCode: 503,
      errorCode: 'DATABASE_UNAVAILABLE',
    });
    const readiness = await http()
      .get(`${health}/ready`)
      .expect(503, { status: 'unavailable' });
    expect(logFor(readiness)).toMatchObject({ level: 50, statusCode: 503 });
  });

  it('returns correlated 503s when credential lookup or contract insertion cannot connect', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(503);
    const create = await http()
      .post(contracts)
      .auth(token, bearer)
      .send({ deviceAmount: '15000.00', termMonths: 12 })
      .expect(503);
    for (const response of [login, create]) {
      expectApiError(response, 503, 'DATABASE_UNAVAILABLE');
      expect(logFor(response)).toMatchObject({
        level: 50,
        errorCode: 'DATABASE_UNAVAILABLE',
      });
      expect(response.text).not.toContain('127.0.0.1');
    }
  });

  it('rejects unsupported JSON charsets before authentication without exposing the body', async () => {
    const response = await http()
      .post(contracts)
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(JSON.stringify({ password }))
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(415);
    expectApiError(response, 415, 'UNSUPPORTED_MEDIA_TYPE');
    expect(logFor(response)).toMatchObject({
      level: 40,
      route: 'unmatched',
      statusCode: 415,
    });
    expect(response.text).not.toContain(password);
    expect(lines.join('')).not.toContain(password);
  });

  it('keeps an upstream HTTP status but discards its internal error message', async () => {
    jest
      .spyOn(app.get(ContractRepository), 'list')
      .mockRejectedValueOnce(new BadGatewayException(database));
    const response = await http()
      .get(contracts)
      .auth(token, bearer)
      .expect(502);
    expectApiError(response, 502, 'INTERNAL_ERROR', 'Internal Server Error');
    expect(logFor(response)).toMatchObject({
      level: 50,
      statusCode: 502,
      errorCode: 'INTERNAL_ERROR',
    });
    expect(response.text).not.toContain(database);
    expect(lines.join('')).not.toContain(database);
  });

  it('uses a generic authorisation message for forbidden operations', async () => {
    jest
      .spyOn(app.get(ContractRepository), 'list')
      .mockRejectedValueOnce(new ForbiddenException(email));
    const response = await http()
      .get(contracts)
      .auth(token, bearer)
      .expect(403);
    expectApiError(response, 403, 'FORBIDDEN', 'Forbidden');
    expect(response.text).not.toContain(email);
  });

  it('defensively redacts sensitive fields in Pino payloads and serializes errors safely', () => {
    app.get(Logger).log({
      event: 'redaction_probe',
      email,
      password,
      passwordHash: password,
      DATABASE_URL: database,
      nested: { accessToken: token, cookie },
      err: new Error(`Private stack ${database}`),
    });
    expect(lines).toHaveLength(1);
    expect(lines.join('')).toContain('"event":"redaction_probe"');
    expect(lines.join('')).toContain('Error details omitted');
    for (const secret of [
      email,
      password,
      cookie,
      token,
      database,
      'Private stack',
    ]) {
      expect(lines.join('')).not.toContain(secret);
    }
  });
});
