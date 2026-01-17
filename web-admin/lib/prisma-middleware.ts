/**
 * Prisma Multi-Tenant Middleware
 *
 * Automatically enforces tenant_org_id filtering on all org_* tables
 * This implements the CRITICAL requirement from CLAUDE.md:
 * "Every query MUST filter by tenant_org_id - NO EXCEPTIONS"
 *
 * Uses AsyncLocalStorage tenant context to get tenant ID synchronously.
 *
 * @see CLAUDE.md - Multi-Tenancy Enforcement
 * @see lib/db/tenant-context.ts - Tenant context implementation
 */

import { PrismaClient } from '@prisma/client'
import { getTenantId } from './db/tenant-context'

/**
 * Apply multi-tenant middleware to Prisma client
 *
 * This middleware automatically:
 * - Filters all org_* table queries by tenant_org_id
 * - Adds tenant_org_id to all create operations
 * - Ensures tenant_org_id is in all update/delete where clauses
 *
 * @param prisma - Prisma client instance
 */
export function applyTenantMiddleware(prisma: PrismaClient) {
  // Type assertion: $use exists on PrismaClient but may not be in types
  (prisma as any).$use(async (params: any, next: any) => {
    // Get current tenant ID from async context
    const tenantId = getTenantId()

    // Only apply middleware to org_* tables (tenant-scoped tables)
    const isOrgTable = params.model?.toLowerCase().startsWith('org_')

    if (!isOrgTable) {
      // sys_* tables are global, no tenant filtering needed
      return next(params)
    }

    // For org_* tables, require tenant ID (unless explicitly bypassed)
    // Note: Some operations might legitimately not have tenant context
    // (e.g., system migrations), so we allow null but log a warning
    if (!tenantId) {
      // In development, warn but don't fail (allows testing)
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[Prisma Middleware] No tenant context for ${params.model}.${params.action}. ` +
          'Ensure withTenantContext() is called or tenant ID is manually added.'
        )
        // Still proceed - manual tenant filtering might be used
        return next(params)
      }
      
      // In production, fail for safety
      throw new Error(
        `[Prisma Middleware] Tenant ID is required for operations on ${params.model}. ` +
        'Ensure withTenantContext() is called or tenant_org_id is manually added to query.'
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
      } else if (params.args.data) {
        params.args.data = {
          ...params.args.data,
          tenant_org_id: tenantId,
        }
      }
    }

    // UPDATE operations: Ensure tenant filter
    if (['update', 'updateMany'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // UPSERT operations: Handle both where, create, and update
    if (params.action === 'upsert') {
      params.args = params.args || {}
      // Add tenant_org_id to where clause
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
      // Add tenant_org_id to create data
      if (params.args.create) {
        params.args.create = {
          ...params.args.create,
          tenant_org_id: tenantId,
        }
      }
      // Add tenant_org_id to update data (if it's an object, not just fields to update)
      if (params.args.update && typeof params.args.update === 'object' && !Array.isArray(params.args.update)) {
        params.args.update = {
          ...params.args.update,
          tenant_org_id: tenantId,
        }
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
 * Create a scoped Prisma client for a specific tenant
 * Useful for background jobs, scripts, or when you have tenant ID upfront
 *
 * @param tenantId - Tenant organization ID
 * @returns Prisma client with tenant middleware applied
 *
 * @example
 * ```typescript
 * const prisma = createTenantScopedPrisma('tenant-id')
 * // All queries automatically filtered by tenant_org_id
 * const orders = await prisma.org_orders_mst.findMany()
 * ```
 */
export function createTenantScopedPrisma(tenantId: string) {
  const scopedPrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

  // Apply middleware with fixed tenant ID
  ;(scopedPrisma as any).$use(async (params: any, next: any) => {
    const isOrgTable = params.model?.toLowerCase().startsWith('org_')

    if (!isOrgTable) {
      return next(params)
    }

    // READ operations
    if (['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // CREATE operations
    if (params.action === 'create') {
      params.args = params.args || {}
      params.args.data = {
        ...params.args.data,
        tenant_org_id: tenantId,
      }
    }

    // CREATE MANY operations
    if (params.action === 'createMany') {
      params.args = params.args || {}
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((record: any) => ({
          ...record,
          tenant_org_id: tenantId,
        }))
      }
    }

    // UPDATE operations
    if (['update', 'updateMany'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    // UPSERT operations: Handle both where, create, and update
    if (params.action === 'upsert') {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
      if (params.args.create) {
        params.args.create = {
          ...params.args.create,
          tenant_org_id: tenantId,
        }
      }
      if (params.args.update && typeof params.args.update === 'object' && !Array.isArray(params.args.update)) {
        params.args.update = {
          ...params.args.update,
          tenant_org_id: tenantId,
        }
      }
    }

    // DELETE operations
    if (['delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {}
      params.args.where = {
        ...params.args.where,
        tenant_org_id: tenantId,
      }
    }

    return next(params)
  })

  return scopedPrisma
}
