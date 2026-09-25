import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  OUTBOX_EVENT_TYPES,
  PAYMENT_NATURE,
} from '@/lib/constants/order-financial';
import type {
  ChargeLineItem,
  DiscountLineInput,
  FinancialBreakdownSnapshot,
  ResolvedSettlementLeg,
  TaxLineItem,
} from '@/lib/types/order-financial';
import { createClient } from '@/lib/supabase/server';
import { emitEventTx } from './outbox.service';
import { queueEarnPoints } from './loyalty.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { createTenantSettingsService } from './tenant-settings.service';
import { addMoney, subMoney, sumMoney } from '@/lib/utils/money';
import {
  computeCollectionOverpaymentMetrics,
  type CollectionLegInput,
} from '@/lib/payments/collection-overpayment';
import { validateOverpaymentResolution } from '@/lib/services/overpayment-resolution-validator.service';
import { executeOverpaymentDispositionTx } from '@/lib/services/overpayment-disposition.service';
import {
  executeAllocationPreviewTx,
  extractAllocationPreviewId,
  getDispositionLinesExcludingAllocation,
  resolutionIncludesAllocation,
} from '@/lib/services/customer-receipt-excess-executor.service';
import type {
  OverpaymentResolutionInput,
  PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';
import {
  OVERPAYMENT_RESOLUTIONS,
  SETTLEMENT_MONEY_EPSILON,
} from '@/lib/constants/settlement-catalog';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { requireCurrencyCode } from '@/lib/money/currency-resolution';
import {
  assertOpenPosSessionForFinanceTx,
  autoLinkDrawerTx,
} from '@/lib/services/pos-session.service';
import { listEffectivePaymentMethodConfigs } from '@/lib/services/payment-config.service';
import { resolveDefaultStatus } from '@/lib/services/order-settlement-planner.service';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher } from '@/lib/services/voucher-wiring.service';
import { CASH_GATE_MODES } from '@/lib/constants/cash-drawer';
import { VOUCHER_TYPE, LINE_TYPE, LINE_ROLE } from '@/lib/constants/voucher';
import { hashPayload } from '@/lib/utils/idempotency';

/** Prisma transaction client shared with submit-order's atomic settlement flow. */
export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function getPartialLaterCollectionPolicy(tenantId: string): Promise<{
  allowPartialLaterCollection: boolean;
  requireFullCollectionOnPickup: boolean;
}> {
  const supabase = await createClient();
  const tenantSettings = createTenantSettingsService(supabase);
  const [allowPartialSetting, requireFullSetting] = await Promise.all([
    tenantSettings.getSettingValue(tenantId, 'orders.payments.allow_partial_later_collection'),
    tenantSettings.getSettingValue(tenantId, 'orders.payments.require_full_collection_on_pickup'),
  ]);

  return {
    allowPartialLaterCollection: allowPartialSetting == null ? true : String(allowPartialSetting).toLowerCase() !== 'false',
    requireFullCollectionOnPickup: String(requireFullSetting ?? '').toLowerCase() === 'true',
  };
}

/**
 * Settlement input for the atomic Order Fin write path.
 */
export interface SettlementParams {
  orderId: string;
  tenantId: string;
  breakdown: FinancialBreakdownSnapshot;
  chargeLines: ChargeLineItem[];
  taxLines: TaxLineItem[];
  discountLines: DiscountLineInput[];
  settlementLegs: ResolvedSettlementLeg[];
  /**
   * @deprecated Ignored since CLF W14 — cash legs reach the drawer only through
   * the voucher line and the cash-drawer ledger gate. Kept so callers compile.
   */
  cashDrawerSessionId?: string;
  posSessionId?: string;
  settledBy?: string;
}

/**
 * Final settlement result returned to routes and actions.
 */
export interface SettlementResult {
  orderId: string;
  paymentStatus: string;
  totalPaid: number;
  outstanding: number;
  changeReturned: number;
}

