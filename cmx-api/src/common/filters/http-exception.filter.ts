import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getTraceId } from '../utils/request-context.storage';

interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  traceId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = getTraceId() ?? (request as Request & { traceId?: string }).traceId ?? 'unknown';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const body: Record<string, unknown> =
      typeof message === 'object' && message !== null ? (message as Record<string, unknown>) : { message };

    const errorResponse: ErrorResponse = {
      code: exception instanceof HttpException ? `HTTP_${status}` : 'INTERNAL_ERROR',
      message: typeof body.message === 'string' ? body.message : String(message),
      details: body.details,
      traceId,
    };

    this.logger.error(errorResponse.message, { traceId, status, path: request.url });

    response.status(status).json(errorResponse);
  }
}
