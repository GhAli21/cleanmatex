/**
 * CLF-9 (plan §4B.14) — DB-integration matrix for the cash ledger: window chain math,
 * closing-window behaviour, custody transactions, immutability, locking and invariants.
 *
 * Every scenario drives the production paths (open -> gate -> count step -> finalize, custody
 * transactions, standalone counts), never synthetic rows, so a pass proves what production does.
 * The payment-versus-close race and numbering concurrency live in their own suites.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { openSession, startClose, finalizeClose, getClosePreview } from '@/lib/services/cash-drawer-session.service';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { updateCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { postDrawerTrx } from '@/lib/services/cash-drawer-trx.service';
import { recordSpotCount } from '@/lib/services/cash-drawer-count.service';
import { CASH_DRAWER_DISPOSITIONS, CASH_DRAWER_TRX_TYPES, CASH_DRAWER_COUNT_TYPES } from '@/lib/constants/cash-drawer';
import { CASH_CONTROL_COUNT_MODE } from '@/lib/constants/cash-control';
import {
  resolveTestScope,
  createTestDrawer,
  cleanupTestDrawers,
  stampTestCashLine,
  readLineStamp,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

const PREFIX = 'CLF-MATRIX';

let dbUp = false;
let scope: DbTestScope | null = null;

beforeAll(async () => {
  scope = await resolveTestScope();
  if (!scope) return;
  const cash = await prisma.$queryRaw<Array<{ v: boolean | null }>>`
    SELECT COALESCE(
      (SELECT requires_cash_drawer FROM public.org_payment_methods_cf
        WHERE tenant_org_id = ${scope.tenantId}::uuid AND payment_method_code = 'CASH' LIMIT 1),
      (SELECT requires_cash_drawer FROM public.sys_payment_method_cd WHERE payment_method_code = 'CASH'),
      TRUE) AS v`;
  dbUp = cash[0]?.v === true;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!dbUp) {
        console.warn(`[cash-drawer-ledger-matrix] DB unavailable or CASH not drawer-tracked — skipping: ${name}`);
        return;
      }
      await fn();
    },
    // The 500-line decimal-exactness case takes ~15 s alone and over 30 s when the whole DB suite runs in parallel.
    120_000,
  );
}

const drawer = (type: 'TEMPORARY' | 'SAFE' = 'TEMPORARY') =>
  createTestDrawer(scope!, { codePrefix: PREFIX, name: `CLF matrix ${type}`, type });

/** Count step + finalize leaving the cash in the drawer; `counted` omitted = uncounted close. */
async function close(actor: string, drawerId: string, sessionId: string, counted?: number) {
  const started = await startClose(scope!.tenantId, actor, {
    sessionId,
    drawerId,
    closingCount: counted == null ? undefined : { countMode: 'TOTAL_ONLY', totalAmount: counted },
  });
  await finalizeClose(scope!.tenantId, actor, {
    sessionId,
    drawerId,
    dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER }],
  });
  return started;
}

const session = (id: string) =>
  prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({ where: { id, tenant_org_id: scope!.tenantId } });
const balance = (sessionId: string) =>
  prisma.org_cash_drawer_ses_bal_dtl.findFirstOrThrow({
    where: { cash_drawer_session_id: sessionId, currency_code: 'OMR', tenant_org_id: scope!.tenantId },
  });
const drawerRow = (id: string) =>
  prisma.org_cash_drawers_mst.findFirstOrThrow({ where: { id, tenant_org_id: scope!.tenantId } });

