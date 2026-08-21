import { z } from 'zod'

/** Validates the bounded, read-only Workboard query surface. */
export const workboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  branchId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.string().trim().min(1).max(50).optional(),
  blocker: z.enum(['all', 'blocked', 'clear']).default('all'),
  sla: z.enum(['all', 'overdue', 'due_today', 'not_due']).default('all'),
  sort: z.enum(['age_desc', 'ready_by_asc']).default('age_desc'),
})
