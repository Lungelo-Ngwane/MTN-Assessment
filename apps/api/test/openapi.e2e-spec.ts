import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { validateEnvironment } from '../src/config/environment';
import { configureApp } from '../src/configure-app';
import { expectApiError } from './expect-api-error';

const root = '/api/v1';
const docs = '/api/docs';
const json = '/api/docs-json';

async function createApp(enabled: boolean) {
  const config = new ConfigService(
    validateEnvironment({
      ...process.env,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: enabled ? 'true' : undefined,
    }),
  );
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(config)
    .compile();
  const app = module.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('OpenAPI documentation', () => {
  let app: INestApplication<Server>;
  let document: OpenAPIObject;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp(true);
    const response = await http()
      .get(json)
      .expect('Content-Type', /json/)
      .expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves same-origin UI scripts and styles under the existing Helmet policy', async () => {
    const health = await http().get(`${root}/health`).expect(200);
    const html = await http()
      .get(docs)
      .expect('Content-Type', /html/)
      .expect(200);
    expect(html.text).toContain('id="swagger-ui"');
    const csp: unknown = html.headers['content-security-policy'];
    expect(csp).toBe(health.headers['content-security-policy']);
    expect(csp).toMatch(/(?:^|;)script-src 'self'(?:;|$)/);
    expect(html.headers['x-content-type-options']).toBe('nosniff');
    expect(html.text).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);

    const assets = [
      ...html.text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
    ].map(([, path]) => new URL(path ?? '', `http://localhost${docs}`));
    expect(assets.map(({ pathname }) => pathname)).toEqual(
      expect.arrayContaining([
        `${docs}/swagger-ui.css`,
        `${docs}/swagger-ui-bundle.js`,
        `${docs}/swagger-ui-init.js`,
      ]),
    );
    for (const asset of assets) {
      expect(asset.origin).toBe('http://localhost');
      await http()
        .get(asset.pathname)
        .expect(
          'Content-Type',
          asset.pathname.endsWith('.css') ? /css/ : /javascript/,
        )
        .expect(200);
    }
    const init = await http().get(`${docs}/swagger-ui-init.js`).expect(200);
    expect(init.text).toMatch(/"persistAuthorization"\s*:\s*false/);
    expect(init.text).toMatch(/"swaggerUrl"\s*:\s*"\/api\/docs-json"/);
    await http().get('/api/docs-yaml').expect(404);
  });

  it('documents every operation with its tag, security and correlation headers', () => {
    const operations = [
      [
        '/auth/register',
        'post',
        'Authentication',
        [],
        201,
        [400, 409, 413, 415, 429, 500, 503],
      ],
      [
        '/auth/login',
        'post',
        'Authentication',
        [],
        200,
        [400, 401, 413, 415, 429, 500, 503],
      ],
      [
        '/auth/me',
        'get',
        'Authentication',
        [{ bearer: [] }],
        200,
        [401, 500, 503],
      ],
      [
        '/contracts/calculate',
        'post',
        'Repayment',
        [{ bearer: [] }],
        200,
        [400, 401, 413, 415, 500],
      ],
      [
        '/contracts',
        'post',
        'Contracts',
        [{ bearer: [] }],
        201,
        [400, 401, 413, 415, 500, 503],
      ],
      [
        '/contracts',
        'get',
        'Contracts',
        [{ bearer: [] }],
        200,
        [400, 401, 500, 503],
      ],
      [
        '/contracts/{id}',
        'get',
        'Contracts',
        [{ bearer: [] }],
        200,
        [400, 401, 404, 500, 503],
      ],
      [
        '/contracts/{id}',
        'patch',
        'Contracts',
        [{ bearer: [] }],
        200,
        [400, 401, 404, 413, 415, 500, 503],
      ],
      [
        '/contracts/{id}',
        'delete',
        'Contracts',
        [{ bearer: [] }],
        204,
        [400, 401, 404, 500, 503],
      ],
      ['/health', 'get', 'Health', [], 200, [500]],
      ['/health/ready', 'get', 'Health', [], 200, [500, 503]],
    ] as const;
    expect(document.info).toMatchObject({
      title: 'Contract Repayment API',
      version: '1.0.0',
    });
    expect(document.components?.securitySchemes?.bearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(Object.keys(document.paths).sort()).toEqual(
      [...new Set(operations.map(([path]) => root + path))].sort(),
    );
    expect(
      Object.values(document.paths).reduce(
        (count, path) => count + Object.keys(path).length,
        0,
      ),
    ).toBe(operations.length);
    for (const [path, method, tag, security, success, failures] of operations) {
      const operation = document.paths[root + path]?.[method];
      expect(operation).toMatchObject({ tags: [tag], security });
      expect(operation?.summary).toEqual(expect.any(String));
      expect(operation?.description).toEqual(expect.any(String));
      expect(
        Object.keys(operation?.responses ?? {})
          .map(Number)
          .sort(),
      ).toEqual([success, ...failures].sort());
      for (const response of Object.values(operation?.responses ?? {})) {
        expect(response).toMatchObject({
          headers: {
            'X-Request-ID': { schema: { type: 'string', format: 'uuid' } },
          },
        });
      }
    }
  });

  it('describes validated inputs and preserves fixed-scale response fields and legacy nulls', () => {
    const schemas = document.components?.schemas;
    expect(schemas?.RegisterDto).toMatchObject({
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        password: {
          type: 'string',
          minLength: 12,
          maxLength: 128,
          writeOnly: true,
        },
      },
    });
    expect(schemas?.LoginDto).toMatchObject({
      properties: { password: { minLength: 1 } },
    });
    expect(schemas?.CreateContractDto).toMatchObject({
      required: ['deviceAmount', 'termMonths'],
      additionalProperties: false,
      properties: {
        deviceAmount: { type: 'string', example: '15000.00' },
        termMonths: { type: 'integer', enum: [12, 24, 36] },
      },
    });
    expect(schemas?.UpdateContractDto).toMatchObject({
      minProperties: 1,
      additionalProperties: false,
    });
    expect(schemas?.UpdateContractDto ?? {}).not.toHaveProperty('required');
    const pagination = document.paths[`${root}/contracts`]?.get?.parameters;
    for (const [name, defaultValue] of [
      ['page', '1'],
      ['pageSize', '20'],
    ]) {
      const parameter = pagination?.find(
        (item) => 'name' in item && item.name === name,
      );
      expect(parameter).toMatchObject({
        in: 'query',
        required: false,
        schema: { default: defaultValue },
      });
    }
    expect(
      document.paths[`${root}/contracts/{id}`]?.get?.parameters,
    ).toMatchObject([
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    ]);
    expect(schemas?.RepaymentQuote).toMatchObject({
      example: {
        deviceAmount: '15000.00',
        annualInterestRate: '6.500000',
        options: [
          { termMonths: 12, totalRepayment: '15533.36' },
          { termMonths: 24, totalRepayment: '16036.65' },
          { termMonths: 36, totalRepayment: '16550.46' },
        ],
      },
    });
    for (const [name, keys] of [
      [
        'RepaymentOption',
        [
          'monthlyRepayment',
          'finalRepayment',
          'totalRepayment',
          'totalInterest',
        ],
      ],
      [
        'Contract',
        [
          'deviceAmount',
          'interestRate',
          'monthlyRepayment',
          'finalRepayment',
          'totalRepayment',
          'totalInterest',
        ],
      ],
    ] as const) {
      for (const key of keys)
        expect(schemas?.[name]).toMatchObject({
          properties: { [key]: { type: 'string' } },
        });
    }
    expect(schemas?.Contract).toMatchObject({
      properties: {
        finalRepayment: { nullable: true },
        calculationMethod: { nullable: true },
        calculationVersion: { nullable: true },
      },
    });
    expect(
      document.paths[`${root}/contracts/{id}`]?.delete?.responses['204'],
    ).not.toHaveProperty('content');
  });

  it('keeps the error envelope, readiness schema and API authentication distinct', async () => {
    const schema = document.components?.schemas?.ErrorResponse;
    expect(schema).toMatchObject({
      required: ['statusCode', 'code', 'message', 'requestId', 'timestamp'],
      properties: {
        statusCode: { type: 'integer' },
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { format: 'uuid' },
        timestamp: { format: 'date-time' },
      },
    });
    expect(
      document.paths[`${root}/auth/login`]?.post?.responses['401'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
          examples: {
            INVALID_CREDENTIALS: {
              value: {
                statusCode: 401,
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
              },
            },
          },
        },
      },
    });
    expect(
      document.paths[`${root}/health/ready`]?.get?.responses['503'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/HealthUnavailable' },
        },
      },
    });
    expect(JSON.stringify(document)).not.toMatch(
      /passwordHash|JWT_SECRET|DATABASE_URL|postgresql:\/\//i,
    );
    const denied = await http().get(`${root}/contracts`).expect(401);
    expectApiError(denied, 401, 'UNAUTHORIZED');
    await http()
      .get(`${root}/health/ready`)
      .expect(503, { status: 'unavailable' });
  });
});

it('does not mount the documentation or assets by default in production', async () => {
  const app = await createApp(false);
  try {
    const http = request(app.getHttpServer());
    for (const path of [docs, json, `${docs}/swagger-ui-bundle.js`]) {
      await http.get(path).expect(404);
    }
    await http.get(`${root}/health`).expect(200);
  } finally {
    await app.close();
  }
});