describe('window chain math (§4B.3 / §4B.14 unit rows, proven on the real ledger)', () => {
  dbit('first session starts at 0; between-session cash and an opening-count override chain into the next windows', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    try {
      // S1: first session on a brand-new drawer — nothing before it.
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      expect(s1.currencyBalances[0].openingExpected).toBe('0.0000');
      await stampTestCashLine(scope!, { drawerId, amount: 10, mode: 'INTERACTIVE' });
      await close(actor, drawerId, s1.sessionId, 10);

      // Between S1 and S2: cash recognised with no session open (deferred) belongs to neither.
      await stampTestCashLine(scope!, { drawerId, amount: 5, mode: 'DEFERRED' });

      // S2 opens expecting what S1 left (10) plus the between-session cash (5); the cashier
      // physically counts 14 — the count overrides the system figure as the new baseline (P4).
      const s2 = await openSession(scope!.tenantId, actor, {
        drawerId,
        openingCount: { countMode: 'TOTAL_ONLY', totalAmount: 14 },
      });
      expect(s2.currencyBalances[0]).toMatchObject({
        openingExpected: '15.0000',
        openingCounted: '14.0000',
        openingVariance: '-1.0000',
      });

      // S2 takes 3 more cash and closes UNCOUNTED: expected = counted opening (14) + 3.
      await stampTestCashLine(scope!, { drawerId, amount: 3, mode: 'INTERACTIVE' });
      const started = await startClose(scope!.tenantId, actor, { sessionId: s2.sessionId, drawerId });
      expect(started.currencyBalances[0]).toMatchObject({
        closingExpected: '17.0000',
        closingCounted: null,
        closingVariance: null,
      });
      await finalizeClose(scope!.tenantId, actor, {
        sessionId: s2.sessionId,
        drawerId,
        dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER }],
      });
      // Uncounted close: the basis is the expected figure, which the next session inherits.
      expect((await balance(s2.sessionId)).closing_basis?.toString()).toBe('17');
      const s3 = await openSession(scope!.tenantId, actor, { drawerId });
      expect(s3.currencyBalances[0].openingExpected).toBe('17.0000');
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });

  dbit('a partial disposition carries only the kept amount forward and posts the removed part to the safe', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const safeId = await drawer('SAFE');
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 50, mode: 'INTERACTIVE' });
      await startClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 50 },
      });
      const done = await finalizeClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        dispositions: [
          {
            currencyCode: 'OMR',
            dispositionCode: CASH_DRAWER_DISPOSITIONS.PARTIAL_REMOVED,
            destDrawerId: safeId,
            keptAmount: 20,
            dispositionNotes: 'CLF matrix: 20 kept for the next float',
          },
        ],
      });
      const trxLines = await prisma.org_cash_drawer_trx_dtl.findMany({
        where: { trx_id: done.dispositionTrxId as string, tenant_org_id: scope!.tenantId },
      });
      expect(trxLines.map((l) => [l.direction, Number(l.amount)]).sort()).toEqual([
        ['IN', 30],
        ['OUT', 30],
      ]);
      expect((await balance(s1.sessionId)).disposition_kept_amount?.toString()).toBe('20');
      const s2 = await openSession(scope!.tenantId, actor, { drawerId });
      expect(s2.currencyBalances[0].openingExpected).toBe('20.0000');
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, safeId]);
    }
  });

  dbit('a full move to the safe leaves nothing behind: the next session opens at 0, not at minus the moved cash', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const safeId = await drawer('SAFE');
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 40, mode: 'INTERACTIVE' });
      await startClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 40 },
      });
      await finalizeClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        dispositions: [
          { currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.MOVED_TO_SAFE, destDrawerId: safeId },
        ],
      });
      // The disposition transfer (-40) sits after the cut, so it is part of the chain exactly once.
      const s2 = await openSession(scope!.tenantId, actor, { drawerId });
      expect(s2.currencyBalances[0].openingExpected).toBe('0.0000');
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, safeId]);
    }
  });

  dbit('a reversal posted after the close lands in the next window; the closed session is untouched', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 10, mode: 'INTERACTIVE' });
      await close(actor, drawerId, s1.sessionId, 10);
      const before = await balance(s1.sessionId);
      const cut = Number((await session(s1.sessionId)).close_ledger_seq);

      const reversal = await stampTestCashLine(scope!, { drawerId, amount: 10, direction: 'OUT', mode: 'DEFERRED' });
      const stamp = await readLineStamp(scope!, reversal.lineId);
      expect(stamp.cash_drawer_session_id).toBeNull();
      expect(stamp.seq).toBeGreaterThan(cut);

      const after = await balance(s1.sessionId);
      expect(after.closing_expected?.toString()).toBe(before.closing_expected?.toString());
      expect(after.closing_basis?.toString()).toBe(before.closing_basis?.toString());
      // …and the next session opens expecting 10 - 10 = 0.
      const s2 = await openSession(scope!.tenantId, actor, { drawerId });
      expect(s2.currencyBalances[0].openingExpected).toBe('0.0000');
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });
});

