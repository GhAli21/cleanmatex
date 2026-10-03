import { z } from 'zod';
import { ORDER_CHANGE_LIMITS, ORDER_CHANGE_OPERATION_CODES } from '@/lib/constants/order-change';

const uuidSchema = z.string().uuid();
const clientRefSchema = uuidSchema;
const optionalReasonSchema = z.object({ reason: z.string().trim().max(ORDER_CHANGE_LIMITS.MAX_CHANGE_REASON_LENGTH).optional() }).strict();
const orderTargetSchema = z.object({ kind: z.literal('ORDER') }).strict();
const persistedItemTargetSchema = z.object({ kind: z.literal('PERSISTED_ITEM'), id: uuidSchema }).strict();
const persistedPieceTargetSchema = z.object({ kind: z.literal('PERSISTED_PIECE'), id: uuidSchema }).strict();
const persistedPreferenceTargetSchema = z.object({ kind: z.literal('PERSISTED_PREFERENCE'), id: uuidSchema }).strict();
const localItemTargetSchema = z.object({ kind: z.literal('LOCAL_ITEM'), clientRef: clientRefSchema }).strict();
const localPieceTargetSchema = z.object({ kind: z.literal('LOCAL_PIECE'), clientRef: clientRefSchema }).strict();

const operationBaseSchema = z.object({ seq: z.number().int().positive() }).strict();

/**
 * Strict V1 intent schema shared by future Preview and Apply endpoints.
 * It deliberately validates shape only: capability, catalog and hierarchy
 * authority remain server-side and are introduced by their owning packages.
 */
