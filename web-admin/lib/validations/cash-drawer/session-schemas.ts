import { z } from 'zod';

import { CASH_CONTROL_COUNT_MODE } from '@/lib/constants/cash-control';
import { USER_SELECTABLE_DISPOSITIONS, CASH_DRAWER_POST_CLOSE_STATUSES } from '@/lib/constants/cash-drawer';

/**
 * Shared request schemas for the two-step drawer session lifecycle (CLF,
 * ADR-057, plan §4B.4/§4B.7 CLF-2-3). Mirrors
 * `lib/services/cash-drawer-session.service.ts`'s input types field-for-field
 * so the route layer and any client form can both import from here.
 */

function enumValues<T extends readonly [string, ...string[]]>(values: T): T {
  return values;
}

export const denominationCountLineSchema = z.object({
  denominationId: z.string().uuid(),
  quantity: z.number().int().min(0),
});

/**
 * TOTAL_ONLY needs `totalAmount`; DENOMINATION needs a non-empty breakdown.
 * The resolver (`recordCountTx`) treats DENOMINATION as authoritative over
 * any client-supplied total when both are present (defense in depth), so
 * the schema only requires — never forbids — the pairing.
 */
export const countInputSchema = z
  .object({
    countMode: z.enum(enumValues([CASH_CONTROL_COUNT_MODE.TOTAL_ONLY, CASH_CONTROL_COUNT_MODE.DENOMINATION] as const)),
    totalAmount: z.number().min(0).optional(),
    denominations: z.array(denominationCountLineSchema).optional(),
  })
  .refine((v) => v.countMode !== CASH_CONTROL_COUNT_MODE.TOTAL_ONLY || v.totalAmount != null, {
    message: 'totalAmount is required for a TOTAL_ONLY count',
    path: ['totalAmount'],
  })
  .refine((v) => v.countMode !== CASH_CONTROL_COUNT_MODE.DENOMINATION || (v.denominations && v.denominations.length > 0), {
    message: 'denominations is required and must be non-empty for a DENOMINATION count',
    path: ['denominations'],
  });

export const openSessionRequestSchema = z.object({
  openingCount: countInputSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Optional cashier the session is opened for. Empty until a POS session connects. */
  sessionUserId: z.string().uuid().optional(),
  /**
   * When present, the server sets the drawer session user from this POS session
   * and ignores `sessionUserId`. Used by the POS Sessions page so the cashier cannot drift.
   */
  posSessionId: z.string().uuid().optional(),
});

/** Opening count added later, when a session was opened without one. */
export const recordMissingOpeningCountSchema = z.object({
  openingCount: countInputSchema,
  notes: z.string().trim().max(1000).optional(),
});

export const startCloseRequestSchema = z.object({
  closingCount: countInputSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const dispositionDecisionSchema = z.object({
  currencyCode: z.string().length(3),
  dispositionCode: z.enum(enumValues(USER_SELECTABLE_DISPOSITIONS as unknown as [string, ...string[]])),
  dispositionNotes: z.string().trim().max(1000).optional(),
  destDrawerId: z.string().uuid().optional(),
  /** PARTIAL_REMOVED only — never defaulted; the operator must type the exact figure (no-silent-money-mutation rule). */
  keptAmount: z.number().min(0).optional(),
});

export const finalizeCloseRequestSchema = z.object({
  dispositions: z.array(dispositionDecisionSchema).min(1),
  varianceReason: z.string().trim().max(1000).optional(),
});

export const forceCloseRequestSchema = z.object({
  reason: z.string().trim().min(1),
  dispositions: z.array(dispositionDecisionSchema).min(1),
});

export const approveVarianceRequestSchema = z.object({
  reason: z.string().trim().min(1),
});

export const updatePostCloseRequestSchema = z.object({
  postCloseStatusCode: z.enum(enumValues(Object.values(CASH_DRAWER_POST_CLOSE_STATUSES) as [string, ...string[]])),
  notes: z.string().trim().max(1000).optional(),
});

export type OpenSessionRequest = z.infer<typeof openSessionRequestSchema>;
export type StartCloseRequest = z.infer<typeof startCloseRequestSchema>;
export type FinalizeCloseRequest = z.infer<typeof finalizeCloseRequestSchema>;
export type ForceCloseRequest = z.infer<typeof forceCloseRequestSchema>;
export type ApproveVarianceRequest = z.infer<typeof approveVarianceRequestSchema>;
export type UpdatePostCloseRequest = z.infer<typeof updatePostCloseRequestSchema>;