describe('the closing window (§4B.4)', () => {
  dbit('interactive cash is refused while CLOSING; deferred cash is accepted into the next window with no session', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 10, mode: 'INTERACTIVE' });
      await startClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 10 },
      });
      const cut = Number((await session(s1.sessionId)).close_ledger_seq);

      await expect(stampTestCashLine(scope!, { drawerId, amount: 1, mode: 'INTERACTIVE' })).rejects.toMatchObject({
        code: 'DRAWER_SESSION_CLOSING',
      });

      const late = await stampTestCashLine(scope!, { drawerId, amount: 2, mode: 'DEFERRED' });
      const stamp = await readLineStamp(scope!, late.lineId);
      expect(stamp.cash_effect_code).toBe('DRAWER');
      expect(stamp.cash_drawer_session_id).toBeNull();
      expect(stamp.seq).toBeGreaterThan(cut);
      // The frozen cut did not move.
      expect(Number((await session(s1.sessionId)).close_ledger_seq)).toBe(cut);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });
});

describe('custody transactions (§4B.5)', () => {
  dbit('line sequences and custody sequences share one gapless per-drawer counter under concurrency', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const otherId = await drawer('SAFE');
    try {
      await openSession(scope!.tenantId, actor, { drawerId });
      await Promise.all([
        ...Array.from({ length: 6 }, () => stampTestCashLine(scope!, { drawerId, amount: 1, mode: 'INTERACTIVE' })),
        ...Array.from({ length: 4 }, () =>
          postDrawerTrx(scope!.tenantId, actor, {
            trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
            branchId: scope!.branchId,
            lines: [
              { drawerId, direction: 'OUT', amount: 1, currencyCode: 'OMR' },
              { drawerId: otherId, direction: 'IN', amount: 1, currencyCode: 'OMR' },
            ],
          }),
        ),
      ]);

      const voucherSeqs = (
        await prisma.org_fin_voucher_trx_lines_dtl.findMany({
          where: { tenant_org_id: scope!.tenantId, cash_drawer_id: drawerId },
          select: { cash_ledger_seq: true },
        })
      ).map((r) => Number(r.cash_ledger_seq));
      const trxSeqs = (
        await prisma.org_cash_drawer_trx_dtl.findMany({
          where: { tenant_org_id: scope!.tenantId, cash_drawer_id: drawerId },
          select: { ledger_seq: true },
        })
      ).map((r) => Number(r.ledger_seq));
      const all = [...voucherSeqs, ...trxSeqs].sort((a, b) => a - b);
      expect(all).toHaveLength(10);
      expect(all).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
      expect(Number((await drawerRow(drawerId)).ledger_seq)).toBe(10);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, otherId]);
    }
  });

  dbit('a transaction whose second leg is refused rolls back both sides, including the sequence', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const otherId = await drawer('SAFE');
    try {
      await openSession(scope!.tenantId, actor, { drawerId });
      await prisma.org_cash_drawers_mst.updateMany({
        where: { id: otherId, tenant_org_id: scope!.tenantId },
        data: { is_active: false },
      });
      const seqBefore = Number((await drawerRow(drawerId)).ledger_seq);
      await expect(
        postDrawerTrx(scope!.tenantId, actor, {
          trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
          branchId: scope!.branchId,
          lines: [
            { drawerId, direction: 'OUT', amount: 5, currencyCode: 'OMR' },
            { drawerId: otherId, direction: 'IN', amount: 5, currencyCode: 'OMR' },
          ],
        }),
      ).rejects.toMatchObject({ code: 'CASH_DRAWER_INACTIVE' });
      expect(Number((await drawerRow(drawerId)).ledger_seq)).toBe(seqBefore);
      const lines = await prisma.org_cash_drawer_trx_dtl.count({
        where: { tenant_org_id: scope!.tenantId, cash_drawer_id: { in: [drawerId, otherId] } },
      });
      expect(lines).toBe(0);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, otherId]);
    }
  });

  dbit('the database itself rejects an unbalanced custody transaction at commit (trigger, not just the service)', async () => {
    const drawerId = await drawer();
    try {
      await expect(
        prisma.$transaction(async (tx) => {
          const trx = await tx.org_cash_drawer_trx_mst.create({
            data: {
              tenant_org_id: scope!.tenantId,
              branch_id: scope!.branchId,
              trx_no: `${PREFIX}-UNBAL-${randomUUID().slice(0, 8)}`,
              trx_type_code: CASH_DRAWER_TRX_TYPES.CASH_DROP,
              performed_by: 'clf-matrix-test',
            },
          });
          await tx.org_cash_drawer_trx_dtl.create({
            data: {
              tenant_org_id: scope!.tenantId,
              trx_id: trx.id,
              line_no: 1,
              cash_drawer_id: drawerId,
              ledger_seq: 1,
              direction: 'OUT',
              amount: 5,
              currency_code: 'OMR',
            },
          });
        }),
      ).rejects.toThrow(/CASH_TRX_UNBALANCED/);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });

  dbit('two drawers locked in opposite orders by concurrent transactions never deadlock', async () => {
    const actor = randomUUID();
    const a = await drawer();
    const b = await drawer();
    try {
      await openSession(scope!.tenantId, actor, { drawerId: a });
      await openSession(scope!.tenantId, actor, { drawerId: b });
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) =>
          postDrawerTrx(scope!.tenantId, actor, {
            trxTypeCode: CASH_DRAWER_TRX_TYPES.DRAWER_TO_DRAWER,
            branchId: scope!.branchId,
            notes: 'CLF matrix: opposite-order lock proof',
            // Alternate which drawer is the OUT side so lock acquisition would cross without sorting.
            lines:
              i % 2 === 0
                ? [
                    { drawerId: a, direction: 'OUT', amount: 1, currencyCode: 'OMR' },
                    { drawerId: b, direction: 'IN', amount: 1, currencyCode: 'OMR' },
                  ]
                : [
                    { drawerId: b, direction: 'OUT', amount: 1, currencyCode: 'OMR' },
                    { drawerId: a, direction: 'IN', amount: 1, currencyCode: 'OMR' },
                  ],
          }),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason));
      // Both drawers are valid sources and destinations, so every transaction must commit —
      // sorted locking makes the opposite lock orders safe.
      expect(failures).toEqual([]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(12);
    } finally {
      await cleanupTestDrawers(scope!, [a, b]);
    }
  });
});

