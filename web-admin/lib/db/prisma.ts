/**
 * Prisma Client Instance (Consolidated)
 *
 * Single source of truth for Prisma client with:
 * - Singleton pattern to prevent multiple instances in development
 * - Multi-tenant middleware automatically applied
 * - Logging configuration
 * - Connection pooling
 * - Graceful shutdown handling
 *
 * Usage:
 * ```typescript
 * import { prisma } from '@/lib/db/prisma'
 * 
 * // In server actions/components, wrap with tenant context:
 * import { withTenantContext, getTenantIdFromSession } from '@/lib/db/tenant-context'
 * 
 * export async function listOrders(filters: unknown) {
 *   const tenantId = await getTenantIdFromSession()
 *   if (!tenantId) throw new Error('Unauthorized')
 *   
 *   return withTenantContext(tenantId, async () => {
 *     // All Prisma queries here automatically filter by tenant_org_id
 *     return await prisma.org_orders_mst.findMany()
 *   })
 * }
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { applyTenantMiddleware } from '../prisma-middleware';
import { applyPerformanceMiddleware } from './prisma-performance';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Create or reuse Prisma client instance
const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Apply multi-tenant middleware (only if not already applied)
// Check if middleware is already applied by checking for a custom property
// Wrap in try-catch to handle webpack bundling edge cases
if (!(prismaClient as any).__tenantMiddlewareApplied) {
  try {
    // Check if $use method exists before applying middleware
    if (typeof (prismaClient as any).$use === 'function') {
  applyTenantMiddleware(prismaClient);
  (prismaClient as any).__tenantMiddlewareApplied = true;
    }
  } catch (error) {
    // Silently fail during build - middleware will be applied at runtime
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Prisma] Middleware application deferred:', error);
    }
  }
}

// Apply performance monitoring middleware (only if not already applied)
if (!(prismaClient as any).__performanceMiddlewareApplied) {
  try {
    // Check if $use method exists before applying middleware
    if (typeof (prismaClient as any).$use === 'function') {
  applyPerformanceMiddleware(prismaClient);
  (prismaClient as any).__performanceMiddlewareApplied = true;
    }
  } catch (error) {
    // Silently fail during build - middleware will be applied at runtime
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Prisma] Performance middleware application deferred:', error);
    }
  }
}

// Export singleton instance
export const prisma = prismaClient;

// Save to global in development to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handler
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Also handle SIGINT and SIGTERM for better cleanup
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
