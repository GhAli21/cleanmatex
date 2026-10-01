/**
 * A2-6 (POS Session & Cash Drawer Hardening, Wave A) — real concurrency
 * proof that `lockDrawerScope` (the per-drawer transaction-scoped row lock
 * added in A2, later unified with the CLF ledger's own `lockDrawersTx` — see
 * `cash-drawer-lock.ts`) actually serializes cash-drawer mutations against
 * each other, for the two scenarios not already covered by
 * `cash-drawer-session-numbering-concurrency.db.test.ts` (which proves
 * concurrent open x N and open+close cycles):
 *
 *   - concurrent close x2 on the SAME session
 *   - a drawer "Cash in / Cash out" movement (CLF W11) racing a close on the
 *     SAME drawer — updated from the deleted `recordMovement` write path to
 *     `postDrawerCashMovement` (voucher + gate) when W11 replaced it; the gate
 *     takes the exact same row lock (`lockDrawersTx`), so the same guarantee
 *     holds for the new path.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  openSession,
  closeSession,
  CashDrawerSessionError,
} from '@/lib/services/cash-drawer.service';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { LINE_ROLE } from '@/lib/constants/voucher';

const DRAWER_CODE_PREFIX = 'A2-6-TEST';

let dbUp = false;
let tenantId = '';
let branchId = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantId = tenants[0]?.id ?? '';

    if (tenantId) {
      const branches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_branches_mst WHERE tenant_org_id = ${tenantId}::uuid LIMIT 1`;
      branchId = branches[0]?.id ?? '';
    }

    dbUp = tenantId.length > 0 && branchId.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeDrawer(): Promise<string> {
  const drawer = await prisma.org_cash_drawers_mst.create({
    data: {
      tenant_org_id: tenantId,
      branch_id: branchId,
      drawer_code: `${DRAWER_CODE_PREFIX}-${randomUUID().slice(0, 8)}`,
      drawer_name: 'A2-6 concurrency test drawer',
      drawer_type: 'TEMPORARY',
      currency_code: 'OMR',
      requires_session: true,
      opening_float_required: false,
      is_active: true,
      rec_status: 1,
    },
  });
  return drawer.id;
}

async function cleanupDrawer(drawerId: string): Promise<void> {
  const vouchers = await prisma.org_fin_vouchers_mst
    .findMany({ where: { source_ref_id: drawerId, tenant_org_id: tenantId }, select: { id: true } })
    .catch(() => []);
  const voucherIds = vouchers.map((v) => v.id);
  if (voucherIds.length > 0) {
    await prisma.org_fin_voucher_trx_lines_dtl.deleteMany({ where: { voucher_id: { in: voucherIds }, tenant_org_id: tenantId } }).catch(() => {});
    await prisma.org_fin_vouchers_mst.deleteMany({ where: { id: { in: voucherIds }, tenant_org_id: tenantId } }).catch(() => {});
  }
  await prisma.org_cash_drawer_movements_dtl.deleteMany({ where: { cash_drawer_id: drawerId, tenant_org_id: tenantId } }).catch(() => {});
  await prisma.org_cash_drawer_sessions_mst.deleteMany({ where: { cash_drawer_id: drawerId, tenant_org_id: tenantId } }).catch(() => {});
  await prisma.org_cash_drawers_mst.deleteMany({ where: { id: drawerId, tenant_org_id: tenantId } }).catch(() => {});
}

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-mutation-locking] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('lockDrawerScope — real concurrency proof (A2-6)', () => {
  dbit('two concurrent closeSession calls on the same session: exactly one succeeds, the other fails cleanly', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      const session = await openSession(tenantId, drawerId, { openingBalance: 10, openedBy: actor });

      const results = await Promise.allSettled([
        closeSession(tenantId, session.id, { physicalCount: 10, closedBy: actor }),
        closeSession(tenantId, session.id, { physicalCount: 10, closedBy: actor }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // The lock serializes the two closes rather than letting them race:
      // the second one's own findFirstOrThrow (status: 'OPEN') fails once
      // the first has already transitioned the session to CLOSED, instead
      // of both reading OPEN and both computing/writing a close.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
        where: { id: session.id, tenant_org_id: tenantId },
      });
      expect(finalSession.status).toBe('CLOSED');
    } finally {
      await cleanupDrawer(drawerId);
    }
  });

  dbit('a Cash in/Cash out movement (CLF W11) racing a close on the same drawer never lands after the drawer has closed', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      const session = await openSession(tenantId, drawerId, { openingBalance: 10, openedBy: actor });

      const results = await Promise.allSettled([
        closeSession(tenantId, session.id, { physicalCount: 10, closedBy: actor }),
        postDrawerCashMovement(tenantId, actor, {
          drawerId,
          cashDrawerSessionId: session.id,
          lineRole: LINE_ROLE.CASH_PAY_IN,
          amount: 5,
          reason: 'race test',
          idempotencyKey: `race-test-${randomUUID()}`,
        }),
      ]);

      const [closeResult, movementResult] = results;
      expect(closeResult.status).toBe('fulfilled');

      // Whichever the lock let through first, the outcome must be
      // consistent: a movement that landed AFTER the lock decided the
      // session was already closed must have been refused by the gate
      // (CashDrawerLedgerError), never silently attached to a closed session.
      if (movementResult.status === 'fulfilled') {
        const created = await prisma.org_cash_drawer_movements_dtl.findFirst({
          where: { fin_voucher_id: movementResult.value.voucherId, tenant_org_id: tenantId },
        });
        expect(created?.cash_drawer_session_id).toBe(session.id);
      } else {
        expect(movementResult.reason).toBeInstanceOf(CashDrawerLedgerError);
      }

      // Either way, the movements actually recorded against this session
      // are exactly what the final expected_cash_amount accounts for — no
      // movement can exist that the close's own aggregate never saw.
      const finalSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
        where: { id: session.id, tenant_org_id: tenantId },
      });
      const movementSum = await prisma.org_cash_drawer_movements_dtl.aggregate({
        where: { cash_drawer_session_id: session.id, direction: 'IN', tenant_org_id: tenantId },
        _sum: { amount: true },
      });
      const movementTotal = Number(movementSum._sum.amount ?? 0);
      const expectedFromOpeningAndMovements =
        Number(finalSession.opening_float_amount) + movementTotal;
      expect(Number(finalSession.expected_cash_amount)).toBe(expectedFromOpeningAndMovements);
    } finally {
      await cleanupDrawer(drawerId);
    }
  });

  dbit('CashDrawerSessionError carries the ALREADY_OPEN code on a double-open race', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      await openSession(tenantId, drawerId, { openingBalance: 10, openedBy: actor });

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => openSession(tenantId, drawerId, { openingBalance: 10, openedBy: actor }))
      );

      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(CashDrawerSessionError);
        expect((r.reason as CashDrawerSessionError).code).toBe('DRAWER_SESSION_ALREADY_OPEN');
      }
    } finally {
      await cleanupDrawer(drawerId);
    }
  });
});
