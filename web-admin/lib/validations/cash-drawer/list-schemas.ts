import { z } from 'zod';

import { CASH_DRAWER_TRX_TYPES, CASH_DRAWER_POST_CLOSE_STATUSES } from '@/lib/constants/cash-drawer';

/**
 * Query-string schemas for the CLF read endpoints (§4B.7 CLF-7). Server-paged;
 * every list caps `pageSize` the same way `pos-session-schemas.ts` does.
 */

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const drawerCountsListQuerySchema = pageQuerySchema;

export const drawerTrxListQuerySchema = pageQuerySchema.extend({
  drawerId: z.string().uuid().optional(),
  trxTypeCode: z.enum(Object.values(CASH_DRAWER_TRX_TYPES) as [string, ...string[]]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const drawerLedgerQuerySchema = pageQuerySchema;

export const followUpListQuerySchema = pageQuerySchema.extend({
  postCloseStatusCode: z.enum(Object.values(CASH_DRAWER_POST_CLOSE_STATUSES) as [string, ...string[]]).optional(),
});
