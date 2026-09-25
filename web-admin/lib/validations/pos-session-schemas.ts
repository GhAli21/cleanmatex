import { z } from 'zod';
import { zUuidIfEnabled } from '@/lib/validations/cmx-temp-utils-para/validators/is-uuid-if-enabled';

/** Validates the caller-controlled context required to start a POS session. */
export const posSessionOpenSchema = z.object({
  branchId: zUuidIfEnabled(),
  terminalId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  sourceChannel: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Reuses opening constraints when order entry must ensure a session exists. */
export const posSessionEnsureSchema = posSessionOpenSchema;

/** Validates a drawer link only after the finance flow has selected its session. */
export const posSessionAutoLinkDrawerSchema = z.object({
  posSessionId: z.string().uuid(),
  branchId: zUuidIfEnabled().optional(),
  cashDrawerSessionId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  sourceChannel: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Bounds optional lifecycle rationale so audit data remains safe and searchable. */
export const posSessionReasonSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  sourceChannel: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Requires an explicit rationale because force-closing bypasses normal recovery. */
export const posSessionForceCloseSchema = posSessionReasonSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

/** Validates active-session lookup options without accepting arbitrary branch IDs. */
export const posSessionBranchQuerySchema = z.object({
  branchId: zUuidIfEnabled().optional(),
  includeContext: z
    .preprocess(
      (value) => {
        if (value === undefined) return false;
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
      },
      z.boolean()
    )
    .default(false),
});

/**
 * Validates bounded, server-paged POS history filters.
 *
 * Date-pair checks prevent ambiguous range queries while preserving tenant
 * authorization as a server-side concern.
 */
export const posSessionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  branchId: zUuidIfEnabled().optional(),
  userId: zUuidIfEnabled().optional(),
  operatorQuery: z.string().trim().min(1).max(200).optional(),
  terminalQuery: z.string().trim().min(1).max(200).optional(),
  cashDrawerQuery: z.string().trim().min(1).max(200).optional(),
  terminalId: zUuidIfEnabled().optional(),
  cashDrawerId: zUuidIfEnabled().optional(),
  cashDrawerSessionId: zUuidIfEnabled().optional(),
  sessionNo: z.string().trim().min(1).max(120).optional(),
  businessDateFrom: z.coerce.date().optional(),
  businessDateTo: z.coerce.date().optional(),
  openedAtFrom: z.coerce.date().optional(),
  openedAtTo: z.coerce.date().optional(),
  status: z.enum(['OPEN', 'PAUSED', 'CLOSED', 'FORCE_CLOSED']).optional(),
  scope: z.enum(['own', 'all']).default('own'),
}).refine(
  (value) => !value.businessDateFrom || !value.businessDateTo || value.businessDateFrom <= value.businessDateTo,
  { message: 'businessDateFrom must be before or equal to businessDateTo', path: ['businessDateTo'] }
).refine(
  (value) => !value.openedAtFrom || !value.openedAtTo || value.openedAtFrom <= value.openedAtTo,
  { message: 'openedAtFrom must be before or equal to openedAtTo', path: ['openedAtTo'] }
);

/** Limits event history reads to a practical, server-controlled page size. */
export const posSessionEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
