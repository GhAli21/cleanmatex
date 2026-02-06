import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { IdempotencyStore } from '../services/idempotency.store';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: IdempotencyStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { idempotencyKey?: string }>();
    const key = request.headers['idempotency-key'] as string | undefined;
    if (!key?.trim()) {
      return next.handle() as Observable<unknown>;
    }
    request.idempotencyKey = key.trim();
    const cached = this.store.get(key.trim());
    if (cached) {
      return of(cached);
    }
    return next.handle().pipe(
      tap((response: unknown) => {
        if (response !== undefined && request.idempotencyKey) {
          this.store.set(request.idempotencyKey, response, IDEMPOTENCY_TTL_MS);
        }
      }),
    ) as Observable<unknown>;
  }
}
