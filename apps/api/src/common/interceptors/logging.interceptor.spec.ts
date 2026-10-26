import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Logger,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();
  let lines: string[];

  beforeEach(() => {
    lines = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message) => {
      lines.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function contextFor(request: Record<string, unknown>, statusCode = 200) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
  }

  it('logs method, path, status and duration without secrets', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(
      interceptor.intercept(
        contextFor({
          method: 'POST',
          url: '/api/v1/auth/login?refresh=refresh-token',
          originalUrl: '/api/v1/auth/login?refresh=refresh-token',
          headers: {
            authorization: 'Bearer secret-token',
            cookie: 'refresh_token=refresh-token',
          },
          body: { email: 'user@example.com', password: 'password123' },
        }),
        next,
      ),
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^POST \/api\/v1\/auth\/login 200 \d+ms$/);
    expect(lines[0]).not.toContain('secret-token');
    expect(lines[0]).not.toContain('Bearer');
    expect(lines[0]).not.toContain('refresh-token');
    expect(lines[0]).not.toContain('password123');
  });

  it('logs the error status and leaves the exception to the filter', async () => {
    const next: CallHandler = {
      handle: () => throwError(() => new HttpException('Missing field', 400)),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextFor({ method: 'POST', url: '/api/v1/health' }, 200),
          next,
        ),
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(lines[0]).toMatch(/^POST \/api\/v1\/health 400 \d+ms$/);
  });
});
