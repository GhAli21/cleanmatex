/**
 * A2-6 (POS Session & Cash Drawer Hardening, Wave A) — real concurrency
 * proof that the per-drawer row lock (`lockDrawersTx`, shared by the session
 * lifecycle and the CLF ledger gate — see `cash-drawer-lock.ts`) actually
 * serializes cash-drawer mutations against each other, for the two scenarios not
 * already covered by `cash-drawer-session-numbering-concurrency.db.test.ts`
 * (concurrent open x N and open+close cycles):
 *
 *   - concurrent close x2 on the SAME session
 *   - a drawer "Cash in / Cash out" movement (CLF W11) racing the count step on
 *     the SAME drawer: whichever the lock admits first, the movement is either
 *     inside the frozen cut (and counted in the closing expected) or refused by
 *     the gate — it can never land after the cut unseen.
 *
 * Runs through the real two-step lifecycle (`cash-drawer-session.service`).
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { startClose } from '@/lib/services/cash-drawer-session.service';
import { CashDrawerSessionError } from '@/lib/services/cash-drawer.service';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { LINE_ROLE } from '@/lib/constants/voucher';
import {
  resolveTestScope,
  createTestDrawer,
  openTestSession,
  closeTestSession,
  cleanupTestDrawers,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const DRAWER_CODE_PREFIX = 'A2-6-TEST';

let dbUp = false;
let scope: DbTestScope | null = null;

beforeAll(async () => {
  scope = await resolveTestScope();
  dbUp = scope !== null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const makeDrawer = () => createTestDrawer(scope!, { codePrefix: DRAWER_CODE_PREFIX, name: 'A2-6 concurrency test drawer' });
const cleanupDrawer = (drawerId: string) => cleanupTestDrawers(scope!, [drawerId]);

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-mutation-locking] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('per-drawer lock — real concurrency proof (A2-6)', () => {
  dbit('two concurrent closes of the same session: exactly one succeeds, the other fails cleanly', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      const session = await openTestSession(scope!, actor, drawerId);

      const results = await Promise.allSettled([
        closeTestSession(scope!, actor, drawerId, session.sessionId, { countedAmount: 0 }),
        closeTestSession(scope!, actor, drawerId, session.sessionId, { countedAmount: 0 }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // The lock serializes the two closes: the loser sees the session already
      // past OPEN/CLOSING instead of both reading OPEN and both writing a close.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
        where: { id: session.sessionId, tenant_org_id: scope!.tenantId },
      });
      expect(finalSession.status).toBe('CLOSED');
    } finally {
      await cleanupDrawer(drawerId);
    }
  });

  dbit('a Cash in/Cash out movement (CLF W11) racing the count step is either inside the cut or refused — never after it', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      const session = await openTestSession(scope!, actor, drawerId);

      const results = await Promise.allSettled([
        startClose(scope!.tenantId, actor, {
          sessionId: session.sessionId,
          drawerId,
          closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 0 },
        }),
        postDrawerCashMovement(scope!.tenantId, actor, {
          drawerId,
          cashDrawerSessionId: session.sessionId,
          lineRole: LINE_ROLE.CASH_PAY_IN,
          amount: 5,
          reason: 'race test',
          idempotencyKey: `race-test-${randomUUID()}`,
        }),
      ]);

      const [closeResult, movementResult] = results;
      expect(closeResult.status).toBe('fulfilled');
      if (closeResult.status !== 'fulfilled') return;

      // Whichever the lock let through first, the outcome must be consistent:
      // a movement the gate admitted is inside the frozen window and counted in
      // the closing expected; one that arrived after the cut was refused.
      const row = closeResult.value.currencyBalances.find((b) => b.currencyCode === 'OMR');
      if (movementResult.status === 'fulfilled') {
        expect(row?.closingExpected).toBe('5.0000');
        const line = await prisma.org_fin_voucher_trx_lines_dtl.findFirstOrThrow({
          where: { voucher_id: movementResult.value.voucherId, tenant_org_id: scope!.tenantId, cash_effect_code: 'DRAWER' },
          select: { cash_ledger_seq: true, cash_drawer_session_id: true },
        });
        const closing = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
          where: { id: session.sessionId, tenant_org_id: scope!.tenantId },
          select: { close_ledger_seq: true },
        });
        expect(line.cash_drawer_session_id).toBe(session.sessionId);
        expect(Number(line.cash_ledger_seq)).toBeLessThanOrEqual(Number(closing.close_ledger_seq));
      } else {
        expect(movementResult.reason).toBeInstanceOf(CashDrawerLedgerError);
        expect(row?.closingExpected).toBe('0.0000');
      }
    } finally {
      await cleanupDrawer(drawerId);
    }
  });

  dbit('CashDrawerSessionError carries the ALREADY_OPEN code on a double-open race', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      await openTestSession(scope!, actor, drawerId);

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => openTestSession(scope!, actor, drawerId))
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
