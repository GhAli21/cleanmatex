import { z } from 'zod';

import { USER_SELECTABLE_TRX_TYPES } from '@/lib/constants/cash-drawer';

/**
 * Request schemas for custody (drawer) transactions — CLF §4B.4/§4B.7
 * CLF-2-3. Only `USER_SELECTABLE_TRX_TYPES` are postable through this
 * boundary; `CLOSE_DISPOSITION` and `REVERSAL` are system-only, posted
 * internally by `cash-drawer-session.service.ts` / `reverseDrawerTrxTx`.
 */

export const drawerTrxLineSchema = z.object({
  drawerId: z.string().uuid(),
  direction: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  currencyCode: z.string().length(3),
});

export const postDrawerTrxRequestSchema = z.object({
  trxTypeCode: z.enum(USER_SELECTABLE_TRX_TYPES as unknown as [string, ...string[]]),
  branchId: z.string().uuid(),
  lines: z.array(drawerTrxLineSchema).min(2),
  reasonCode: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const reverseDrawerTrxRequestSchema = z.object({
  reasonCode: z.string().trim().min(1),
});

export type PostDrawerTrxRequest = z.infer<typeof postDrawerTrxRequestSchema>;
export type ReverseDrawerTrxRequest = z.infer<typeof reverseDrawerTrxRequestSchema>;
