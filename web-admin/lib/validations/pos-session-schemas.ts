import { z } from 'zod';

export const posSessionOpenSchema = z.object({
  branchId: z.string().uuid(),
  terminalId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  sourceChannel: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const posSessionEnsureSchema = posSessionOpenSchema;

export const posSessionReasonSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  sourceChannel: z.string().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const posSessionForceCloseSchema = posSessionReasonSchema.extend({
  reason: z.string().trim().min(1).max(500),
});

export const posSessionBranchQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
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

export const posSessionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'PAUSED', 'CLOSED', 'FORCE_CLOSED']).optional(),
  scope: z.enum(['own', 'all']).default('own'),
});