/**
 * Settle an order using the caller's transaction.
 *
 * This is used by submit-order so the order header, voucher wiring, stored-value
 * debits, payment fact rows, and financial snapshot commit or roll back together.
 *
 * CLF W14: payment facts (`org_order_payments_dtl`), credit applications and
 * stored-value redemptions are written ONLY by BVM voucher wiring (and cash
 * only through the drawer ledger gate). The former non-wiring branch — direct
 * payment rows / redemptions when `wiringMode` was false — was unreachable
 * from submit-order and is deleted, together with the `settleOrder` wrapper.
 * Settlement legs are read here only to validate them and total the change.
 *
 * @param tx active Prisma transaction owned by the caller
 * @param params settlement payload resolved by checkout
 * @returns normalized snapshot result after persistence
 *
 * @example
 * await prisma.$transaction((tx) =>
 *   settleOrderTx(tx, { orderId, tenantId, breakdown, chargeLines: [], taxLines, discountLines, settlementLegs })
 * );
 */
export async function settleOrderTx(
  tx: PrismaTransactionClient,
  params: SettlementParams,
): Promise<SettlementResult> {
  const {
    orderId,
    tenantId,
    breakdown,
    chargeLines,
    taxLines,
    discountLines,
    settlementLegs,
    posSessionId,
    settledBy,
  } = params;
  const currencyCode = breakdown.currencyCode;

    if (posSessionId && !settledBy) {
      throw new Error('POS_SESSION_USER_REQUIRED');
    }

    await assertOpenPosSessionForFinanceTx(tx, {
      tenantId,
      userId: settledBy ?? '',
      posSessionId,
    });

    // ── 1. Charges ────────────────────────────────────────────────────────────
    for (const charge of chargeLines) {
      await tx.org_order_charges_dtl.create({
        data: {
          tenant_org_id: tenantId,
          order_id: orderId,
          charge_type: charge.chargeType,
          label: charge.label,
          label2: charge.label2 ?? null,
          amount: charge.amount,
          currency_code: currencyCode,
          charge_source_id: charge.sourceId ?? null,
          rec_status: 1,
        },
      });
    }

    // ── 2. Taxes ──────────────────────────────────────────────────────────────
    for (let taxSeq = 0; taxSeq < taxLines.length; taxSeq++) {
      const tax = taxLines[taxSeq];
      await tx.org_order_taxes_dtl.create({
        data: {
          tenant_org_id:  tenantId,
          order_id:       orderId,
          tax_profile_id: tax.profileId ?? null,
          tax_type:       tax.taxType,
          label:          tax.label,
          label2:         tax.label2 ?? null,
          rate:           tax.rate,
          is_compound:    tax.isCompound,
          taxable_amount: tax.baseAmount,
          tax_amount:     tax.taxAmount,
          currency_code:  currencyCode,
          applied_seq:    taxSeq + 1,
          rec_status:     1,
        },
      });
    }

    // ── 3. Commercial discounts only ─────────────────────────────────────────
    let discSeq = 1;
    for (const disc of discountLines) {
      await tx.org_order_discounts_dtl.create({
        data: {
          tenant_org_id: tenantId,
          order_id: orderId,
          applied_seq: discSeq++,
          source_type: disc.sourceType,
          source_id: disc.sourceId ?? null,
          source_name: disc.sourceName,
          source_name2: disc.sourceName2 ?? null,
          discount_type: disc.discountType,
          discount_rate: disc.discountRate ?? null,
          discount_amount: disc.discountAmount,
          promotion_id: disc.promotionId ?? null,
          stacking_group: disc.stackingGroup ?? null,
          rec_status: 1,
        },
      });
    }

    // ── 4. Settlement legs ───────────────────────────────────────────────────
    let changeReturned = 0;

    for (const leg of settlementLegs) {
      const { settlementOption: option, amount, cashTendered } = leg;

      if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
        // Use subMoney to avoid float drift on 3-decimal currencies (OMR/BHD/KWD).
        const change = cashTendered && cashTendered > amount ? subMoney(cashTendered, amount).toNumber() : 0;
        changeReturned += change;
        // The payment fact row is written by the voucher wiring handler.
        continue;
      }

      if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
        // Throw rather than fall back: matches the planner's contract — every
        // CREDIT_APPLICATION leg must have a known credit_application_type.
        if (!option.creditApplicationType) {
          throw new Error('CREDIT_APPLICATION_TYPE_REQUIRED');
        }
        // The redemption and the credit-application fact row are written by
        // the voucher wiring (order-credit-application handler).
      }
    }

    // ── 5. Header recalc from fact rows ──────────────────────────────────────
    const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

    // ── 6. Outbox and loyalty follow-up ──────────────────────────────────────
    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.ORDER_COMPLETED, 'order', orderId, {
      paymentStatus: snapshot.paymentStatus,
      grandTotal: breakdown.grandTotal,
      settled: snapshot.outstandingAmount <= 0,
    });

    const order = await tx.org_orders_mst.findFirst({
      where: { id: orderId, tenant_org_id: tenantId },
      select: { customer_id: true },
    });
    if (order?.customer_id && snapshot.outstandingAmount <= 0) {
      await queueEarnPoints(tx, {
        tenantId,
        customerId: order.customer_id,
        orderId,
        orderAmount: breakdown.grandTotal,
      });
    }

    return {
      orderId,
      paymentStatus: snapshot.paymentStatus,
      // addMoney avoids float drift across multi-leg accumulation.
      totalPaid: addMoney(snapshot.totalPaidAmount, snapshot.totalCreditAppliedAmount).toNumber(),
      outstanding: snapshot.outstandingAmount,
      changeReturned,
    };
}

