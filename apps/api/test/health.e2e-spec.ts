import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/database/prisma/prisma.service';

function isErrorBody(body: unknown): body is {
  statusCode: number;
  error: string;
  path: string;
  timestamp: string;
  message: unknown;
} {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const record = body as Record<string, unknown>;

  return (
    typeof record.statusCode === 'number' &&
    typeof record.error === 'string' &&
    typeof record.path === 'string' &&
    typeof record.timestamp === 'string' &&
    'message' in record
  );
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports the database and PostGIS', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          status: 'ok',
          checks: {
            database: 'up',
            postgis: 'up',
          },
        });
      });
  });

  it('GET /api/v1/missing returns the standard error shape', () => {
    return request(app.getHttpServer())
      .get('/api/v1/missing')
      .expect(404)
      .expect((response) => {
        const body: unknown = response.body;
        expect(isErrorBody(body)).toBe(true);

        if (!isErrorBody(body)) {
          return;
        }

        expect(body.statusCode).toBe(404);
        expect(body.error).toBe('Not Found');
        expect(body.path).toBe('/api/v1/missing');
        expect(typeof body.timestamp).toBe('string');
        expect(body.message).toBeDefined();
        expect(JSON.stringify(body)).not.toContain('stack');
      });
  });
});

describe('Health when the database is down (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: () => Promise.reject(new Error('connect ECONNREFUSED')),
        $disconnect: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns the shared error contract', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503)
      .expect((response) => {
        const body: unknown = response.body;
        expect(isErrorBody(body)).toBe(true);

        if (!isErrorBody(body)) {
          return;
        }

        expect(body.statusCode).toBe(503);
        expect(body.message).toBe('Database unavailable');
        expect(body.error).toBe('Service Unavailable');
        expect(body.path).toBe('/api/v1/health');
        expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
        expect(JSON.stringify(body)).not.toContain('stack');
      });
  });
});
