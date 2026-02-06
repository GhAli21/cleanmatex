import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { requestContextStorage } from '../utils/request-context.storage';
import type { RequestContext } from '../interfaces/request-context.interface';
import { logger } from '../utils/logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { traceId?: string; requestId?: string }>();
    const traceId = request.traceId ?? `trc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const requestId = request.requestId ?? request.headers['x-request-id'] ?? `req_${Date.now()}`;
    request.traceId = traceId;
    request.requestId = requestId;

    const ctx: RequestContext = {
      traceId,
      requestId,
      tenantOrgId: request.tenantOrgId,
      userId: request.userId,
      roles: request.roles,
    };

    return requestContextStorage.run(ctx, () => {
      logger.info('Request', { method: request.method, url: request.url, traceId, requestId });
      return next.handle().pipe(
        tap({
          next: () => logger.debug('Response', { traceId, requestId }),
          error: (err: Error) => logger.error('Response error', { traceId, requestId, error: err?.message }),
        }),
      ) as Observable<unknown>;
    });
  }
}
