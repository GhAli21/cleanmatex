import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import {
  LINE_ROLE,
  LINE_TYPE,
  PARTY_TYPE,
  TARGET_TYPE,
  VOUCHER_DIRECTION,
  VOUCHER_TYPE,
} from '@/lib/constants/voucher';
import { CASH_GATE_MODES } from '@/lib/constants/cash-drawer';

/**
 * Over/short financial recognition (CLF, ADR-057, plan §4B.9, P7).
 *
 * `postOverShortFromEventTx` is the consumer-side half of a
 * `CASH_DRAWER_OVER_SHORT` outbox event — emitted by
 * `cash-drawer-session.service.ts` at open (opening count variance), at
 * finalize (closing variance, unless pending B16 approval), or at approval
 * (once a pending variance is approved). One `ADJUSTMENT_VOUCHER` per
 * (session, phase, currency) with a single `CASH_OVER_SHORT` line —
 * `payment_method_code` is deliberately left `NULL` so the cash-drawer
 * ledger gate's own cash-family filter ignores it; an over/short is a P&L
 * fact about a count, never a second cash event in the drawer it's about.
 *
 * ERP-Lite GL dispatch (CASH_OVER / CASH_SHORT usage codes, migration 0530)
 * is a documented follow-up, not wired yet — `ErpLiteAutoPostService` has no
 * generic by-event-code dispatcher, only bespoke per-event methods, and this
 * is the first consumer of its CLF events. The voucher is the authoritative
 * financial record regardless; GL posting is supplementary bookkeeping for
 * ERP-Lite-enabled tenants and is NON_BLOCKING even once added.
 */

export interface OverShortVariance {
  currencyCode: string;
  /** Signed — positive = cash over, negative = cash short. */
  varianceAmount: number | string | Decimal;
}

export interface PostOverShortInput {
  sessionId: string;
  drawerId: string;
  branchId: string;
  phase: 'OPENING' | 'CLOSING';
  variances: OverShortVariance[];
}

export interface PostOverShortResult {
  voucherId: string;
  voucherNo: string;
  currencyCode: string;
}

/**
 * Posts one ADJUSTMENT_VOUCHER per non-zero variance in the payload. Each is
 * independently idempotent on `cash-over-short:{sessionId}:{currency}:{phase}`
 * — a redelivered outbox event (or re-running approval) never double-posts.
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user (the system actor for an automatic event consumer)
 * @param input the over/short payload — see {@link PostOverShortInput}
 */
export async function postOverShortFromEventTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  input: PostOverShortInput,
): Promise<PostOverShortResult[]> {
  const results: PostOverShortResult[] = [];

  for (const variance of input.variances) {
    const amount = new Decimal(variance.varianceAmount.toString());
    if (amount.equals(0)) continue;

    const idempotencyKey = `cash-over-short:${input.sessionId}:${variance.currencyCode}:${input.phase}`;
    const existing = await tx.org_fin_vouchers_mst.findFirst({
      where: { tenant_org_id: ctx.tenantOrgId, idempotency_key: idempotencyKey },
      select: { id: true, voucher_no: true },
    });
    if (existing) {
      results.push({ voucherId: existing.id, voucherNo: existing.voucher_no, currencyCode: variance.currencyCode });
      continue;
    }

    const isOver = amount.greaterThan(0);
    const direction = isOver ? VOUCHER_DIRECTION.IN : VOUCHER_DIRECTION.OUT;

    const voucher = await createBizVoucher(
      ctx.tenantOrgId,
      {
        voucher_type: VOUCHER_TYPE.ADJUSTMENT,
        direction,
        party_type: PARTY_TYPE.OTHER,
        branch_id: input.branchId,
        source_module: 'CASH_DRAWER',
        source_ref_type: 'CASH_DRAWER_OVER_SHORT',
        source_ref_id: input.sessionId,
        currency_code: variance.currencyCode,
        total_amount: amount.abs().toNumber(),
        idempotency_key: idempotencyKey,
        description: `${isOver ? 'Cash over' : 'Cash short'} — ${input.phase.toLowerCase()} count`,
      },
      ctx.userId,
      tx,
    );

    await addVoucherLine(
      ctx.tenantOrgId,
      voucher.id,
      {
        line_type: LINE_TYPE.ADJUSTMENT,
        line_role: LINE_ROLE.CASH_OVER_SHORT,
        direction,
        target_type: TARGET_TYPE.CASH_DRAWER,
        target_id: input.drawerId,
        branch_id: input.branchId,
        // Deliberately no payment_method_code — not a cash-family line, the
        // ledger gate's isCashLine() filter never sees it.
        amount: amount.abs().toNumber(),
        currency_code: variance.currencyCode,
        description: `${isOver ? 'Cash over' : 'Cash short'} — ${input.phase.toLowerCase()} count`,
        idempotency_key: `${idempotencyKey}_line`,
      },
      ctx.userId,
      undefined,
      tx,
    );

    await postAndWireBizVoucher(
      ctx.tenantOrgId,
      voucher.id,
      ctx.userId,
      CASH_GATE_MODES.DEFERRED,
      `${idempotencyKey}_vch_post`,
      tx,
    );

    results.push({ voucherId: voucher.id, voucherNo: voucher.voucher_no, currencyCode: variance.currencyCode });
  }

  return results;
}
