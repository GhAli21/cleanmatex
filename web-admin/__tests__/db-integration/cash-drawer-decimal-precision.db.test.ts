/**
 * A3-5 (POS Session & Cash Drawer Hardening, Wave A) — real-DB proof that the
 * session's Decimal-space expected-cash computation does not drift under a long
 * sequence of 3-decimal-currency amounts, the exact class of bug the old
 * `toNumber()` + JS `+`/`-` write path had (drift the same way
 * `0.1 + 0.2 !== 0.3` does in binary floating point).
 *
 * Re-pointed at the cash ledger (CLF R3): each 0.005 OMR cash-in goes through the
 * production write path (voucher + ledger gate), and the count step sums the
 * session window in the database. The total must equal the exact decimal sum and
 * close with zero variance — not "close enough" under the tolerance.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { startClose, finalizeClose } from '@/lib/services/cash-drawer-session.service';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { CASH_DRAWER_DISPOSITIONS } from '@/lib/constants/cash-drawer';
import {
  resolveTestScope,
  createTestDrawer,
  openTestSession,
  cleanupTestDrawers,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const DRAWER_CODE_PREFIX = 'A3-5-TEST';
const PAYMENT_COUNT = 200;
const PAYMENT_AMOUNT = '0.005'; // OMR minor unit is 0.001 — this is 5 baisa
const EXPECTED_TOTAL = '1.0000'; // 200 x 0.005, exact in fixed-point

let dbUp = false;
let scope: DbTestScope | null = null;

beforeAll(async () => {
  scope = await resolveTestScope();
  dbUp = scope !== null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!dbUp) {
        console.warn(`[cash-drawer-decimal-precision] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    300_000,
  );
}

describe('count step Decimal-space precision under a long cash sequence (A3-5)', () => {
  dbit(
    `${PAYMENT_COUNT} sequential ${PAYMENT_AMOUNT} OMR cash-ins close with EXACT zero variance`,
    async () => {
      const actor = randomUUID();
      const drawerId = await createTestDrawer(scope!, { codePrefix: DRAWER_CODE_PREFIX, name: 'A3-5 Decimal precision test drawer' });
      try {
        const session = await openTestSession(scope!, actor, drawerId);

        // Sequential, not batched: mirrors real cash landing one movement at a
        // time over a shift, and keeps the ledger sequence ordered.
        for (let i = 0; i < PAYMENT_COUNT; i += 1) {
          await postDrawerCashMovement(scope!.tenantId, actor, {
            drawerId,
            cashDrawerSessionId: session.sessionId,
            lineRole: LINE_ROLE.CASH_PAY_IN,
            amount: PAYMENT_AMOUNT,
            reason: 'A3-5 decimal precision',
            idempotencyKey: `a3-5-${randomUUID()}`,
          });
        }

        const started = await startClose(scope!.tenantId, actor, {
          sessionId: session.sessionId,
          drawerId,
          closingCount: { countMode: 'TOTAL_ONLY', totalAmount: EXPECTED_TOTAL },
        });

        // Money crosses the service as an exact fixed-point string.
        const row = started.currencyBalances.find((b) => b.currencyCode === 'OMR');
        expect(row?.closingExpected).toBe(EXPECTED_TOTAL);
        expect(row?.closingCounted).toBe(EXPECTED_TOTAL);
        expect(row?.closingVariance).toBe('0.0000');

        const finalized = await finalizeClose(scope!.tenantId, actor, {
          sessionId: session.sessionId,
          drawerId,
          dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER }],
        });
        expect(finalized.status).toBe('CLOSED');
        expect(finalized.varianceApprovalPending).toBe(false);

        // Re-read from the DB (not the in-memory result) — the persisted value is
        // what every downstream reader (reports, session detail) sees.
        const persisted = await prisma.org_cash_drawer_ses_bal_dtl.findFirstOrThrow({
          where: { cash_drawer_session_id: session.sessionId, currency_code: 'OMR', tenant_org_id: scope!.tenantId },
        });
        expect(persisted.closing_expected?.toFixed(4)).toBe(EXPECTED_TOTAL);
        expect(persisted.closing_variance?.toFixed(4)).toBe('0.0000');
      } finally {
        await cleanupTestDrawers(scope!, [drawerId]);
      }
    },
  );
});
