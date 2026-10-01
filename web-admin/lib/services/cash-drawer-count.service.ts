import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { lockDrawersTx } from '@/lib/services/cash-drawer-ledger/cash-drawer-lock';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import {
  CASH_DRAWER_COUNT_TYPES,
  CASH_LEDGER_ERRORS,
  type CashDrawerCountType,
} from '@/lib/constants/cash-drawer';
import { CASH_CONTROL_COUNT_MODE, type CashControlCountMode } from '@/lib/constants/cash-control';

/**
 * Cash count recording (CLF, ADR-057, plan §4B.4 CLF-4-1).
 *
 * `recordCountTx` is the single writer of `org_cash_drawer_cnt_mst` /
 * `_denom_dtl`. It does not decide WHAT "expected" means for a given count
 * (that is the caller's job — `cash-drawer-session.service.ts` for
 * OPENING/CLOSING/RECOUNT via the balance service, or a standalone SPOT
 * entry point for a count-only drawer); it only records the physical count
 * against an expected figure the caller already resolved, snapshots the
 * drawer's current ledger sequence as the cut, and computes the counted
 * total server-side from denomination lines when the method requires them
 * — never trusting a client-supplied total that bypasses the per-coin math.
 */

export interface DenominationCountLine {
  denominationId: string;
  quantity: number;
}

export interface RecordCountInput {
  drawerId: string;
  branchId: string;
  /** Null for a count-only drawer (SAFE/PENDING_DEPOSIT/DRIVER_BAG) with no open session. */
  cashDrawerSessionId: string | null;
  countType: CashDrawerCountType;
  currencyCode: string;
  /** System-computed expected cash at this cut — resolved by the caller via the balance service. */
  expectedAmount: Decimal;
  /** TOTAL_ONLY: use `totalAmount`. OPTIONAL_DENOMINATION/DENOMINATION with denominations given: use the per-coin breakdown. */
  countMode: CashControlCountMode;
  totalAmount?: number | string | Decimal;
  denominations?: DenominationCountLine[];
  /** RECOUNT only: the CLOSING (or prior RECOUNT) count this one supersedes. */
  supersedesCountId?: string;
  notes?: string;
}

export interface RecordCountResult {
  countId: string;
  countMethod: 'TOTAL_ONLY' | 'DENOMINATION';
  countedAmount: Decimal;
  varianceAmount: Decimal;
  ledgerSeq: bigint;
}

function resolveCountMethod(input: RecordCountInput): 'TOTAL_ONLY' | 'DENOMINATION' {
  if (input.countMode === CASH_CONTROL_COUNT_MODE.DENOMINATION) return 'DENOMINATION';
  if (input.countMode === CASH_CONTROL_COUNT_MODE.TOTAL_ONLY) return 'TOTAL_ONLY';
  // OPTIONAL_DENOMINATION: the UI offers a breakdown but doesn't force it —
  // the actual method taken is whichever the caller actually supplied.
  return input.denominations && input.denominations.length > 0 ? 'DENOMINATION' : 'TOTAL_ONLY';
}

/**
 * Records one physical cash count. Locks the drawer (reentrant-safe if the
 * caller already holds the lock in the same transaction) to snapshot the
 * exact ledger sequence this count was taken against.
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user
 * @param input count payload — see {@link RecordCountInput}
 * @throws CashDrawerLedgerError (`CASH_COUNT_TOTAL_MISMATCH`) when a client-supplied `totalAmount` disagrees with the computed denomination sum
 * @throws Error on malformed input (empty denomination list for a DENOMINATION count, unknown denomination id, mixed currency)
 */
