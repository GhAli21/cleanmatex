import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
import type { CashControlChangeBearer } from '@/lib/constants/cash-control';
import type { CurrencyRoundingMode } from '@/lib/constants/order-financial';
import { ROUNDING_CONTEXT } from '@/lib/constants/rounding-context';
import {
  LINE_ROLE,
  LINE_TYPE,
  PARTY_TYPE,
  TARGET_TYPE,
  VOUCHER_DIRECTION,
  VOUCHER_TYPE,
} from '@/lib/constants/voucher';
import { CHANGE_BEARER_ROUNDING_MODE, computeCashChangeRounding } from '@/lib/money/cash-rounding';
import type { CashChangeRounding } from '@/lib/money/cash-rounding';
import { resolveCurrencyRoundingRule } from '@/lib/money/currency-rounding';
import {
  getCashControlSettings,
  type CashControlScope,
} from '@/lib/services/cash-control-settings.service';
import { ErpLiteAutoPostService } from '@/lib/services/erp-lite-auto-post.service';
import { safeDispatchAutoPost } from '@/lib/services/erp-lite-auto-post.util';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';

/**
 * Cash change rounding (A6-1b, owner decision 2026-10-02).
 *
 * Only the CHANGE handed back for a cash tender is rounded. The order is settled at
 * its exact amount (totals, tax, non-cash tenders untouched); the physical change is
 * rounded to the cash increment and the gap is recorded as an explicit
 * `CASH_CHANGE_ROUNDING` line on its own ADJUSTMENT voucher, stamped into the same
 * drawer session as the payment — so the drawer's expected cash equals its counted cash.
 *
 * The standalone voucher mirrors the CASH_OVER_SHORT precedent: the receipt voucher's
 * total/line-sum stays exact, and a later reversal of the receipt does not undo the
 * rounding (the change really was handed out rounded).
 *
 * ERP-Lite GL dispatch (CASH_ROUND_LOSS / CASH_ROUND_GAIN, migration 0546) follows the
 * voucher: the voucher is the authoritative record; GL posting is supplementary and NON_BLOCKING.
 */

/** Resolved change-rounding policy for one (scope, currency). */
export interface CashChangeRoundingPolicy {
  currencyCode: string;
  /** Currency minor-unit digits (`sys_currency_cd.minor_unit`). */
  decimalPlaces: number;
  /** Cash increment in minor units; `null` = no rounding applies. */
  incrementMinor: number | null;
  mode: CurrencyRoundingMode;
  bearer: CashControlChangeBearer;
}

/**
 * Resolve who bears the un-tenderable change fraction and the cash increment.
 * Increment ladder: tenant `cash_change_round_to_minor` → HQ `CASH_CHANGE` rule (→
 * `ACCOUNTING` fallback) → none. A currency with neither resolves to no rounding.
 * @param scope tenant + branch/user/drawer scope for the cash-control settings
 * @param currencyCode ISO currency code of the cash tender
 */
export async function resolveCashChangeRoundingPolicy(
  scope: CashControlScope,
  currencyCode: string,
): Promise<CashChangeRoundingPolicy> {
  const settings = await getCashControlSettings(scope);
  const currency = await prisma.sys_currency_cd.findUnique({
    where: { code: currencyCode },
    select: { minor_unit: true },
  });
  const decimalPlaces = currency?.minor_unit ?? 2;

  let incrementMinor: number | null = settings.cashChangeRoundToMinor ?? null;
  if (incrementMinor == null) {
    const hq = await resolveCurrencyRoundingRule(currencyCode, ROUNDING_CONTEXT.CASH_CHANGE);
    incrementMinor = hq ? Math.round(hq.roundingUnit * 10 ** decimalPlaces) : null;
  }

  return {
    currencyCode,
    decimalPlaces,
    incrementMinor,
    mode: CHANGE_BEARER_ROUNDING_MODE[settings.cashChangeBearer],
    bearer: settings.cashChangeBearer,
  };
}

/** Rounding result for one cash leg, ready to persist. */
export interface PlannedCashChangeRounding extends CashChangeRounding {
  currencyCode: string;
}

/**
 * Plan the change rounding for one cash leg. Returns `null` when nothing applies
 * (non-cash method, no change owed, no increment configured, or the change already
 * sits on the increment) — callers then keep the exact, un-rounded behaviour.
 * @param scope tenant + branch/user/drawer scope
 * @param leg the cash leg: method, currency, amount retained and cash tendered
 * @param leg.changeReturned explicit change when an overpayment resolution fixed it
 */
export async function planCashChangeRounding(
  scope: CashControlScope,
  leg: {
    paymentMethodCode: string | null | undefined;
    currencyCode: string;
    amount: number;
    tenderedAmount?: number | null;
    changeReturned?: number | null;
  },
): Promise<PlannedCashChangeRounding | null> {
  if (!isCashFamilyMethod(leg.paymentMethodCode)) return null;
  if (leg.tenderedAmount == null) return null;

  const exactChange = leg.changeReturned ?? Math.max(0, leg.tenderedAmount - leg.amount);
  if (exactChange <= 0) return null;

  const policy = await resolveCashChangeRoundingPolicy(scope, leg.currencyCode);
  if (policy.incrementMinor == null) return null;

  const rounding = computeCashChangeRounding({
    exactChange,
    maxChange: leg.tenderedAmount,
    decimalPlaces: policy.decimalPlaces,
    incrementMinor: policy.incrementMinor,
    mode: policy.mode,
  });
  if (rounding.adjustment === 0) return null;
  return { ...rounding, currencyCode: leg.currencyCode };
}