/**
 * Later collection request on an existing `PAY_ON_COLLECTION` order.
 */
/**
 * Later-collection leg shape. `checkNumber` / `checkBank` / `checkDate` carry
 * proof-of-receipt metadata for CHECK payments so PAY_ON_COLLECTION orders do
 * not lose this when collection is recorded after order creation.
 */
export interface CollectPaymentParams {
  orderId: string;
  tenantId: string;
  paymentLegs: Array<{
    paymentMethodId: string;
    amount: number;
    reference?: string;
    cashTendered?: number;
    checkNumber?: string;
    checkBank?: string;
    checkDate?: string;
    /**
     * D001/B31: explicit per-leg override. Only 'PENDING' is honored — an
     * explicit request can never force COMPLETED over a PENDING D9 config,
     * mirroring the submit planner's `paymentStatus` contract exactly.
     */
    paymentStatus?: 'PENDING';
  }>;
  cashDrawerSessionId?: string;
  posSessionId?: string;
  posSessionUserId?: string;
  collectedBy: string;
  customerId?: string | null;
  overpaymentResolution?: OverpaymentResolutionInput;
  /**
   * Free-text note for the collection event, persisted to
   * `org_order_payments_dtl.rec_notes`. The column already existed; nothing on
   * this path had ever written it, so context like "paid by spouse" or
   * "partial — rest on delivery" had nowhere to go.
   */
  notes?: string;
  /**
   * D010/B5: required on every money path. The route rejects a missing key
   * with 400 before this service is ever called; kept required here too so
   * no future caller can bypass the contract.
   */
  idempotencyKey: string;
}

const COLLECT_PAYMENT_IDEMPOTENCY_RESOURCE = 'collect_payment';

/**
 * Collect actual money against an existing deferred order.
 *
 * Why:
 * Batch 0 needs real partial later collection support instead of forcing one
 * full settlement event that zeroes the header immediately.
 *
 * BVM parity (B4): real-payment legs are wired through createBizVoucher +
 * addVoucherLine + postAndWireBizVoucher — the same voucher/wiring path
 * submit-order uses — instead of writing org_order_payments_dtl and
 * org_cash_drawer_movements_dtl directly. This is what gives every
 * collection a fin_voucher_id/fin_voucher_trx_line_id backlink and satisfies
 * the ORDER_PAYMENT_LINK_EXISTS reconciliation check (B20).
 *
 * Idempotency (B5): the whole collection event is keyed once at the top
 * (org_idempotency_keys, resource_type='collect_payment') — a replay with the
 * identical payload returns the original result with zero new financial
 * effects; a replay with a changed payload throws IDEMPOTENCY_CONFLICT (the
 * route maps this to HTTP 409). Per-leg voucher/line creation additionally
 * carries its own deterministic sub-key (`${idempotencyKey}_leg_${legIndex}`)
 * per the D010 grammar, so a partial-failure retry cannot double-write a
 * single leg either.
 *
 * @param params later collection payload
 * @returns normalized snapshot result after collection
 */
