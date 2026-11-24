import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Health endpoint', () => {
  let app: INestApplication<Server>;

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

  it('returns HTTP 200 with the liveness payload', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect('Content-Type', /json/)
      .expect(200, { status: 'ok' });
  });

  it.each(['/health', '/v1/health', '/api/health', '/api/v2/health'])(
    'returns HTTP 404 for %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(404);
    },
  );
});
