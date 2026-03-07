/**
 * Order Lock Service
 * Manages edit locking to prevent concurrent modifications
 *
 * PRD: Edit Order Feature - Concurrent Edit Prevention
 * Implements pessimistic locking with 30-minute TTL
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';

const LOCK_TTL_MINUTES = 30;

export interface OrderLock {
  orderId: string;
  tenantOrgId: string;
  lockedBy: string;
  lockedByName: string | null;
  lockedAt: Date;
  expiresAt: Date;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface OrderLockStatus {
  isLocked: boolean;
  lock: OrderLock | null;
  canForceUnlock: boolean; // Based on user permission
}

export interface LockOrderParams {
  orderId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UnlockOrderParams {
  orderId: string;
  tenantId: string;
  userId: string;
  force?: boolean; // Admin can force unlock
}

/**
 * Acquires an edit lock on an order
 * Throws error if already locked by another user
 */
export async function lockOrderForEdit(params: LockOrderParams): Promise<OrderLock> {
  const { orderId, tenantId, userId, userName, sessionId, ipAddress, userAgent } = params;

  return withTenantContext(tenantId, async () => {
    // Check if lock already exists
    const existingLock = await prisma.org_order_edit_locks.findUnique({
      where: {
        order_id: orderId,
      },
    });

    // If lock exists and not expired
    if (existingLock && existingLock.expires_at > new Date()) {
      // If same user, refresh the lock
      if (existingLock.locked_by === userId) {
        const refreshedLock = await prisma.org_order_edit_locks.update({
          where: {
            order_id: orderId,
          },
          data: {
            locked_at: new Date(),
            expires_at: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000),
            session_id: sessionId || existingLock.session_id,
          },
        });

        logger.info('[lockOrderForEdit] Lock refreshed', {
          feature: 'orders',
          action: 'lock_refresh',
          orderId,
          userId,
        });

        return mapToOrderLock(refreshedLock);
      }

      // Lock held by another user
      throw new Error(
        `Order is being edited by ${existingLock.locked_by_name || 'another user'}. ` +
        `Lock expires at ${existingLock.expires_at.toISOString()}`
      );
    }

    // Create or update lock
    const lock = await prisma.org_order_edit_locks.upsert({
      where: {
        order_id: orderId,
      },
      create: {
        order_id: orderId,
        tenant_org_id: tenantId,
        locked_by: userId,
        locked_by_name: userName || null,
        locked_at: new Date(),
        expires_at: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000),
        session_id: sessionId || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      },
      update: {
        locked_by: userId,
        locked_by_name: userName || null,
        locked_at: new Date(),
        expires_at: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000),
        session_id: sessionId || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      },
    });

    logger.info('[lockOrderForEdit] Lock acquired', {
      feature: 'orders',
      action: 'lock_acquire',
      orderId,
      userId,
      expiresAt: lock.expires_at,
    });

    return mapToOrderLock(lock);
  });
}

/**
 * Releases an edit lock on an order
 * Only the lock owner can unlock (unless force = true)
 */
export async function unlockOrder(params: UnlockOrderParams): Promise<void> {
  const { orderId, tenantId, userId, force = false } = params;

  return withTenantContext(tenantId, async () => {
    const existingLock = await prisma.org_order_edit_locks.findUnique({
      where: {
        order_id: orderId,
      },
    });

    if (!existingLock) {
      // No lock exists, nothing to do
      return;
    }

    // Check ownership unless force unlock
    if (!force && existingLock.locked_by !== userId) {
      throw new Error(
        `Cannot unlock order. Lock is held by ${existingLock.locked_by_name || 'another user'}.`
      );
    }

    await prisma.org_order_edit_locks.delete({
      where: {
        order_id: orderId,
      },
    });

    logger.info('[unlockOrder] Lock released', {
      feature: 'orders',
      action: force ? 'lock_force_unlock' : 'lock_unlock',
      orderId,
      userId,
      wasLockedBy: existingLock.locked_by,
    });
  });
}

/**
 * Checks if an order is locked and returns lock status
 */
export async function checkOrderLock(
  orderId: string,
  tenantId: string
): Promise<OrderLockStatus> {
  return withTenantContext(tenantId, async () => {
    const lock = await prisma.org_order_edit_locks.findUnique({
      where: {
        order_id: orderId,
      },
    });

    if (!lock) {
      return {
        isLocked: false,
        lock: null,
        canForceUnlock: false,
      };
    }

    // Check if lock is expired
    if (lock.expires_at <= new Date()) {
      // Lock expired, clean it up
      await prisma.org_order_edit_locks.delete({
        where: {
          order_id: orderId,
        },
      });

      return {
        isLocked: false,
        lock: null,
        canForceUnlock: false,
      };
    }

    return {
      isLocked: true,
      lock: mapToOrderLock(lock),
      canForceUnlock: true, // TODO: Check user permission
    };
  });
}

/**
 * Cleans up expired locks (called by cron job)
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const result = await prisma.org_order_edit_locks.deleteMany({
    where: {
      expires_at: {
        lte: new Date(),
      },
    },
  });

  if (result.count > 0) {
    logger.info('[cleanupExpiredLocks] Cleaned up expired locks', {
      feature: 'orders',
      action: 'lock_cleanup',
      count: result.count,
    });
  }

  return result.count;
}

/**
 * Extends an existing lock (refresh TTL)
 */
export async function extendLock(
  orderId: string,
  tenantId: string,
  userId: string
): Promise<OrderLock> {
  return withTenantContext(tenantId, async () => {
    const existingLock = await prisma.org_order_edit_locks.findUnique({
      where: {
        order_id: orderId,
      },
    });

    if (!existingLock) {
      throw new Error('No lock found for this order');
    }

    if (existingLock.locked_by !== userId) {
      throw new Error('Cannot extend lock held by another user');
    }

    const refreshedLock = await prisma.org_order_edit_locks.update({
      where: {
        order_id: orderId,
      },
      data: {
        locked_at: new Date(),
        expires_at: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000),
      },
    });

    logger.info('[extendLock] Lock extended', {
      feature: 'orders',
      action: 'lock_extend',
      orderId,
      userId,
      expiresAt: refreshedLock.expires_at,
    });

    return mapToOrderLock(refreshedLock);
  });
}

/**
 * Maps Prisma model to OrderLock interface
 */
function mapToOrderLock(lock: any): OrderLock {
  return {
    orderId: lock.order_id,
    tenantOrgId: lock.tenant_org_id,
    lockedBy: lock.locked_by,
    lockedByName: lock.locked_by_name,
    lockedAt: lock.locked_at,
    expiresAt: lock.expires_at,
    sessionId: lock.session_id,
    ipAddress: lock.ip_address,
    userAgent: lock.user_agent,
  };
}
