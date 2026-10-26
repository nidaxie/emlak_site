import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestPath } from '../http/request-path';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const multer = readMulter(exception);
    const status = multer
      ? multer.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, error } = multer
      ? { message: multer.message, error: multer.error }
      : this.readException(exception, status);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${requestPath(request)}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: requestPath(request),
    });
  }

  private readException(exception: unknown, status: number) {
    if (!(exception instanceof HttpException)) {
      return {
        message: 'Internal server error',
        error: 'Internal Server Error',
      };
    }

    const body = exception.getResponse();

    if (typeof body === 'string') {
      return {
        message: body,
        error: exception.name.replace(/Exception$/, '') || HttpStatus[status],
      };
    }

    const record = body as { message?: string | string[]; error?: string };

    return {
      message: record.message ?? exception.message,
      error: record.error ?? HttpStatus[status] ?? 'Error',
    };
  }
}

function readMulter(exception: unknown) {
  if (!(exception instanceof Error) || exception.name !== 'MulterError') {
    return null;
  }

  const code = 'code' in exception ? String(exception.code) : '';

  if (code === 'LIMIT_FILE_SIZE') {
    return {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'File is too large',
      error: 'Payload Too Large',
    };
  }

  return {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid upload',
    error: 'Bad Request',
  };
}
