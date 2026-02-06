import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestContext } from '../interfaces/request-context.interface';

export const ReqContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext | undefined => {
  const request = ctx.switchToHttp().getRequest();
  const req = request as { traceId?: string; requestId?: string; tenantOrgId?: string; userId?: string; roles?: string[] };
  return {
    traceId: req.traceId ?? '',
    requestId: req.requestId ?? '',
    tenantOrgId: req.tenantOrgId,
    userId: req.userId,
    roles: req.roles,
  };
});
