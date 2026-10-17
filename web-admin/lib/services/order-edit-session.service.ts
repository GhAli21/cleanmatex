/**
 * Server owner of an Order Edit page session.
 * One live lock per order. The tab token must match before Edit can read or save.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import {
  ORDER_EDIT_SESSION_TTL_MS,
  ORDER_EDIT_SESSION_UNLOAD_GRACE_MS,
} from '@/lib/constants/order-edit-session';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OrderEditSessionCode =
  | 'MISSING'
  | 'EXPIRED'
  | 'MISMATCH'
  | 'ALREADY_OPEN'
  | 'HELD_BY_OTHER'
  | 'ORDER_NOT_FOUND';

export type OrderEditSessionEndReason = 'user_exit' | 'applied' | 'navigate_away' | 'unload';

/**
 * Stable failure for a missing, expired, or conflicting edit session.
 */
export class OrderEditSessionError extends Error {
  readonly code: OrderEditSessionCode;

  /**
   * @param code - Machine-readable session outcome.
   */
  constructor(code: OrderEditSessionCode) {
    super(code);
    this.name = 'OrderEditSessionError';
    this.code = code;
  }
}

interface SessionActor {
  tenantId: string;
  userId: string;
  orderId: string;
  sessionToken: string | null;
}

interface StartOrderEditSessionInput extends SessionActor {
  userName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface EndOrderEditSessionInput extends SessionActor {
  reason: OrderEditSessionEndReason;
  /** Last expiry the tab observed. Unload shortens only that generation. */
  expectedExpiresAt?: string | null;
}

interface LockRow {
  locked_by: string;
  session_id: string | null;
  expires_at: Date;
  locked_by_name: string | null;
}

/**
 * @param value - Untrusted token from the client.
 * @returns True when the value is a UUID the lock can store.
 */
function isSessionToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * @param orderId - Order the editor is opening.
 * @param tenantId - Authenticated organization.
 * @returns The live lock for this order in this organization, if one exists.
 */
async function readLock(orderId: string, tenantId: string): Promise<LockRow | null> {
  return prisma.org_order_edit_locks.findFirst({
    where: { order_id: orderId, tenant_org_id: tenantId },
    select: {
      locked_by: true,
      session_id: true,
      expires_at: true,
      locked_by_name: true,
    },
  });
}

/**
 * @param row - Current lock row.
 * @returns True when the TTL has elapsed.
 */
function isExpired(row: LockRow): boolean {
  return row.expires_at.getTime() <= Date.now();
}

/**
 * Removes an elapsed lock so a new editor can start.
 * The tenant predicate stays on the write.
 * @param orderId - Order being released.
 * @param tenantId - Authenticated organization.
 */
async function deleteExpired(orderId: string, tenantId: string): Promise<void> {
  await prisma.org_order_edit_locks.deleteMany({
    where: {
      order_id: orderId,
      tenant_org_id: tenantId,
      expires_at: { lte: new Date() },
    },
  });
}

/**
 * @param orderId - Order being edited.
 * @param tenantId - Authenticated organization.
 * @param userId - Lock owner.
 * @param sessionToken - Tab token stored on the lock.
 * @returns The new expiry.
 */
async function extendMatchingLock(
  orderId: string,
  tenantId: string,
  userId: string,
  sessionToken: string,
): Promise<Date> {
  const expiresAt = new Date(Date.now() + ORDER_EDIT_SESSION_TTL_MS);
  const updated = await prisma.org_order_edit_locks.updateMany({
    where: {
      order_id: orderId,
      tenant_org_id: tenantId,
      locked_by: userId,
      session_id: sessionToken,
      expires_at: { gt: new Date() },
    },
    data: {
      expires_at: expiresAt,
      updated_at: new Date(),
      updated_by: userId,
    },
  });
  if (updated.count !== 1) {
    throw new OrderEditSessionError('MISSING');
  }
  return expiresAt;
}

/**
 * Classifies a live lock against the caller.
 * @param row - Live lock.
 * @param userId - Authenticated user.
 * @param sessionToken - Token this tab presented.
 */
function rejectForeignLock(row: LockRow, userId: string, sessionToken: string): void {
  if (row.locked_by !== userId) {
    throw new OrderEditSessionError('HELD_BY_OTHER');
  }
  if (row.session_id !== sessionToken) {
    throw new OrderEditSessionError('ALREADY_OPEN');
  }
}

/**
 * Opens or resumes an edit session created by an in-app Edit action.
 * A second tab with a different token is refused while the lock is live.
 * @param input - Actor, order, and the tab token.
 * @returns The lock expiry the tab must keep for a later unload.
 */
export async function startOrderEditSession(
  input: StartOrderEditSessionInput,
): Promise<{ expiresAt: string }> {
  if (!isSessionToken(input.sessionToken)) {
    throw new OrderEditSessionError('MISSING');
  }
  const sessionToken = input.sessionToken;
  return withTenantContext(input.tenantId, async () => {
    const order = await prisma.org_orders_mst.findFirst({
      where: { id: input.orderId, tenant_org_id: input.tenantId },
      select: { id: true },
    });
    if (!order) {
      logger.info('Order edit session denied', {
        feature: 'orders',
        action: 'edit_session_denied',
        tenantId: input.tenantId,
        userId: input.userId,
        orderId: input.orderId,
        reason: 'ORDER_NOT_FOUND',
      });
      throw new OrderEditSessionError('ORDER_NOT_FOUND');
    }

    await deleteExpired(input.orderId, input.tenantId);
    const existing = await readLock(input.orderId, input.tenantId);
    if (existing && !isExpired(existing)) {
      rejectForeignLock(existing, input.userId, sessionToken);
      const expiresAt = await extendMatchingLock(input.orderId, input.tenantId, input.userId, sessionToken);
      logger.info('Order edit session resumed', {
        feature: 'orders',
        action: 'edit_session_start',
        tenantId: input.tenantId,
        userId: input.userId,
        orderId: input.orderId,
        resumed: true,
      });
      return { expiresAt: expiresAt.toISOString() };
    }

    const expiresAt = new Date(Date.now() + ORDER_EDIT_SESSION_TTL_MS);
    try {
      await prisma.org_order_edit_locks.create({
        data: {
          order_id: input.orderId,
          tenant_org_id: input.tenantId,
          locked_by: input.userId,
          locked_by_name: input.userName?.slice(0, 200) ?? null,
          locked_at: new Date(),
          expires_at: expiresAt,
          session_id: sessionToken,
          ip_address: input.ipAddress?.slice(0, 64) ?? null,
          user_agent: input.userAgent?.slice(0, 500) ?? null,
          created_by: input.userId,
          updated_by: input.userId,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const raced = await readLock(input.orderId, input.tenantId);
      if (!raced || isExpired(raced)) {
        throw new OrderEditSessionError('ALREADY_OPEN');
      }
      rejectForeignLock(raced, input.userId, sessionToken);
      const extended = await extendMatchingLock(input.orderId, input.tenantId, input.userId, sessionToken);
      return { expiresAt: extended.toISOString() };
    }

    logger.info('Order edit session started', {
      feature: 'orders',
      action: 'edit_session_start',
      tenantId: input.tenantId,
      userId: input.userId,
      orderId: input.orderId,
      resumed: false,
    });
    return { expiresAt: expiresAt.toISOString() };
  });
}

/**
 * Confirms the tab still owns the live lock and slides the TTL forward.
 * Preview, apply, and the page heartbeat all use this so an idle tab expires.
 * @param input - Actor, order, and tab token.
 * @returns The refreshed expiry.
 */
export async function touchOrderEditSession(
  input: SessionActor,
): Promise<{ expiresAt: string }> {
  if (!isSessionToken(input.sessionToken)) {
    throw new OrderEditSessionError('MISSING');
  }
  const sessionToken = input.sessionToken;
  return withTenantContext(input.tenantId, async () => {
    const existing = await readLock(input.orderId, input.tenantId);
    if (!existing) {
      logger.info('Order edit session missing', {
        feature: 'orders',
        action: 'edit_session_denied',
        tenantId: input.tenantId,
        userId: input.userId,
        orderId: input.orderId,
        reason: 'MISSING',
      });
      throw new OrderEditSessionError('MISSING');
    }
    if (isExpired(existing)) {
      await deleteExpired(input.orderId, input.tenantId);
      logger.info('Order edit session expired', {
        feature: 'orders',
        action: 'edit_session_expired',
        tenantId: input.tenantId,
        userId: input.userId,
        orderId: input.orderId,
      });
      throw new OrderEditSessionError('EXPIRED');
    }
    if (existing.locked_by !== input.userId) {
      throw new OrderEditSessionError('HELD_BY_OTHER');
    }
    if (existing.session_id !== sessionToken) {
      throw new OrderEditSessionError('MISMATCH');
    }
    const expiresAt = await extendMatchingLock(input.orderId, input.tenantId, input.userId, sessionToken);
    return { expiresAt: expiresAt.toISOString() };
  });
}

/**
 * Ends the session. Unload only shortens the expiry the tab last observed,
 * so a refresh that already renewed the lock is left intact.
 * @param input - Actor, token, and why the page is leaving.
 */
export async function endOrderEditSession(input: EndOrderEditSessionInput): Promise<void> {
  if (!isSessionToken(input.sessionToken)) {
    return;
  }
  const sessionToken = input.sessionToken;
  await withTenantContext(input.tenantId, async () => {
    if (input.reason === 'unload') {
      const expected = input.expectedExpiresAt ? new Date(input.expectedExpiresAt) : null;
      if (!expected || Number.isNaN(expected.getTime())) return;
      const shortened = await prisma.org_order_edit_locks.updateMany({
        where: {
          order_id: input.orderId,
          tenant_org_id: input.tenantId,
          locked_by: input.userId,
          session_id: sessionToken,
          expires_at: {
            gte: new Date(expected.getTime() - 2000),
            lte: new Date(expected.getTime() + 2000),
          },
        },
        data: {
          expires_at: new Date(Date.now() + ORDER_EDIT_SESSION_UNLOAD_GRACE_MS),
          updated_at: new Date(),
          updated_by: input.userId,
        },
      });
      if (shortened.count === 1) {
        logger.info('Order edit session unload grace started', {
          feature: 'orders',
          action: 'edit_session_unload',
          tenantId: input.tenantId,
          userId: input.userId,
          orderId: input.orderId,
        });
      }
      return;
    }

    const removed = await prisma.org_order_edit_locks.deleteMany({
      where: {
        order_id: input.orderId,
        tenant_org_id: input.tenantId,
        locked_by: input.userId,
        session_id: sessionToken,
      },
    });
    logger.info('Order edit session ended', {
      feature: 'orders',
      action: input.reason === 'applied' ? 'edit_session_applied' : 'edit_session_exit',
      tenantId: input.tenantId,
      userId: input.userId,
      orderId: input.orderId,
      reason: input.reason,
      removed: removed.count,
    });
  });
}
