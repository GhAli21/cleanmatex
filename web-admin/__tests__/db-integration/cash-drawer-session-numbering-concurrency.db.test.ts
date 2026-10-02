/**
 * A1-5 (POS Session & Cash Drawer Hardening, Wave A) — real concurrency proof
 * for `generate_cash_drawer_sess_no()` (renamed from generate_session_no)
 * after migration 0519 (advisory lock + the
 * substring-parse fix) and the `openSession` that calls it inside
 * the insert transaction.
 *
 * The unit tests for `cash-drawer.service` mock Prisma entirely, so they
 * cannot demonstrate that the advisory lock genuinely serializes concurrent
 * callers. Only a real Postgres instance under real concurrency can: this
 * file fires simultaneous `openSession` calls across several drawers of one
 * tenant and asserts every resulting `session_no` is unique and the
 * sequence for the day is gapless.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  resolveTestScope,
  createTestDrawer,
  openTestSession,
  closeTestSession,
  cleanupTestDrawers,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const DRAWER_CODE_PREFIX = 'A1-5-TEST';
const DRAWER_COUNT = 5;
const ROUNDS = 4; // 5 drawers x 4 rounds = 20 total opens (A1-5's stated scale)

let dbUp = false;
let scope: DbTestScope | null = null;
let drawerIds: string[] = [];

beforeAll(async () => {
  scope = await resolveTestScope();
  dbUp = scope !== null;

  if (!dbUp) return;

  drawerIds = [];
  for (let i = 0; i < DRAWER_COUNT; i += 1) {
    drawerIds.push(
      await createTestDrawer(scope!, {
        codePrefix: DRAWER_CODE_PREFIX,
        name: `A1-5 concurrency test drawer ${i}`,
      }),
    );
  }
});

afterAll(async () => {
  if (dbUp && scope && drawerIds.length > 0) {
    await cleanupTestDrawers(scope, drawerIds).catch(() => { /* best-effort cleanup */ });
  }
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-session-numbering-concurrency] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('generate_cash_drawer_sess_no() — real concurrency proof (A1-5, migration 0519)', () => {
  dbit(
    `${DRAWER_COUNT} simultaneous opens across ${DRAWER_COUNT} drawers produce distinct, gapless session numbers`,
    async () => {
      const openedBy = randomUUID();

      const sessions = await Promise.all(
        drawerIds.map((drawerId) =>
          openTestSession(scope!, openedBy, drawerId)
        )
      );

      const sessionNos = sessions.map((s) => s.sessionNo);

      // No two concurrent callers computed the same sequence value — the
      // property the old count(*) path and the unlocked function could not
      // guarantee.
      expect(new Set(sessionNos).size).toBe(DRAWER_COUNT);

      // Every session_no matches the SES-YYYYMMDD-NNNN contract (not the
      // legacy SES-NNNNNN format the service used to produce).
      for (const no of sessionNos) {
        expect(no).toMatch(/^SES-\d{8}-\d{4}$/);
      }

      // Gapless: the sequence numbers extracted from this batch are
      // consecutive integers, not sparse (which would indicate the lock let
      // callers skip values) or colliding (which the Set check above would
      // already have caught).
      const seqNumbers = sessionNos.map((no) => Number(no.slice(-4))).sort((a, b) => a - b);
      for (let i = 1; i < seqNumbers.length; i += 1) {
        expect(seqNumbers[i]).toBe(seqNumbers[i - 1] + 1);
      }

      // Close every session opened by this test — each drawer allows only
      // one OPEN session at a time (uq_open_cash_drawer_session), and the
      // next test reuses these same drawers.
      await Promise.all(
        sessions.map((s, i) => closeTestSession(scope!, openedBy, drawerIds[i], s.sessionId, { countedAmount: 0 }))
      );
    }
  );

  dbit(
    `${ROUNDS} further rounds of concurrent open+close across the same ${DRAWER_COUNT} drawers stay collision-free and gapless for the whole day`,
    async () => {
      const openedBy = randomUUID();
      const allSessionNos: string[] = [];

      for (let round = 0; round < ROUNDS; round += 1) {
        const opened = await Promise.all(
          drawerIds.map((drawerId) =>
            openTestSession(scope!, openedBy, drawerId)
          )
        );
        allSessionNos.push(...opened.map((s) => s.sessionNo));

        // Close every session so the next round's opens are legal (only one
        // OPEN session per drawer is allowed — uq_open_cash_drawer_session).
        await Promise.all(
          opened.map((s, i) =>
            closeTestSession(scope!, openedBy, drawerIds[i], s.sessionId, { countedAmount: 0 })
          )
        );
      }

      expect(new Set(allSessionNos).size).toBe(allSessionNos.length);

      const seqNumbers = allSessionNos.map((no) => Number(no.slice(-4))).sort((a, b) => a - b);
      for (let i = 1; i < seqNumbers.length; i += 1) {
        expect(seqNumbers[i]).toBe(seqNumbers[i - 1] + 1);
      }
    }
  );
});
