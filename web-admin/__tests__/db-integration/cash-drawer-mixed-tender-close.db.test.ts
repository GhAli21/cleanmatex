/**
 * A6-8 (POS Session & Cash Drawer Hardening, Wave A) — real-DB proof that a drawer closes
 * BALANCED across 200 mixed-tender orders with cash-change rounding.
 *
 * Every other order is a cash order paid with a larger note: the receipt line keeps the exact
 * amount, the change is rounded to the OMR cash increment (5 baisa, business bears it) and the gap
 * is its own rounding line — exactly the shape `postCashChangeRoundingTx` writes — while the
 * orders in between are card payments that never touch the drawer. Each line goes through the
 * production ledger gate. The drawer's counted cash (what the till physically holds) is computed
 * independently in integer baisa; the close must report zero variance, the ledger sequence must be
 * gapless, and the card lines must carry no cash effect at all.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { startClose, finalizeClose } from '@/lib/services/cash-drawer-session.service';
import { computeCashChangeRounding } from '@/lib/money/cash-rounding';
import { CURRENCY_ROUNDING_MODES } from '@/lib/constants/order-financial';
import { CASH_DRAWER_DISPOSITIONS } from '@/lib/constants/cash-drawer';
import {
  resolveTestScope,
  createTestDrawer,
  openTestSession,
  stampTestCashLine,
  readLineStamp,
  cleanupTestDrawers,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const ORDER_COUNT = 200;
const INCREMENT_MINOR = 5; // OMR cash increment: 5 baisa
const DECIMALS = 3;

let dbUp = false;
let scope: DbTestScope | null = null;

beforeAll(async () => {
  scope = await resolveTestScope();
  dbUp = scope !== null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const toMajor = (baisa: number) => (baisa / 1000).toFixed(DECIMALS);

describe('a drawer closes balanced across 200 mixed-tender orders (A6-8)', () => {
  it(
    'cash orders with rounded change and card orders net to exactly the counted cash',
    async () => {
      if (!dbUp) {
        console.warn('[cash-drawer-mixed-tender-close] DB unavailable — skipping');
        return;
      }

      const actor = '00000000-0000-4000-8000-0000000000a6';
      const drawerId = await createTestDrawer(scope!, { codePrefix: 'A6-8-TEST', name: 'A6-8 mixed tender' });
      try {
        const opened = await openTestSession(scope!, actor, drawerId);

        let expectedBaisa = 0; // what the till physically holds, computed independently of the ledger
        let cashOrders = 0;
        let roundingLines = 0;
        const cardLineIds: string[] = [];
        const drawerLineIds: string[] = [];

        for (let i = 0; i < ORDER_COUNT; i += 1) {
          if (i % 2 === 1) {
            // Card: never a drawer effect, whatever the amount.
            const card = await stampTestCashLine(scope!, {
              drawerId,
              amount: toMajor(1500 + i * 7),
              mode: 'INTERACTIVE',
              method: 'CARD',
            });
            cardLineIds.push(card.lineId);
            continue;
          }

          // Cash: amounts that rarely sit on the 5-baisa grid (…001..…004, …006..…009), paid with a 20.000 note.
          const amountBaisa = 2003 + i * 13 + (i % 4);
          const tenderedBaisa = 20_000;
          const exactChangeBaisa = tenderedBaisa - amountBaisa;

          const rounding = computeCashChangeRounding({
            exactChange: exactChangeBaisa / 1000,
            maxChange: tenderedBaisa / 1000,
            decimalPlaces: DECIMALS,
            incrementMinor: INCREMENT_MINOR,
            mode: CURRENCY_ROUNDING_MODES.CEILING, // business bears the fraction
          });
          const adjustmentBaisa = Math.round(rounding.adjustment * 1000);

          const receipt = await stampTestCashLine(scope!, {
            drawerId,
            amount: toMajor(amountBaisa),
            mode: 'INTERACTIVE',
            direction: 'IN',
          });
          drawerLineIds.push(receipt.lineId);
          expectedBaisa += amountBaisa;
          cashOrders += 1;

          if (adjustmentBaisa !== 0) {
            // loss (adjustment < 0): the drawer paid out more than the exact change -> OUT; gain -> IN.
            const line = await stampTestCashLine(scope!, {
              drawerId,
              amount: toMajor(Math.abs(adjustmentBaisa)),
              mode: 'INTERACTIVE',
              direction: adjustmentBaisa < 0 ? 'OUT' : 'IN',
            });
            drawerLineIds.push(line.lineId);
            expectedBaisa += adjustmentBaisa;
            roundingLines += 1;
          }
        }

        // The scenario must really exercise rounding both ways of "mixed": enough rounding lines to matter.
        expect(cashOrders).toBe(ORDER_COUNT / 2);
        expect(roundingLines).toBeGreaterThan(40);

        // Card lines carry no cash effect at all.
        for (const lineId of cardLineIds) {
          expect((await readLineStamp(scope!, lineId)).cash_effect_code).toBeNull();
        }

        // Cash and rounding lines took gapless ledger sequence numbers 1..N in posting order.
        const seqs = (await Promise.all(drawerLineIds.map((id) => readLineStamp(scope!, id)))).map((s) => s.seq);
        expect(seqs).toEqual(Array.from({ length: drawerLineIds.length }, (_, k) => k + 1));

        // Count exactly what the till holds: the close must be balanced to the last baisa.
        const counted = toMajor(expectedBaisa);
        const started = await startClose(scope!.tenantId, actor, {
          sessionId: opened.sessionId,
          drawerId,
          closingCount: { countMode: 'TOTAL_ONLY', totalAmount: Number(counted) },
        });
        expect(started.currencyBalances[0]).toMatchObject({
          closingExpected: `${counted}0`, // stored with 4 decimals
          closingVariance: '0.0000',
        });

        const finalized = await finalizeClose(scope!.tenantId, actor, {
          sessionId: opened.sessionId,
          drawerId,
          dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER }],
        });
        expect(finalized.status).toBe('CLOSED');
        expect(finalized.varianceApprovalPending).toBe(false);
      } finally {
        await cleanupTestDrawers(scope!, [drawerId]);
      }
    },
    600_000,
  );
});
