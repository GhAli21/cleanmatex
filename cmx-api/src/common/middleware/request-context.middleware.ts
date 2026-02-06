import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string; requestId?: string }, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const traceId = (req.headers['x-trace-id'] as string) ?? `trc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    req.traceId = traceId;
    req.requestId = requestId;
    next();
  }
}
