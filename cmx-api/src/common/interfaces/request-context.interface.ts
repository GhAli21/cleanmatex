/**
 * Request-scoped context for tracing and tenant resolution.
 * Every log and error response must include traceId.
 */
export interface RequestContext {
  traceId: string;
  requestId: string;
  tenantOrgId?: string;
  userId?: string;
  roles?: string[];
}
