import { z } from 'zod'

/**
 * Shared 1-based pagination contract for cash-drawer screen APIs.
 *
 * Why:
 * the cash-drawer hub keeps UI state in the URL, so every related endpoint must
 * parse the same page semantics to avoid mismatched pagination behavior.
 */
export const cashDrawerPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(5),
})

/**
 * Query params for the master drawer overview list.
 */
export const cashDrawerOverviewQuerySchema = cashDrawerPaginationQuerySchema.extend({})

/**
 * Query params for a single drawer's sessions list.
 */
export const cashDrawerSessionsQuerySchema = cashDrawerPaginationQuerySchema.extend({})

/**
 * Query params for the hidden session detail route/API.
 *
 * Why:
 * movements and linked payments paginate independently, so each grid carries
 * its own 1-based page state in the URL without forcing the other table to
 * reset.
 */
export const cashDrawerSessionDetailQuerySchema = z.object({
  movementPage: z.coerce.number().int().min(1).max(10_000).default(1),
  movementPageSize: z.coerce.number().int().min(1).max(100).default(10),
  paymentPage: z.coerce.number().int().min(1).max(10_000).default(1),
  paymentPageSize: z.coerce.number().int().min(1).max(100).default(10),
})