export async function collectPaymentTx(params: CollectPaymentParams): Promise<SettlementResult> {
  const {
    orderId,
    tenantId,
    paymentLegs,
    cashDrawerSessionId,
    posSessionId,
    posSessionUserId,
    collectedBy,
    customerId: requestedCustomerId,
    overpaymentResolution,
    notes,
    idempotencyKey,
  } = params;
  const policy = await getPartialLaterCollectionPolicy(tenantId);

  // CLF W3: explicit tenant context, same as every other money writer.
  return withTenantContext(tenantId, () => prisma.$transaction(async (tx) => {
    // ── 0. Idempotency conflict check + replay short-circuit (B5/D010) ──────
    // Runs before the order lock so a pure replay never re-validates against
    // an outstanding balance the original call has already reduced.
    const requestHash = hashPayload({
      orderId,
      paymentLegs,
      cashDrawerSessionId,
      posSessionId,
      customerId: requestedCustomerId,
      overpaymentResolution,
      // Part of the request, so a replay under the same key with a different
      // note is a genuine conflict rather than a silent return of the original.
      notes,
    });
    const existingIdempotency = await tx.org_idempotency_keys.findFirst({
      where: {
        tenant_org_id: tenantId,
        key: idempotencyKey,
        resource_type: COLLECT_PAYMENT_IDEMPOTENCY_RESOURCE,
      },
      select: { response_cache: true },
    });
    if (existingIdempotency?.response_cache) {
      const cache = existingIdempotency.response_cache as {
        payload_hash?: string;
        result?: SettlementResult;
      };
      if (cache.payload_hash && cache.payload_hash !== requestHash) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      if (cache.result) {
        return cache.result;
      }
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        outstanding_amount: number;
        currency_code: string;
        branch_id: string | null;
        customer_id: string;
      }>
    >`
      SELECT id, outstanding_amount::float8, currency_code, branch_id, customer_id
      FROM public.org_orders_mst
      WHERE id = ${orderId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
        AND payment_type_code = 'PAY_ON_COLLECTION'
        AND COALESCE(outstanding_amount, 0) > 0
      FOR UPDATE
    `;

    if (!rows[0]) {
      throw new Error('Order not found or not awaiting later collection');
    }

    const outstanding = rows[0].outstanding_amount;
    const currencyCode = requireCurrencyCode(rows[0].currency_code, `later-collection order ${orderId}`);
    const branchId = rows[0].branch_id;
    const customerId = params.customerId ?? rows[0].customer_id;
    const totalCollected = paymentLegs.reduce((sum, leg) => sum + leg.amount, 0);

    await assertOpenPosSessionForFinanceTx(tx, {
      tenantId,
      userId: posSessionUserId ?? collectedBy,
      posSessionId,
      branchId,
    });

    if (totalCollected <= 0) {
      throw new Error('Collected amount must be greater than zero');
    }
    if ((policy.requireFullCollectionOnPickup || !policy.allowPartialLaterCollection) && totalCollected < outstanding) {
      throw new Error(`Collected amount (${totalCollected}) is less than outstanding (${outstanding})`);
    }

    // D9-aware method resolution (B31): the same effective-config chain
    // (org override → sys default, branch overrides merged in) the submit
    // planner uses, instead of collect's own bespoke lookup that never read
    // default_creation_status/allow_status_override at all.
    const effectiveConfigs = await listEffectivePaymentMethodConfigs({
      tenantId,
      branchId: branchId ?? undefined,
      methodIds: paymentLegs.map((leg) => leg.paymentMethodId),
    });
    const configById = new Map(effectiveConfigs.map((c) => [c.id, c]));

    const resolvedLegs: CollectionLegInput[] = [];
    // B31: per-leg D9 creation-status resolution, shared with the submit
    // planner via resolveDefaultStatus() — collect no longer hardcodes
    // gatewayCode ? 'PENDING' : 'COMPLETED'.
    const resolvedStatusByLegIndex = new Map<number, string>();

    for (const [legIndex, leg] of paymentLegs.entries()) {
      const method = configById.get(leg.paymentMethodId);
      if (!method || !method.is_enabled || method.is_platform_disabled) {
        throw new Error('Selected payment method is not available for later collection');
      }
      // Later collection only ever records real money against the order —
      // a CREDIT_APPLICATION-natured method (wallet/gift card/loyalty/advance)
      // must redeem stored value, not create a payment row. Fail closed
      // rather than silently mis-processing (pre-existing gap, closed here).
      if (method.payment_nature !== PAYMENT_NATURE.REAL_PAYMENT) {
        throw new Error('INVALID_PAYMENT_NATURE_FOR_COLLECTION');
      }
      const requiresCashDrawer = method.requires_cash_drawer;

      if (method.payment_method_code === 'CASH') {
        const cashTendered = leg.cashTendered ?? leg.amount;
        if (cashTendered < leg.amount) {
          throw new Error('CASH_TENDERED_LESS_THAN_AMOUNT');
        }
        if (cashTendered - leg.amount > SETTLEMENT_MONEY_EPSILON && !method.supports_change_return) {
          throw new Error('CASH_CHANGE_NOT_ALLOWED');
        }
      } else if (leg.cashTendered != null) {
        throw new Error('CASH_TENDERED_ONLY_FOR_CASH');
      }

      const defaultCreationStatus =
        method.default_creation_status ||
        resolveDefaultStatus(method.payment_method_code, method.gateway_code);
      // B32 (M8) investigation note: see the matching comment in
      // order-settlement-planner.service.ts's buildSettlementPlan — enforcing
      // allow_status_override against this explicit per-leg override would
      // regress the already-shipped/tested B31 "explicit PENDING always
      // honored" behavior. Not enforced here for the same reason.
      resolvedStatusByLegIndex.set(
        legIndex,
        leg.paymentStatus === 'PENDING' ? 'PENDING' : defaultCreationStatus,
      );

      resolvedLegs.push({
        legIndex,
        orgPaymentMethodId: method.id,
        paymentMethodCode: method.payment_method_code,
        amount: leg.amount,
        cashTendered: leg.cashTendered,
        supportsChangeReturn: method.supports_change_return,
        supportsOverpayment: method.supports_overpayment,
        gatewayCode: method.gateway_code,
        requiresCashDrawer,
        reference: leg.reference,
        checkNumber: leg.checkNumber,
        checkBank: leg.checkBank,
        checkDate: leg.checkDate,
      });
    }

    const overpaymentMetrics = computeCollectionOverpaymentMetrics(outstanding, resolvedLegs, { currencyCode });
    if (overpaymentMetrics.unresolvedExcessAmount > SETTLEMENT_MONEY_EPSILON) {
      if (!overpaymentResolution) {
        throw new Error('OVERPAYMENT_RESOLUTION_REQUIRED');
      }

      // Synthesize PaymentLeg context for RETURN_CASH_CHANGE validation.
      // Collect-payment legs use paymentMethodId (no legRef), so the shared
      // validator cannot cross-reference them directly. Map the cash resolved leg
      // to the legRef from the resolution line so the capacity/identity checks pass.
      const cashChangeRef = (() => {
        const line = overpaymentResolution.lines.find(
          (l) => l.resolutionCode === OVERPAYMENT_RESOLUTIONS.RETURN_CASH_CHANGE
        );
        return line && 'legRef' in line ? (line as { legRef: string }).legRef : null;
      })();
      const syntheticPaymentLegs: PaymentLeg[] | undefined = cashChangeRef
        ? resolvedLegs.map((leg) => ({
            method: leg.paymentMethodCode as PaymentLeg['method'],
            amount: leg.amount,
            cashTendered: leg.cashTendered,
            legRef:
              leg.paymentMethodCode === PAYMENT_METHODS.CASH ? cashChangeRef : undefined,
          }))
        : undefined;

      await validateOverpaymentResolution(
        {
          orderId,
          totalAmount: outstanding,
          realPaymentLegs: resolvedLegs.map(
            (leg) =>
              ({
                legIndex: leg.legIndex,
                paymentMethodCode: leg.paymentMethodCode,
                orgPaymentMethodId: leg.orgPaymentMethodId,
                amount: leg.amount,
                currencyCode,
                tenderedAmount: leg.cashTendered,
                supportsChangeReturn: leg.supportsChangeReturn,
                supportsOverpayment: leg.supportsOverpayment,
                requiresReference: false,
                requiresCashDrawer: leg.requiresCashDrawer,
                requiresTerminal: false,
                defaultCreationStatus: 'COMPLETED',
                allowStatusOverride: false,
                resolvedPaymentStatus: 'COMPLETED',
              }) as import('@/lib/types/settlement-plan').RealPaymentLeg
          ),
          creditApplicationLegs: [],
          realPaymentAmount: totalCollected,
          creditAppliedAmount: 0,
          immediateSettlementAmount: totalCollected,
          outstandingAmount: Math.max(0, outstanding - totalCollected),
          outstandingPolicy: 'NONE',
          shouldCreateReceiptVoucher: false,
          shouldCreateArInvoice: false,
          excessAmount: overpaymentMetrics.excessAmount,
          unresolvedExcessAmount: overpaymentMetrics.unresolvedExcessAmount,
          cashChangeCapacity: overpaymentMetrics.cashChangeCapacity,
          canReturnChangeFromCash: overpaymentMetrics.canReturnChangeFromCash,
          hasAllowedRetainedOverpayment: overpaymentMetrics.hasAllowedRetainedOverpayment,
        },
        overpaymentResolution,
        { customerId, tenantId, paymentLegs: syntheticPaymentLegs }
      );
    }

    // ── BVM voucher creation + wiring (B4) ───────────────────────────────────
    // One RECEIPT voucher per collection event; each leg becomes an
    // ORDER_PAYMENT voucher line, then postAndWireBizVoucher dispatches the
    // same wiring-handler registry submit-order uses — orderPaymentWiringHandler
    // creates the org_order_payments_dtl row, cashDrawerWiringHandler creates
    // the org_cash_drawer_movements_dtl row(s) — so every collection payment
    // carries a fin_voucher_id/fin_voucher_trx_line_id backlink and satisfies
    // ORDER_PAYMENT_LINK_EXISTS (B20). Change is auto-derived by addVoucherLine
    // from tenderedAmount − amount, same as submit.
    const voucher = await createBizVoucher(
      tenantId,
      {
        voucher_type:    VOUCHER_TYPE.RECEIPT,
        direction:       'IN',
        party_type:      'CUSTOMER',
        customer_id:     customerId ?? undefined,
        order_id:        orderId,
        source_module:   'ORDERS',
        source_ref_type: 'ORDER',
        source_ref_id:   orderId,
        currency_code:   currencyCode,
        total_amount:    totalCollected,
        branch_id:       branchId ?? undefined,
        idempotency_key: `${idempotencyKey}_vch`,
      },
      collectedBy,
      tx,
    );

    let changeReturned = 0;

    for (const resolved of resolvedLegs) {
      const change =
        resolved.cashTendered && resolved.cashTendered > resolved.amount
          ? resolved.cashTendered - resolved.amount
          : 0;
      changeReturned += change;

      if (resolved.paymentMethodCode === 'CASH' && resolved.requiresCashDrawer && !cashDrawerSessionId) {
        throw new Error('CASH_DRAWER_SESSION_REQUIRED');
      }

      await addVoucherLine(
        tenantId,
        voucher.id,
        {
          line_type:              LINE_TYPE.RECEIPT,
          line_role:              LINE_ROLE.ORDER_PAYMENT,
          direction:              'IN',
          target_type:            'ORDER',
          target_id:              orderId,
          order_id:               orderId,
          customer_id:            customerId ?? undefined,
          branch_id:              branchId ?? undefined,
          payment_method_code:    resolved.paymentMethodCode,
          payment_status:         resolvedStatusByLegIndex.get(resolved.legIndex) ?? 'PENDING',
          org_payment_method_id:  resolved.orgPaymentMethodId,
          amount:                 resolved.amount,
          currency_code:          currencyCode,
          cash_drawer_session_id: resolved.requiresCashDrawer ? (cashDrawerSessionId ?? undefined) : undefined,
          tendered_amount:        resolved.cashTendered,
          gateway_code:           resolved.gatewayCode ?? undefined,
          gateway_reference:      resolved.reference,
          check_number:           resolved.checkNumber,
          check_bank:             resolved.checkBank,
          check_date:             resolved.checkDate,
          // Event-level note repeated on each leg: the wiring handler creates
          // one payment row per leg, so this is where it has to live to reach
          // `org_order_payments_dtl.rec_notes`.
          notes:                  notes,
          pos_session_id:         posSessionId,
          idempotency_key:        `${idempotencyKey}_leg_${resolved.legIndex}`,
        },
        collectedBy,
        undefined,
        tx,
      );

      if (resolved.paymentMethodCode === 'CASH' && resolved.requiresCashDrawer && cashDrawerSessionId) {
        await autoLinkDrawerTx(tx, {
          tenantId,
          userId: posSessionUserId ?? collectedBy,
          posSessionId,
          branchId,
          cashDrawerSessionId,
          idempotencyKey: `${idempotencyKey}_pos_link_${resolved.legIndex}`,
          sourceChannel: 'collect_payment',
        });
      }
    }

    await postAndWireBizVoucher(tenantId, voucher.id, collectedBy, CASH_GATE_MODES.INTERACTIVE, `${idempotencyKey}_vch_post`, tx);

    if (overpaymentResolution && overpaymentMetrics.excessAmount > SETTLEMENT_MONEY_EPSILON) {
      const dispositionOnly = resolutionIncludesAllocation(overpaymentResolution)
        ? getDispositionLinesExcludingAllocation(overpaymentResolution)
        : overpaymentResolution;

      if (dispositionOnly.lines.length > 0) {
        await executeOverpaymentDispositionTx({
          tx,
          tenantId,
          userId: collectedBy,
          orderId,
          branchId,
          customerId,
          currencyCode,
          // D007: overpayment disposition links to the settlement voucher now
          // that one exists for every collection event (was null pre-B4).
          voucherId: voucher.id,
          resolution: dispositionOnly,
          idempotencyKey,
        });
      }

      const previewId = extractAllocationPreviewId(overpaymentResolution);
      if (previewId && customerId) {
        await executeAllocationPreviewTx({
          tx,
          tenantId,
          userId: collectedBy,
          customerId,
          sourceOrderId: orderId,
          currencyCode,
          voucherId: voucher.id,
          previewId,
          idempotencyKey,
          paymentMethodCode: resolvedLegs[0]?.paymentMethodCode ?? 'CASH',
        });
      }
    }

    const snapshot = await recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId);

    await emitEventTx(tx, tenantId, OUTBOX_EVENT_TYPES.PAYMENT_RECEIVED, 'order', orderId, {
      collectedBy,
      totalCollected,
      paymentStatus: snapshot.paymentStatus,
    });

    const result: SettlementResult = {
      orderId,
      paymentStatus: snapshot.paymentStatus,
      // addMoney avoids float drift across multi-leg accumulation.
      totalPaid: addMoney(snapshot.totalPaidAmount, snapshot.totalCreditAppliedAmount).toNumber(),
      outstanding: snapshot.outstandingAmount,
      changeReturned,
    };

    // Persist the full result under the top-level collection-event key so a
    // later replay (§0 above) returns it verbatim with zero new effects.
    const now = new Date();
    await tx.org_idempotency_keys.upsert({
      where: {
        tenant_org_id_key_resource_type: {
          tenant_org_id: tenantId,
          key: idempotencyKey,
          resource_type: COLLECT_PAYMENT_IDEMPOTENCY_RESOURCE,
        },
      },
      create: {
        tenant_org_id: tenantId,
        key: idempotencyKey,
        resource_type: COLLECT_PAYMENT_IDEMPOTENCY_RESOURCE,
        resource_id: voucher.id,
        response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
        created_at: now,
        expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        resource_id: voucher.id,
        response_cache: { payload_hash: requestHash, result } as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  }));
}
