/**
 * Prisma Multi-Tenant Middleware
 *
 * Automatically enforces tenant_org_id filtering on all org_* tables
 * This implements the CRITICAL requirement from CLAUDE.md:
 * "Every query MUST filter by tenant_org_id - NO EXCEPTIONS"
 *
 * @see CLAUDE.md - Multi-Tenancy Enforcement
 */

import { Prisma, PrismaClient } from '@prisma/client'

/**
 * Apply multi-tenant middleware to Prisma client
 *
 * @param prisma - Prisma client instance
 * @param getTenantId - Function that returns current tenant ID from session/context
 */
export function applyTenantMiddleware(
  prisma: PrismaClient,
  getTenantId: () => string | null
) {
  // Type assertion: $use exists on PrismaClient but may not be in types
  (prisma as any).$use(async (params: any, next: any) => {
    // Get current tenant ID from session
    const tenantId = getTenantId()

    // Only apply middleware to org_* tables (tenant-scoped tables)
    const isOrgTable = params.model?.toLowerCase().startsWith('org_')

    if (!isOrgTable) {
      // sys_* tables are global, no tenant filtering needed
      return next(params)
    }

    // Require tenant ID for all org_* operations
    if (!tenantId) {
      throw new Error(
        `[Prisma Middleware] Tenant ID is required for operations on ${params.model}. ` +
        'Ensure user is authenticated and tenant_org_id is in session.'
      )
    }

    // READ operations: Auto-inject tenant filter
    if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // CREATE operations: Auto-add tenant_org_id
    if (params.action === 'create') {
      params.args = params.args || {}
      params.args.data = {
        ...params.args.data,
        tenant_org_id: tenantId,
      }
    }

    // CREATE MANY operations: Auto-add tenant_org_id to all records
    if (params.action === 'createMany') {
      params.args = params.args || {}
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((record: any) => ({
          ...record,
          tenant_org_id: tenantId,
        }))
      }
    }

    // UPDATE operations: Ensure tenant filter
    if (['update', 'updateMany', 'upsert'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // DELETE operations: Ensure tenant filter
    if (['delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // Log tenant-filtered queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Prisma Tenant Filter] ${params.model}.${params.action} | tenant_org_id: ${tenantId}`
      )
    }

    return next(params)
  })
}

/**
 * Type-safe helper to get tenant ID from Next.js server context
 *
 * TODO: Implement based on your authentication strategy:
 * - Option 1: From Supabase session
 * - Option 2: From Next.js session/cookies
 * - Option 3: From request headers
 */
export function getTenantIdFromSession(): string | null {
  // PLACEHOLDER: Replace with your actual session retrieval logic

  // Example using Supabase (uncomment when auth is ready):
  // import { createServerClient } from '@supabase/auth-helpers-nextjs'
  // const supabase = createServerClient(...)
  // const { data: { session } } = await supabase.auth.getSession()
  // return session?.user?.user_metadata?.tenant_org_id ?? null

  // For now, return null (will throw error, forcing you to implement)
  console.warn('[Prisma Middleware] getTenantIdFromSession not implemented yet!')
  return null
}

/**
 * Optional: Create a scoped Prisma client for a specific tenant
 * Useful for background jobs or scripts
 */
export function createTenantScopedPrisma(tenantId: string) {
  const scopedPrisma = new PrismaClient()

  applyTenantMiddleware(scopedPrisma, () => tenantId)

  return scopedPrisma
}
