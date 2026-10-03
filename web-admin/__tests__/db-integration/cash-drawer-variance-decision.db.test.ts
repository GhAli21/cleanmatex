/**
 * C3 — real-DB proof of the variance decision flow (migration 0559): a pending over-threshold
 * variance shows in the queue, a supervisor rejects it with a reason (final, never both approved
 * and rejected — enforced by the database too), the queue moves it to REJECTED, and the branch
 * scope hides it from other branches.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { approveVariance, rejectVariance } from '@/lib/services/cash-drawer-session.service';
import { listVarianceDecisionQueue } from '@/lib/services/cash-drawer-variance-queue.service';
import { VARIANCE_APPROVAL_ERRORS } from '@/lib/services/cash-drawer.service';
import {
  cleanupTestDrawers,
  closeTestSession,
  createTestDrawer,
  openTestSession,
  resolveTestScope,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
let realUserId = '';

beforeAll(async () => {
  scope = await resolveTestScope();
  if (!scope) return;
  const [user] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM public.org_users_mst WHERE tenant_org_id = ${scope.tenantId}::uuid ORDER BY created_at LIMIT 1`;
  realUserId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!scope) {
        console.warn(`[cash-drawer-variance-decision] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    120_000,
  );
}

/** A closed drawer session that tripped its variance threshold and has no decision yet. */
async function createPendingVarianceSession(): Promise<{ drawerId: string; sessionId: string }> {
  const drawerId = await createTestDrawer(scope!, { codePrefix: 'C3-TEST', name: 'C3 variance decision' });
  const actor = randomUUID();
  const { sessionId } = await openTestSession(scope!, actor, drawerId);
  await closeTestSession(scope!, actor, drawerId, sessionId, { countedAmount: 0 });
  // The close above is balanced; mark it as having tripped a threshold the way finalize does.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_ledger_edit = 'on'`);
    await tx.$executeRaw`
      UPDATE public.org_cash_drawer_sessions_mst SET variance_threshold_snapshot = 5
      WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sessionId}::uuid`;
  });
  return { drawerId, sessionId };
}

const queue = (decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL', branchIds?: string[]) =>
  listVarianceDecisionQueue(scope!.tenantId, { decision, page: 1, pageSize: 100 }, branchIds);

describe('cash drawer variance decision (C3)', () => {
  dbit('a rejected variance leaves the pending queue, is final, and keeps who/when/why', async () => {
    const { drawerId, sessionId } = await createPendingVarianceSession();
    try {
      expect((await queue('PENDING')).rows.map((r) => r.sessionId)).toContain(sessionId);

      await rejectVariance(scope!.tenantId, realUserId, sessionId, { reason: 'Recount before accepting' });

      expect((await queue('PENDING')).rows.map((r) => r.sessionId)).not.toContain(sessionId);
      const rejected = (await queue('REJECTED')).rows.find((r) => r.sessionId === sessionId);
      expect(rejected).toMatchObject({
        decision: 'REJECTED',
        decidedById: realUserId,
        decisionReason: 'Recount before accepting',
        thresholdSnapshot: '5.0000',
      });
      expect(rejected!.decidedAt).not.toBeNull();

      // Final: neither a second rejection nor an approval is possible.
      await expect(rejectVariance(scope!.tenantId, realUserId, sessionId, { reason: 'again' })).rejects.toMatchObject({
        code: VARIANCE_APPROVAL_ERRORS.ALREADY_REJECTED,
      });
      await expect(approveVariance(scope!.tenantId, realUserId, sessionId, { reason: 'changed my mind' })).rejects.toMatchObject({
        code: VARIANCE_APPROVAL_ERRORS.ALREADY_REJECTED,
      });

      // The database itself refuses a session that is both approved and rejected.
      await expect(
        prisma.$executeRaw`
          UPDATE public.org_cash_drawer_sessions_mst
          SET variance_approved_by = ${realUserId}::uuid, variance_approved_at = NOW(), variance_approval_reason = 'x'
          WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sessionId}::uuid`,
      ).rejects.toThrow(/chk_ocds_var_decision/);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });

  dbit('an approved variance moves to APPROVED and can no longer be rejected', async () => {
    const { drawerId, sessionId } = await createPendingVarianceSession();
    try {
      await approveVariance(scope!.tenantId, realUserId, sessionId, { reason: 'Accepted after review' });
      expect((await queue('APPROVED')).rows.find((r) => r.sessionId === sessionId)).toMatchObject({
        decision: 'APPROVED',
        decisionReason: 'Accepted after review',
      });
      await expect(rejectVariance(scope!.tenantId, realUserId, sessionId, { reason: 'too late' })).rejects.toMatchObject({
        code: VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED,
      });
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });

  dbit('the queue only shows the branches the actor may see', async () => {
    const { drawerId, sessionId } = await createPendingVarianceSession();
    try {
      expect((await queue('PENDING', [scope!.branchId])).rows.map((r) => r.sessionId)).toContain(sessionId);
      expect((await queue('PENDING', [randomUUID()])).rows).toHaveLength(0);
      expect((await queue('PENDING', [])).rows).toHaveLength(0);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });
});