describe('refusal rules — disposition validation and custody type rules (§4B.3.1, §4B.5)', () => {
  dbit('every invalid disposition is refused with its own code and leaves the session CLOSING with nothing written', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const safeId = await drawer('SAFE');
    const tillId = await drawer(); // a TEMPORARY drawer: cannot receive a disposition
    const deadSafeId = await drawer('SAFE');
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 30, mode: 'INTERACTIVE' });
      await startClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 30 },
      });
      await prisma.org_cash_drawers_mst.updateMany({
        where: { id: deadSafeId, tenant_org_id: scope!.tenantId },
        data: { is_active: false },
      });

      const attempt = (d: Record<string, unknown>) =>
        finalizeClose(scope!.tenantId, actor, {
          sessionId: s1.sessionId,
          drawerId,
          dispositions: [{ currencyCode: 'OMR', ...d } as never],
        });
      const MOVED = CASH_DRAWER_DISPOSITIONS.MOVED_TO_SAFE;
      const PART = CASH_DRAWER_DISPOSITIONS.PARTIAL_REMOVED;
      const cases: Array<[string, Record<string, unknown>, string]> = [
        ['destination missing', { dispositionCode: MOVED }, 'CASH_DISPOSITION_DEST_REQUIRED'],
        ['kept amount missing', { dispositionCode: PART, destDrawerId: safeId, dispositionNotes: 'n' }, 'CASH_DISPOSITION_AMOUNT_INVALID'],
        ['kept amount above the counted cash', { dispositionCode: PART, destDrawerId: safeId, keptAmount: 30.001, dispositionNotes: 'n' }, 'CASH_DISPOSITION_AMOUNT_INVALID'],
        ['kept amount negative', { dispositionCode: PART, destDrawerId: safeId, keptAmount: -1, dispositionNotes: 'n' }, 'CASH_DISPOSITION_AMOUNT_INVALID'],
        ['notes missing where required', { dispositionCode: PART, destDrawerId: safeId, keptAmount: 10 }, 'CASH_DISPOSITION_NOTES_REQUIRED'],
        ['destination type cannot receive', { dispositionCode: MOVED, destDrawerId: tillId }, 'CASH_DRAWER_TYPE_NOT_ALLOWED'],
        ['destination inactive', { dispositionCode: MOVED, destDrawerId: deadSafeId }, 'CASH_DRAWER_INACTIVE'],
      ];
      for (const [label, input, code] of cases) {
        await expect({ label, outcome: await attempt(input).catch((e: { code?: string }) => e.code) }).toEqual({
          label,
          outcome: code,
        });
      }

      const still = await session(s1.sessionId);
      expect(still.status).toBe('CLOSING');
      expect(
        await prisma.org_cash_drawer_trx_dtl.count({
          where: { tenant_org_id: scope!.tenantId, cash_drawer_id: { in: [drawerId, safeId] } },
        }),
      ).toBe(0);
      expect((await balance(s1.sessionId)).disposition_code).toBeNull();

      // …and a valid decision still goes through afterwards: the refusals did not wedge the close.
      const ok = await attempt({ dispositionCode: MOVED, destDrawerId: safeId });
      expect(ok).toMatchObject({ status: 'CLOSED' });
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, safeId, tillId, deadSafeId]);
    }
  });

  dbit('custody transactions are refused for the wrong drawer types, same drawer, unbalanced, wrong currency and non-positive amounts', async () => {
    const actor = randomUUID();
    const till = await drawer();
    const safeId = await drawer('SAFE');
    try {
      const post = (type: string, lines: Array<Record<string, unknown>>, notes?: string) =>
        postDrawerTrx(scope!.tenantId, actor, {
          trxTypeCode: type as never,
          branchId: scope!.branchId,
          notes,
          lines: lines as never,
        }).catch((e: { code?: string }) => e.code ?? String(e));
      const line = (drawerId: string, direction: 'IN' | 'OUT', amount: number, currencyCode = 'OMR') => ({
        drawerId,
        direction,
        amount,
        currencyCode,
      });
      const cases: Array<[string, string, Array<Record<string, unknown>>, string]> = [
        ['a safe cannot be the source of a drop', 'CASH_DROP', [line(safeId, 'OUT', 5), line(till, 'IN', 5)], 'CASH_DRAWER_TYPE_NOT_ALLOWED'],
        ['a safe cannot take part in a drawer-to-drawer transfer', 'DRAWER_TO_DRAWER', [line(till, 'OUT', 5), line(safeId, 'IN', 5)], 'CASH_DRAWER_TYPE_NOT_ALLOWED'],
        ['both sides on one drawer', 'CASH_DROP', [line(till, 'OUT', 5), line(till, 'IN', 5)], 'CASH_TRX_SAME_DRAWER'],
        ['legs that do not net to zero', 'CASH_DROP', [line(till, 'OUT', 5), line(safeId, 'IN', 4)], 'CASH_TRX_UNBALANCED'],
        ['a line in another currency than its drawer', 'CASH_DROP', [line(till, 'OUT', 5, 'USD'), line(safeId, 'IN', 5, 'USD')], 'CASH_CURRENCY_MISMATCH'],
        ['a zero amount', 'CASH_DROP', [line(till, 'OUT', 0), line(safeId, 'IN', 0)], 'CASH_DISPOSITION_AMOUNT_INVALID'],
      ];
      for (const [label, type, lines, code] of cases) {
        await expect({ label, outcome: await post(type, lines, 'CLF matrix refusal case') }).toEqual({ label, outcome: code });
      }
      // None of the refusals consumed a ledger sequence.
      expect(Number((await drawerRow(till)).ledger_seq)).toBe(0);
      expect(Number((await drawerRow(safeId)).ledger_seq)).toBe(0);
    } finally {
      await cleanupTestDrawers(scope!, [till, safeId]);
    }
  });

  dbit('custody transaction numbers are unique and follow the CDT-YYYYMMDD-NNNN format under concurrency', async () => {
    const actor = randomUUID();
    const till = await drawer();
    const safeId = await drawer('SAFE');
    try {
      await openSession(scope!.tenantId, actor, { drawerId: till });
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          postDrawerTrx(scope!.tenantId, actor, {
            trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
            branchId: scope!.branchId,
            lines: [
              { drawerId: till, direction: 'OUT', amount: 1, currencyCode: 'OMR' },
              { drawerId: safeId, direction: 'IN', amount: 1, currencyCode: 'OMR' },
            ],
          }),
        ),
      );
      const numbers = results.map((r) => r.trxNo);
      expect(new Set(numbers).size).toBe(6);
      for (const n of numbers) expect(n).toMatch(/^CDT-\d{8}-\d{4,}$/);
    } finally {
      await cleanupTestDrawers(scope!, [till, safeId]);
    }
  });
});

