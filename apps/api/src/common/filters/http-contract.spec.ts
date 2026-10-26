import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsEmail } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../../app.setup';

class EmailDto {
  @IsEmail()
  email!: string;
}

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

@Controller('probe')
class ProbeController {
  @Post('emails')
  create(@Body() body: EmailDto) {
    return { email: body.email };
  }

  @Get('boom')
  boom(): never {
    throw new Error('database password leaked');
  }
}

describe('HTTP contract', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'CORS_ORIGIN') {
                return 'http://localhost:3000';
              }

              throw new Error(`Unexpected config key ${key}`);
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the shared body for validation errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/emails')
      .send({})
      .expect(400);

    const body: unknown = response.body;
    expect(isErrorBody(body)).toBe(true);

    if (!isErrorBody(body)) {
      return;
    }

    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.path).toBe('/api/v1/probe/emails');
    expect(typeof body.timestamp).toBe('string');
    expect(JSON.stringify(body)).not.toContain('stack');
    expect(body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('hides internal error details from the response', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/boom')
      .expect(500);

    const body: unknown = response.body;
    expect(isErrorBody(body)).toBe(true);

    if (!isErrorBody(body)) {
      return;
    }

    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.error).toBe('Internal Server Error');
    expect(body.path).toBe('/api/v1/probe/boom');
    expect(typeof body.timestamp).toBe('string');
    expect(JSON.stringify(body)).not.toContain('leaked');
    expect(JSON.stringify(body)).not.toContain('Error:');
  });
});
