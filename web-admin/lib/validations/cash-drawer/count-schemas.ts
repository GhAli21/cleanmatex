import { z } from 'zod';

import { countInputSchema } from './session-schemas';
import { CASH_DRAWER_COUNT_TYPES } from '@/lib/constants/cash-drawer';

/**
 * Request schema for a standalone count — CLF §4B.4/§4B.7 CLF-2-3. Used by
 * the `GET|POST /api/v1/cash-drawers/[drawerId]/counts` endpoint: a SPOT
 * check on a session-based drawer, or any count (including the checkpoint
 * flow) on a count-only drawer (`cashDrawerSessionId` stays null). The
 * OPENING/CLOSING count types are only ever written from inside the session
 * service, never through this standalone endpoint.
 */
export const recordSpotCountRequestSchema = z.object({
  countType: z.enum([CASH_DRAWER_COUNT_TYPES.SPOT, CASH_DRAWER_COUNT_TYPES.RECOUNT]),
  currencyCode: z.string().length(3),
  count: countInputSchema,
  /** RECOUNT only — the prior CLOSING (or RECOUNT) count this one supersedes. */
  supersedesCountId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type RecordSpotCountRequest = z.infer<typeof recordSpotCountRequestSchema>;