/** Inputs to persist one planned rounding. */
export interface PostCashChangeRoundingInput {
  rounding: PlannedCashChangeRounding;
  /**
   * What the cash was taken for. An order anchors the rounding to that order; a payment
   * with no order (wallet top-up, customer account receipt) falls back to the customer,
   * then to the drawer — so every rounding line has a valid target.
   */
  orderId?: string | null;
  customerId?: string | null;
  /** Source document of the cash payment (defaults to the order). */
  source?: { module: string; refType: string; refId: string };
  branchId?: string | null;
  /**
   * The posted cash payment line. The rounding goes into the drawer session the gate
   * stamped on it; a payment that never reached a drawer has nothing to round.
   */
  paymentLineId: string;
  posSessionId?: string | null;
  orgPaymentMethodId?: string | null;
  paymentMethodCode: string;
  /** Stable per-leg key (e.g. `${orderId}_cash_round_${legIndex}`) — retries never double-post. */
  idempotencyKey: string;
}

/**
 * Persist and post the rounding as its own ADJUSTMENT voucher inside the caller's
 * transaction. Direction follows the sign: OUT = drawer holds less (loss), IN = more (gain).
 * @param tx open Prisma transaction (the order/receipt transaction)
 * @param ctx tenant and acting user
 * @param input the planned rounding and its anchors
 */
export async function postCashChangeRoundingTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  input: PostCashChangeRoundingInput,
): Promise<{ voucherId: string } | null> {
  const { rounding } = input;

  const paymentLine = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
    where: { id: input.paymentLineId, tenant_org_id: ctx.tenantOrgId },
    select: { cash_drawer_session_id: true, cash_drawer_id: true },
  });
  const cashDrawerSessionId = paymentLine?.cash_drawer_session_id ?? null;
  if (!cashDrawerSessionId) return null;

  const orderId = input.orderId ?? null;
  const customerId = input.customerId ?? null;
  const target = orderId
    ? { type: TARGET_TYPE.ORDER, id: orderId }
    : customerId
      ? { type: TARGET_TYPE.CUSTOMER, id: customerId }
      : { type: TARGET_TYPE.CASH_DRAWER, id: paymentLine?.cash_drawer_id ?? '' };
  if (!target.id) return null;
  const source = input.source ?? (orderId ? { module: 'ORDERS', refType: 'ORDER', refId: orderId } : null);
  if (!source) return null;

  const isGain = rounding.adjustment > 0;
  const direction = isGain ? VOUCHER_DIRECTION.IN : VOUCHER_DIRECTION.OUT;
  const amount = Math.abs(rounding.adjustment);
  const description = isGain ? 'Cash change rounding gain' : 'Cash change rounding loss';

  const voucher = await createBizVoucher(
    ctx.tenantOrgId,
    {
      voucher_type: VOUCHER_TYPE.ADJUSTMENT,
      direction,
      party_type: customerId ? PARTY_TYPE.CUSTOMER : PARTY_TYPE.OTHER,
      customer_id: customerId ?? undefined,
      order_id: orderId ?? undefined,
      branch_id: input.branchId ?? undefined,
      source_module: source.module,
      source_ref_type: source.refType,
      source_ref_id: source.refId,
      currency_code: rounding.currencyCode,
      total_amount: amount,
      idempotency_key: `${input.idempotencyKey}_vch`,
      description,
    },
    ctx.userId,
    tx,
  );

  await addVoucherLine(
    ctx.tenantOrgId,
    voucher.id,
    {
      line_type: LINE_TYPE.ROUNDING,
      line_role: LINE_ROLE.CASH_CHANGE_ROUNDING,
      direction,
      target_type: target.type,
      target_id: target.id,
      order_id: orderId ?? undefined,
      customer_id: customerId ?? undefined,
      branch_id: input.branchId ?? undefined,
      // Cash-family on purpose: the drawer ledger gate stamps it into the payment's session.
      payment_method_code: input.paymentMethodCode,
      payment_status: 'COMPLETED',
      org_payment_method_id: input.orgPaymentMethodId ?? undefined,
      cash_drawer_session_id: cashDrawerSessionId,
      pos_session_id: input.posSessionId ?? undefined,
      amount,
      currency_code: rounding.currencyCode,
      description: `${description} — exact change ${rounding.exactChange}, handed out ${rounding.roundedChange}`,
      idempotency_key: `${input.idempotencyKey}_line`,
    },
    ctx.userId,
    undefined,
    tx,
  );

  await postAndWireBizVoucher(
    ctx.tenantOrgId,
    voucher.id,
    ctx.userId,
    CASH_GATE_MODES.INTERACTIVE,
    `${input.idempotencyKey}_vch_post`,
    tx,
  );

  // GL recognition: supplementary and NON_BLOCKING — the voucher above is the authoritative record.
  await safeDispatchAutoPost('cash_change_rounding', () =>
    ErpLiteAutoPostService.dispatchCashEventInTransaction(tx, {
      tenant_org_id: ctx.tenantOrgId,
      event_code: isGain ? 'CASH_ROUND_GAIN' : 'CASH_ROUND_LOSS',
      voucher_id: voucher.id,
      amount,
      currency_code: rounding.currencyCode,
      event_date: new Date().toISOString(),
      branch_id: input.branchId ?? null,
      created_by: ctx.userId,
    }),
  );

  return { voucherId: voucher.id };
}