describe('policy-driven close behaviour and idempotent replays (§4B.7)', () => {
  dbit('a drawer-scoped policy makes the count mandatory and blinds the preview until the count is taken', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    // The settings audit trail keeps a real tenant user (FK to org_users_mst).
    const [realUser] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_users_mst WHERE tenant_org_id = ${scope!.tenantId}::uuid ORDER BY created_at LIMIT 1`;
    try {
      await updateCashControlSettings(
        { tenantId: scope!.tenantId, drawerId },
        { closingCountRequired: true, blindCloseEnabled: true },
        { userId: realUser.id, reason: 'CLF matrix policy proof' },
      );
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 12, mode: 'INTERACTIVE' });

      // Blind: the preview genuinely omits the system figure (not hidden client-side).
      const preview = await getClosePreview(scope!.tenantId, actor, { sessionId: s1.sessionId, drawerId });
      expect(preview.revealed).toBe(false);
      expect(JSON.stringify(preview)).not.toContain('12.0000');
      expect(preview.currencyBalances.every((r) => r.expected === undefined)).toBe(true);

      // A count is mandatory under this policy, and refusing it leaves the session OPEN.
      await expect(startClose(scope!.tenantId, actor, { sessionId: s1.sessionId, drawerId })).rejects.toMatchObject({
        code: 'CASH_COUNT_REQUIRED',
      });
      expect((await session(s1.sessionId)).status).toBe('OPEN');

      // After the count the result is revealed.
      const started = await startClose(scope!.tenantId, actor, {
        sessionId: s1.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 12 },
      });
      expect(started.currencyBalances[0]).toMatchObject({ closingExpected: '12.0000', closingVariance: '0.0000' });
    } finally {
      await prisma.org_fin_cash_ctrl_stng_cf.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
      await prisma.org_fin_cash_ctrl_audit_dtl.deleteMany({ where: { tenant_org_id: scope!.tenantId, scope_id: drawerId } });
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  });

  dbit('replaying a cash movement or a custody transaction with the same idempotency key creates nothing new', async () => {
    const actor = randomUUID();
    const till = await drawer();
    const safeId = await drawer('SAFE');
    try {
      const opened = await openSession(scope!.tenantId, actor, { drawerId: till });
      const movement = {
        drawerId: till,
        cashDrawerSessionId: opened.sessionId,
        lineRole: LINE_ROLE.CASH_PAY_IN,
        amount: 6,
        reason: 'CLF matrix replay',
        idempotencyKey: `clf-matrix-replay-${randomUUID()}`,
      };
      const first = await postDrawerCashMovement(scope!.tenantId, actor, movement);
      const replay = await postDrawerCashMovement(scope!.tenantId, actor, movement);
      expect(replay.voucherId).toBe(first.voucherId);
      expect(Number((await drawerRow(till)).ledger_seq)).toBe(1);

      const trx = {
        trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
        branchId: scope!.branchId,
        idempotencyKey: `clf-matrix-trx-${randomUUID()}`,
        lines: [
          { drawerId: till, direction: 'OUT' as const, amount: 2, currencyCode: 'OMR' },
          { drawerId: safeId, direction: 'IN' as const, amount: 2, currencyCode: 'OMR' },
        ],
      };
      const a = await postDrawerTrx(scope!.tenantId, actor, trx);
      const b = await postDrawerTrx(scope!.tenantId, actor, trx);
      expect(b).toEqual(a);
      expect(Number((await drawerRow(till)).ledger_seq)).toBe(2);
      expect(Number((await drawerRow(safeId)).ledger_seq)).toBe(1);
    } finally {
      await cleanupTestDrawers(scope!, [till, safeId]);
    }
  });
});

describe('immutability (§4B.6)', () => {
  dbit('custody lines, counts and a closed session balance row cannot be edited or deleted', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    const otherId = await drawer('SAFE');
    try {
      const s1 = await openSession(scope!.tenantId, actor, { drawerId });
      await stampTestCashLine(scope!, { drawerId, amount: 10, mode: 'INTERACTIVE' });
      const trx = await postDrawerTrx(scope!.tenantId, actor, {
        trxTypeCode: CASH_DRAWER_TRX_TYPES.CASH_DROP,
        branchId: scope!.branchId,
        lines: [
          { drawerId, direction: 'OUT', amount: 2, currencyCode: 'OMR' },
          { drawerId: otherId, direction: 'IN', amount: 2, currencyCode: 'OMR' },
        ],
      });
      await expect(
        prisma.org_cash_drawer_trx_dtl.updateMany({
          where: { trx_id: trx.trxId, tenant_org_id: scope!.tenantId },
          data: { amount: 99 },
        }),
      ).rejects.toThrow(/CASH_TRX_IMMUTABLE/);
      await expect(
        prisma.org_cash_drawer_trx_dtl.deleteMany({ where: { trx_id: trx.trxId, tenant_org_id: scope!.tenantId } }),
      ).rejects.toThrow(/CASH_TRX_IMMUTABLE/);

      await close(actor, drawerId, s1.sessionId, 8);
      const count = await prisma.org_cash_drawer_cnt_mst.findFirstOrThrow({
        where: { cash_drawer_id: drawerId, tenant_org_id: scope!.tenantId },
      });
      await expect(
        prisma.org_cash_drawer_cnt_mst.updateMany({
          where: { id: count.id, tenant_org_id: scope!.tenantId },
          data: { counted_amount: 1234 },
        }),
      ).rejects.toThrow(/CASH_LINE_IMMUTABLE/);
      await expect(
        prisma.org_cash_drawer_ses_bal_dtl.updateMany({
          where: { cash_drawer_session_id: s1.sessionId, tenant_org_id: scope!.tenantId },
          data: { closing_expected: 777 },
        }),
      ).rejects.toThrow(/CASH_LINE_IMMUTABLE/);
    } finally {
      await cleanupTestDrawers(scope!, [drawerId, otherId]);
    }
  });
});

describe('count-only drawers (§4B.8)', () => {
  dbit('a SAFE with no sessions chains expected cash from custody transactions and counts without a session', async () => {
    const actor = randomUUID();
    const till = await drawer();
    const safeId = await drawer('SAFE');
    try {
      await openSession(scope!.tenantId, actor, { drawerId: till });
      const move = (type: 'CASH_DROP' | 'FLOAT_ISSUE', amount: number, from: string, to: string) =>
        postDrawerTrx(scope!.tenantId, actor, {
          trxTypeCode: type,
          branchId: scope!.branchId,
          lines: [
            { drawerId: from, direction: 'OUT', amount, currencyCode: 'OMR' },
            { drawerId: to, direction: 'IN', amount, currencyCode: 'OMR' },
          ],
        });
      await move('CASH_DROP', 30, till, safeId);
      const first = await recordSpotCount(scope!.tenantId, actor, {
        drawerId: safeId,
        cashDrawerSessionId: null,
        countType: CASH_DRAWER_COUNT_TYPES.SPOT,
        currencyCode: 'OMR',
        countMode: CASH_CONTROL_COUNT_MODE.TOTAL_ONLY,
        totalAmount: 30,
      });
      expect(Number(first.countedAmount)).toBe(30);
      expect(Number(first.varianceAmount)).toBe(0);

      await move('FLOAT_ISSUE', 10, safeId, till);
      const second = await recordSpotCount(scope!.tenantId, actor, {
        drawerId: safeId,
        cashDrawerSessionId: null,
        countType: CASH_DRAWER_COUNT_TYPES.SPOT,
        currencyCode: 'OMR',
        countMode: CASH_CONTROL_COUNT_MODE.TOTAL_ONLY,
        totalAmount: 19,
      });
      // Counted 19 against an expected 20 (30 in, 10 out): the variance proves the chain.
      expect(Number(second.varianceAmount)).toBe(-1);
    } finally {
      await cleanupTestDrawers(scope!, [till, safeId]);
    }
  });
});

describe('ledger invariants (the M9 backfill verification queries, kept as a standing regression)', () => {
  dbit('no closed session lacks a cut or a balance row; no drawer line lacks drawer/sequence; counters cover every sequence', async () => {
    const t = scope!.tenantId;
    const noCut = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM public.org_cash_drawer_sessions_mst
       WHERE tenant_org_id = ${t}::uuid AND status IN ('CLOSED', 'FORCE_CLOSED') AND close_ledger_seq IS NULL`;
    expect(Number(noCut[0].n)).toBe(0);

    const noBalance = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM public.org_cash_drawer_sessions_mst s
       WHERE s.tenant_org_id = ${t}::uuid AND s.status IN ('CLOSED', 'FORCE_CLOSED')
         AND NOT EXISTS (SELECT 1 FROM public.org_cash_drawer_ses_bal_dtl b
                          WHERE b.tenant_org_id = s.tenant_org_id AND b.cash_drawer_session_id = s.id)`;
    expect(Number(noBalance[0].n)).toBe(0);

    const orphanLines = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM public.org_fin_voucher_trx_lines_dtl
       WHERE tenant_org_id = ${t}::uuid AND cash_effect_code = 'DRAWER'
         AND (cash_drawer_id IS NULL OR cash_ledger_seq IS NULL)`;
    expect(Number(orphanLines[0].n)).toBe(0);

    const counterBehind = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM public.org_cash_drawers_mst d
       WHERE d.tenant_org_id = ${t}::uuid
         AND d.ledger_seq < GREATEST(
           COALESCE((SELECT max(l.cash_ledger_seq) FROM public.org_fin_voucher_trx_lines_dtl l
                      WHERE l.tenant_org_id = d.tenant_org_id AND l.cash_drawer_id = d.id), 0),
           COALESCE((SELECT max(x.ledger_seq) FROM public.org_cash_drawer_trx_dtl x
                      WHERE x.tenant_org_id = d.tenant_org_id AND x.cash_drawer_id = d.id), 0))`;
    expect(Number(counterBehind[0].n)).toBe(0);
  });
});

describe('decimal exactness (A3-5)', () => {
  dbit('500 sequential 0.005 OMR cash lines close balanced: expected 2.5, variance exactly 0', async () => {
    const actor = randomUUID();
    const drawerId = await drawer();
    try {
      const s = await openSession(scope!.tenantId, actor, { drawerId });
      for (let i = 0; i < 500; i += 1) {
        await stampTestCashLine(scope!, { drawerId, amount: '0.005', mode: 'INTERACTIVE' });
      }
      const started = await close(actor, drawerId, s.sessionId, 2.5);
      expect(started.currencyBalances[0]).toMatchObject({
        closingExpected: '2.5000',
        closingCounted: '2.5000',
        closingVariance: '0.0000',
      });
      expect((await balance(s.sessionId)).closing_variance?.toString()).toBe('0');
    } finally {
      await cleanupTestDrawers(scope!, [drawerId]);
    }
  }, 120_000);
});