export async function recordCountTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  input: RecordCountInput,
): Promise<RecordCountResult> {
  const [locked] = await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);
  if (!locked) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE,
      `recordCountTx: drawer ${input.drawerId} not found for tenant ${ctx.tenantOrgId}`,
    );
  }
  const ledgerSeq = locked.ledger_seq;

  const method = resolveCountMethod(input);
  let countedAmount: Decimal;

  if (method === 'DENOMINATION') {
    if (!input.denominations || input.denominations.length === 0) {
      throw new Error('recordCountTx: DENOMINATION count requires at least one denomination line');
    }
    const denomIds = [...new Set(input.denominations.map((d) => d.denominationId))];
    const denomRows = await tx.sys_currency_denominations_cd.findMany({
      where: { id: { in: denomIds } },
      select: { id: true, currency_code: true, denomination_minor: true },
    });
    const byId = new Map(denomRows.map((d) => [d.id, d]));

    const currency = await tx.sys_currency_cd.findUnique({
      where: { code: input.currencyCode },
      select: { minor_unit: true },
    });
    const minorUnit = currency?.minor_unit ?? 2;
    const scale = new Decimal(10).pow(minorUnit);

    const lines: Array<{ denominationId: string; denomValueMinorSnap: number; quantity: number; lineAmount: Decimal }> = [];
    countedAmount = new Decimal(0);
    for (const d of input.denominations) {
      if (!Number.isInteger(d.quantity) || d.quantity < 0) {
        throw new Error(`recordCountTx: invalid quantity for denomination ${d.denominationId}`);
      }
      const denom = byId.get(d.denominationId);
      if (!denom) {
        throw new Error(`recordCountTx: denomination ${d.denominationId} not found`);
      }
      if (denom.currency_code !== input.currencyCode) {
        throw new Error(
          `recordCountTx: denomination ${d.denominationId} belongs to ${denom.currency_code}, not ${input.currencyCode}`,
        );
      }
      const lineAmount = new Decimal(denom.denomination_minor).times(d.quantity).dividedBy(scale);
      lines.push({ denominationId: d.denominationId, denomValueMinorSnap: denom.denomination_minor, quantity: d.quantity, lineAmount });
      countedAmount = countedAmount.plus(lineAmount);
    }

    // Defense in depth: if the caller also passed a client totalAmount, it
    // must agree with the server-computed sum — never silently prefer one.
    if (input.totalAmount != null) {
      const clientTotal = new Decimal(input.totalAmount.toString());
      if (!clientTotal.equals(countedAmount)) {
        throw new CashDrawerLedgerError(
          CASH_LEDGER_ERRORS.CASH_COUNT_TOTAL_MISMATCH,
          `recordCountTx: client total ${clientTotal.toString()} disagrees with the denomination sum ${countedAmount.toString()}`,
        );
      }
    }

    const count = await tx.org_cash_drawer_cnt_mst.create({
      data: {
        tenant_org_id: ctx.tenantOrgId,
        branch_id: input.branchId,
        cash_drawer_id: input.drawerId,
        cash_drawer_session_id: input.cashDrawerSessionId,
        count_type: input.countType,
        count_method: 'DENOMINATION',
        currency_code: input.currencyCode,
        ledger_seq: ledgerSeq,
        expected_amount: input.expectedAmount,
        counted_amount: countedAmount,
        variance_amount: countedAmount.minus(input.expectedAmount),
        supersedes_count_id: input.supersedesCountId ?? null,
        counted_by: ctx.userId,
        notes: input.notes ?? null,
        created_by: ctx.userId,
      },
      select: { id: true },
    });

    await tx.org_cash_drawer_cnt_denom_dtl.createMany({
      data: lines.map((l) => ({
        tenant_org_id: ctx.tenantOrgId,
        count_id: count.id,
        denomination_id: l.denominationId,
        denom_value_minor_snap: l.denomValueMinorSnap,
        quantity: l.quantity,
        line_amount: l.lineAmount,
        created_by: ctx.userId,
      })),
    });

    return {
      countId: count.id,
      countMethod: 'DENOMINATION',
      countedAmount,
      varianceAmount: countedAmount.minus(input.expectedAmount),
      ledgerSeq,
    };
  }

  // TOTAL_ONLY
  if (input.totalAmount == null) {
    throw new Error('recordCountTx: TOTAL_ONLY count requires totalAmount');
  }
  countedAmount = new Decimal(input.totalAmount.toString());
  if (countedAmount.isNegative()) {
    throw new Error('recordCountTx: counted amount must be >= 0');
  }

  const count = await tx.org_cash_drawer_cnt_mst.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      branch_id: input.branchId,
      cash_drawer_id: input.drawerId,
      cash_drawer_session_id: input.cashDrawerSessionId,
      count_type: input.countType,
      count_method: 'TOTAL_ONLY',
      currency_code: input.currencyCode,
      ledger_seq: ledgerSeq,
      expected_amount: input.expectedAmount,
      counted_amount: countedAmount,
      variance_amount: countedAmount.minus(input.expectedAmount),
      supersedes_count_id: input.supersedesCountId ?? null,
      counted_by: ctx.userId,
      notes: input.notes ?? null,
      created_by: ctx.userId,
    },
    select: { id: true },
  });

  return {
    countId: count.id,
    countMethod: 'TOTAL_ONLY',
    countedAmount,
    varianceAmount: countedAmount.minus(input.expectedAmount),
    ledgerSeq,
  };
}

/** Re-exported for callers that only need the type, not the recording logic. */
export { CASH_DRAWER_COUNT_TYPES };
