import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { Environment } from '../config/environment';

const methods = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);
const labels = ['method', 'route', 'status_code'] as const;

@Injectable()
export class HttpMetrics
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly registry = new Registry();
  private readonly count = new Counter({
    name: 'http_requests_total',
    help: 'Number of completed and aborted API HTTP requests',
    labelNames: labels,
    registers: [this.registry],
  });
  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Elapsed seconds to complete or abort an API HTTP request',
    labelNames: labels,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });
  private server?: Server;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('METRICS_ENABLED', { infer: true })) return;
    collectDefaultMetrics({ register: this.registry });
    const path = this.config.get('METRICS_PATH', { infer: true });
    const server = createServer((request, response) => {
      if (request.url !== path || request.method !== 'GET') {
        response.writeHead(404).end();
        return;
      }
      void this.scrape(response);
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(
        this.config.get('METRICS_PORT', { infer: true }),
        this.config.get('METRICS_BIND', { infer: true }),
        () => {
          server.off('error', reject);
          resolve();
        },
      );
    });
    this.server = server;
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server;
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  observe(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    if (!this.server) return;
    // Express route templates are registered by the application. Fold the
    // Swagger asset routes into one series and never fall back to the URL.
    const values = {
      method: methods.has(method) ? method : 'OTHER',
      route: route.startsWith('/api/docs') ? 'documentation' : route,
      status_code: String(statusCode),
    };
    this.count.inc(values);
    this.duration.observe(values, durationMs / 1000);
  }

  private async scrape(response: ServerResponse): Promise<void> {
    try {
      const body = await this.registry.metrics();
      response
        .writeHead(200, {
          'Content-Type': this.registry.contentType,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .end(body);
    } catch {
      response.writeHead(500).end();
    }
  }
}
