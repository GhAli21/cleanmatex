/**
 * Prisma Client Instance (Consolidated)
 *
 * Single source of truth for the Prisma client:
 * - Singleton base client (one connection pool, survives dev hot reload)
 * - Tenant Guard extension — checks every tenant-scoped query carries an explicit
 *   tenant_org_id; it NEVER injects one (see lib/db/tenant-guard.ts)
 * - Performance monitoring extension
 *
 * Tenant isolation is the caller's job: every query on a tenant-scoped model must
 * filter tenant_org_id explicitly. withTenantContext() does NOT add filters — it only
 * lets the guard detect queries that name a different tenant.
 *
 * Usage:
 * ```typescript
 * import { prisma } from '@/lib/db/prisma'
 *
 * const orders = await prisma.org_orders_mst.findMany({
 *   where: { tenant_org_id: tenantId, status: 'READY' },
 * })
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { tenantGuardExtension, withTenantGuardCallsites } from './tenant-guard';
import { performanceExtension } from './prisma-performance';

// Cache the BASE client globally: it owns the connection pool. Extensions are cheap
// wrappers and are re-applied on each module evaluation.
const globalForPrisma = global as unknown as {
  prismaBase: PrismaClient | undefined;
};

const prismaBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Order: performance wraps the guard, so rejected queries are not timed as DB work.
//
// Typed as the plain PrismaClient on purpose. Both extensions are query-only
// (no result/model/client members), so the runtime surface matches PrismaClient
// except $use/$on, which are unused here ($use no longer exists on Prisma 6).
// Exposing the inferred extended type instead costs ~5x tsc time (68s -> 5.5min
// measured) and breaks every injected `PrismaClient` / `TransactionClient`
// parameter. Revisit if an extension ever adds result or model members.
//
// withTenantGuardCallsites binds each lazy query to the line that created it, so the
// guard reports real call sites and sees the caller's tenant context.
export const prisma = buildGuardedClient(prismaBase);

/** Structural view of `$extends` used only to chain query extensions without type inference. */
type ExtendableClient = { $extends(extension: unknown): ExtendableClient };

function buildGuardedClient(base: PrismaClient): PrismaClient {
  let extended: object;
  try {
    // Chain through a minimal structural type: the inferred extended type is discarded
    // anyway (see note above), and resolving it trips TS2859 "excessive complexity".
    extended = (base as unknown as ExtendableClient)
      .$extends(tenantGuardExtension)
      .$extends(performanceExtension);
  } catch (error) {
    // Only reachable when @prisma/client resolved to its browser build (jsdom unit
    // tests importing a service module). That stub throws on EVERY property access,
    // so returning it cannot yield an unguarded client that runs queries.
    if (typeof window !== 'undefined') return base;
    throw error;
  }
  return withTenantGuardCallsites(extended) as unknown as PrismaClient;
}

// Canonical Next.js dev pattern: reuse the pool across hot reloads.
// https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = prismaBase;
}

// NOTE: Do NOT register process.on('beforeExit') here.
// In Next.js, 'beforeExit' fires whenever the event loop drains (e.g., between requests),
// which causes the singleton pool to disconnect and reconnect constantly.
// Prisma's query engine manages its own lifecycle and handles SIGINT/SIGTERM internally.
// Explicit $disconnect() is only needed in scripts (not long-running servers).
