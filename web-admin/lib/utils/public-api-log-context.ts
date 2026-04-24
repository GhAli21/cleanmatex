import { NextRequest } from 'next/server';

type BaseContextInput = {
  feature: string;
  action: string;
  traceId?: string;
};

/**
 * Builds a consistent structured logging context for public API routes.
 *
 * Keeps request metadata aligned across endpoints so logs are easier to filter
 * in Vercel/runtime log aggregators.
 */
export function buildPublicApiLogContext(
  request: NextRequest,
  input: BaseContextInput,
) {
  return {
    feature: input.feature,
    action: input.action,
    traceId: input.traceId,
    requestId: request.headers.get('x-vercel-id') ?? undefined,
    method: request.method,
    path: request.nextUrl.pathname,
  };
}
