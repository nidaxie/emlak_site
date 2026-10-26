import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, tap, throwError } from 'rxjs';
import { requestPath } from '../http/request-path';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const path = requestPath(request);
    const started = Date.now();

    const write = (statusCode: number) => {
      this.logger.log(
        `${method} ${path} ${statusCode} ${Date.now() - started}ms`,
      );
    };

    return next.handle().pipe(
      tap(() => {
        const statusCode = context.switchToHttp().getResponse<{
          statusCode?: number;
        }>().statusCode;

        write(statusCode ?? 200);
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;

        write(statusCode);

        return throwError(() => error);
      }),
    );
  }
}
