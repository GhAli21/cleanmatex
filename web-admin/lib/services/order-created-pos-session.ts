import 'server-only';

import { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/db/prisma';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';

type SessionDb = Pick<typeof prisma, '$queryRaw' | '$executeRaw'>;

/**
 * Open POS session for this user and branch, if one exists.
 * A paused session is not a creating session.
 */
export async function findOpenPosSessionIdForOrder(
  db: Pick<typeof prisma, '$queryRaw'>,
  input: { tenantId: string; userId: string; branchId: string },
): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM public.org_pos_sessions_mst
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND user_id = ${input.userId}::uuid
      AND branch_id = ${input.branchId}::uuid
      AND status = ${POS_SESSION_STATUS.OPEN}
      AND is_active = TRUE
    ORDER BY opened_at DESC
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

/**
 * Sets org_orders_mst.created_pos_session_id once.
 * When posSessionId is omitted, uses the caller's open session on the order branch.
 * A second call does not move the order: the update matches only a still-null column,
 * and the database trigger rejects any later change.
 */
export async function stampCreatedPosSession(
  db: SessionDb,
  input: {
    tenantId: string;
    orderId: string;
    userId?: string | null;
    branchId?: string | null;
    posSessionId?: string | null;
  },
): Promise<void> {
  if (input.posSessionId) {
    await db.$executeRaw(Prisma.sql`
      UPDATE public.org_orders_mst AS o
      SET created_pos_session_id = s.id
      FROM public.org_pos_sessions_mst AS s
      WHERE o.tenant_org_id = ${input.tenantId}::uuid
        AND o.id = ${input.orderId}::uuid
        AND o.created_pos_session_id IS NULL
        AND s.tenant_org_id = o.tenant_org_id
        AND s.id = ${input.posSessionId}::uuid
        AND s.branch_id = o.branch_id
        AND s.status = ${POS_SESSION_STATUS.OPEN}
        AND s.is_active = TRUE
    `);
    return;
  }

  if (!input.userId) return;

  const branchSql = input.branchId
    ? Prisma.sql`AND s.branch_id = ${input.branchId}::uuid`
    : Prisma.empty;

  await db.$executeRaw(Prisma.sql`
    UPDATE public.org_orders_mst AS o
    SET created_pos_session_id = s.id
    FROM public.org_pos_sessions_mst AS s
    WHERE o.tenant_org_id = ${input.tenantId}::uuid
      AND o.id = ${input.orderId}::uuid
      AND o.created_pos_session_id IS NULL
      AND s.tenant_org_id = o.tenant_org_id
      AND s.user_id = ${input.userId}::uuid
      AND s.branch_id = o.branch_id
      AND s.status = ${POS_SESSION_STATUS.OPEN}
      AND s.is_active = TRUE
      ${branchSql}
      AND s.id = (
        SELECT id
        FROM public.org_pos_sessions_mst
        WHERE tenant_org_id = ${input.tenantId}::uuid
          AND user_id = ${input.userId}::uuid
          AND status = ${POS_SESSION_STATUS.OPEN}
          AND is_active = TRUE
          ${input.branchId ? Prisma.sql`AND branch_id = ${input.branchId}::uuid` : Prisma.empty}
        ORDER BY opened_at DESC
        LIMIT 1
      )
  `);
}