export const orderChangeOperationSchema = z.discriminatedUnion('code', [
  operationBaseSchema.extend({
    code: z.literal('ADD_ITEM'), target: orderTargetSchema,
    payload: z.object({ clientRef: clientRefSchema, productId: uuidSchema, quantity: z.number().int().min(1).max(999), priceOverride: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(), overrideReason: z.string().max(500).optional() }).strict(),
  }),
  operationBaseSchema.extend({ code: z.literal('REMOVE_ITEM'), target: persistedItemTargetSchema, payload: optionalReasonSchema }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_ITEM_QUANTITY'), target: persistedItemTargetSchema, payload: z.object({ quantity: z.number().int().min(1).max(999), selectedPieceIds: z.array(uuidSchema).max(ORDER_CHANGE_LIMITS.MAX_SELECTED_PIECE_IDS).optional() }).strict() }),
  operationBaseSchema.extend({ code: z.literal('ADD_PIECE'), target: z.union([persistedItemTargetSchema, localItemTargetSchema]), payload: z.object({ clientRef: clientRefSchema, color: z.string().max(50).optional(), brand: z.string().max(100).optional(), hasStain: z.boolean().optional(), hasDamage: z.boolean().optional(), notes: z.string().max(ORDER_CHANGE_LIMITS.MAX_PIECE_NOTE_LENGTH).optional() }).strict() }),
  operationBaseSchema.extend({ code: z.literal('REMOVE_PIECE'), target: persistedPieceTargetSchema, payload: optionalReasonSchema }),
  operationBaseSchema.extend({ code: z.literal('ADD_PREFERENCE'), target: z.union([orderTargetSchema, persistedItemTargetSchema, persistedPieceTargetSchema, localItemTargetSchema, localPieceTargetSchema]), payload: z.object({ clientRef: clientRefSchema, preferenceId: uuidSchema, preferenceCode: z.string().min(1).max(120), preferenceContent: z.string().max(ORDER_CHANGE_LIMITS.MAX_PREFERENCE_CONTENT_LENGTH).optional() }).strict() }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_PREFERENCE'), target: persistedPreferenceTargetSchema, payload: z.object({ preferenceContent: z.string().max(ORDER_CHANGE_LIMITS.MAX_PREFERENCE_CONTENT_LENGTH).optional() }).strict().refine((value) => value.preferenceContent !== undefined, 'Preference content is required') }),
  operationBaseSchema.extend({ code: z.literal('REMOVE_PREFERENCE'), target: persistedPreferenceTargetSchema, payload: optionalReasonSchema }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_PRIORITY'), target: orderTargetSchema, payload: z.object({ priority: z.string().min(1).max(50) }).strict() }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_SERVICE_SPEED'), target: orderTargetSchema, payload: z.object({ serviceSpeed: z.enum(['STANDARD', 'EXPRESS']) }).strict() }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_READY_BY'), target: orderTargetSchema, payload: z.object({ readyBy: z.string().datetime({ offset: true }) }).strict() }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_ORDER_NOTES'), target: orderTargetSchema, payload: z.object({ notes: z.string().max(ORDER_CHANGE_LIMITS.MAX_ORDER_NOTE_LENGTH).optional(), customerNotes: z.string().max(ORDER_CHANGE_LIMITS.MAX_ORDER_NOTE_LENGTH).optional() }).strict().refine((value) => value.notes !== undefined || value.customerNotes !== undefined, 'At least one note field is required') }),
  operationBaseSchema.extend({ code: z.literal('CHANGE_CUSTOMER_SNAPSHOT'), target: orderTargetSchema, payload: z.object({ customerName: z.string().max(255).optional(), customerMobile: z.string().max(50).optional(), customerEmail: z.string().email().max(255).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one customer snapshot field is required') }),
]);

/** Validates the common future Change request envelope without accepting unknown fields. */
export const orderChangeRequestSchema = z.object({
  expectedEditStateVersion: z.number().int().positive(),
  expectedWfStateVersion: z.number().int().positive(),
  sourceContext: z.string().min(1).max(100),
  changeReason: z.string().trim().max(ORDER_CHANGE_LIMITS.MAX_CHANGE_REASON_LENGTH).optional(),
  operations: z.array(orderChangeOperationSchema).max(ORDER_CHANGE_LIMITS.MAX_OPERATIONS).superRefine((operations, ctx) => {
    const seen = new Set<number>();
    operations.forEach((operation, index) => {
      if (seen.has(operation.seq)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'seq'], message: 'Operation sequence must be unique' });
      }
      seen.add(operation.seq);
    });

    const countByCode = (code: string) => operations.filter((operation) => operation.code === code).length;
    for (const [code, limit] of [
      ['ADD_ITEM', ORDER_CHANGE_LIMITS.MAX_ADD_ITEM_OPERATIONS],
      ['ADD_PIECE', ORDER_CHANGE_LIMITS.MAX_ADD_PIECE_OPERATIONS],
      ['ADD_PREFERENCE', ORDER_CHANGE_LIMITS.MAX_ADD_PREFERENCE_OPERATIONS],
    ] as const) {
      if (countByCode(code) > limit) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: `${code} may appear at most ${limit} times per Change request` });
      }
    }
  }),
  gateDecisions: z.array(z.object({ seq: z.number().int().positive(), gateCode: z.string().min(1).max(120), acknowledgementChallenge: z.string().max(ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH).optional(), overrideReason: z.string().max(ORDER_CHANGE_LIMITS.MAX_CHANGE_REASON_LENGTH).optional() }).strict()).max(ORDER_CHANGE_LIMITS.MAX_GATE_DECISIONS).optional(),
}).strict();

/** Adds the required Preview binding supplied by Apply without widening the shared intent contract. */
export const orderChangeApplyRequestSchema = orderChangeRequestSchema.extend({
  reviewProof: z.string().trim().min(1).max(ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH),
  calculationFingerprint: z.string().trim().min(1).max(ORDER_CHANGE_LIMITS.MAX_CALCULATION_FINGERPRINT_LENGTH),
}).strict();

/** Bounded cursor query contract reserved for the future V2 Change-history route. */
export const orderChangeHistoryQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(ORDER_CHANGE_LIMITS.HISTORY_MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(ORDER_CHANGE_LIMITS.HISTORY_MAX_PAGE_SIZE).default(ORDER_CHANGE_LIMITS.HISTORY_DEFAULT_PAGE_SIZE),
}).strict();

/** Header contract for a durable Apply replay key, matching existing money/edit limits. */
export const orderChangeIdempotencyKeySchema = z.string().trim().min(1).max(ORDER_CHANGE_LIMITS.MAX_IDEMPOTENCY_KEY_LENGTH);

/** Validates the dynamic order segment before database access. */
export const orderChangeContextParamsSchema = z.object({ id: uuidSchema }).strict();

/** Canonical operation-code validator retained for consumers that accept an individual operation code. */
export const orderChangeOperationCodesSchema = z.enum(ORDER_CHANGE_OPERATION_CODES);
