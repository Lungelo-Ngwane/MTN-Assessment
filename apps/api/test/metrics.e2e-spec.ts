import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/environment';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { HttpMetrics } from '../src/monitoring/http-metrics';

describe('private HTTP metrics', () => {
  let app: INestApplication<Server>;
  let scrapeUrl: string;

  beforeEach(async () => {
    const environment = validateEnvironment({
      ...process.env,
      METRICS_ENABLED: 'true',
      METRICS_PATH: '/internal/metrics',
    });
    // Let the operating system allocate a private port for this Jest worker.
    const config = new ConfigService({ ...environment, METRICS_PORT: 0 });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(PrismaService)
      .useValue({ isReady: () => Promise.resolve(false) })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApp(app);
    await app.init();
    const address = app.get(HttpMetrics)['server']?.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected a TCP metrics listener');
    expect(address.address).toBe('127.0.0.1');
    scrapeUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('counts each HTTP outcome once and never labels by path parameters or query values', async () => {
    const api = request(app.getHttpServer());
    const first = randomUUID();
    const second = randomUUID();
    await api.get('/api/v1/health').expect(200);
    await api.get('/api/v1/health/ready').expect(503);
    await api
      .get(`/api/v1/contracts/${first}?email=private@example.test`)
      .expect(401);
    await api.get(`/api/v1/contracts/${second}`).expect(401);
    await api.get('/unknown/private').expect(404);

    const scrape = () =>
      request(scrapeUrl).get('/internal/metrics').expect(200);
    const metrics = (await scrape()).text;
    expect(metrics).toContain('process_cpu_user_seconds_total');
    for (const [route, status, count] of [
      ['/api/v1/health', 200, 1],
      ['/api/v1/health/ready', 503, 1],
      ['/api/v1/contracts/:id', 401, 2],
      ['unmatched', 404, 1],
    ]) {
      const labels = `{method="GET",route="${route}",status_code="${status}"} ${count}`;
      expect(metrics.split('\n')).toContain(`http_requests_total${labels}`);
      expect(metrics.split('\n')).toContain(
        `http_request_duration_seconds_count${labels}`,
      );
    }
    for (const value of [
      first,
      second,
      'private@example.test',
      '/unknown/private',
    ])
      expect(metrics).not.toContain(value);
    expect((await scrape()).text).not.toContain('route="/internal/metrics"');
  });

  it('serves only GET on the private configured path', async () => {
    const api = request(app.getHttpServer());
    await api.get('/internal/metrics').expect(404);
    await api.get('/metrics').expect(404);
    await request(scrapeUrl).get('/metrics').expect(404);
    await request(scrapeUrl).post('/internal/metrics').expect(404);
    await request(scrapeUrl)
      .get('/internal/metrics')
      .expect('Cache-Control', 'no-store')
      .expect('Content-Type', /text\/plain/)
      .expect(200);
  });
});
