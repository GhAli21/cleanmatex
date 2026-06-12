import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  CREDIT_APPLICATION_TYPES,
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
import { queueEarnPoints, redeemPointsTx } from './loyalty.service';
import { recalculateOrderFinancialSnapshotTx } from './order-financial-write.service';
import { redeemAdvanceTx, redeemCreditNoteTx, redeemWalletTx } from './stored-value.service';
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
import type { OverpaymentResolutionInput } from '@/lib/validations/new-order-payment-schemas';
import { SETTLEMENT_MONEY_EPSILON } from '@/lib/constants/settlement-catalog';

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
  cashDrawerSessionId?: string;
  settledBy?: string;
  /**
   * When true the BVM wiring service is responsible for writing
   * org_order_payments_dtl and org_order_credit_apps_dtl rows.
   * Skip the direct writes here to avoid double-write. Default: false.
   */
  wiringMode?: boolean;
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
 * Settle an order in one transaction.
 *
 * Why:
 * This path writes all order-level financial facts, preserves gateway safety,
 * and recalculates the header snapshot from persisted rows instead of trusting
 * one-off request math.
 *
 * @param params settlement payload resolved by checkout
 * @returns normalized snapshot result after persistence
 */
export async function settleOrder(params: SettlementParams): Promise<SettlementResult> {
  return prisma.$transaction((tx) => settleOrderTx(tx, params));
}

/**
 * Settle an order using the caller's transaction.
 *
 * This is used by submit-order so the order header, voucher wiring, stored-value
 * debits, payment fact rows, and financial snapshot commit or roll back together.
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
    cashDrawerSessionId,
    settledBy,
    wiringMode = false,
  } = params;
  const currencyCode = breakdown.currencyCode;

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
      const { settlementOption: option, amount, terminalId, cashTendered, creditReferenceId } = leg;

      if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
        // Use subMoney to avoid float drift on 3-decimal currencies (OMR/BHD/KWD).
        const change = cashTendered && cashTendered > amount ? subMoney(cashTendered, amount).toNumber() : 0;
        // BVM Phase 6 Sub-item 6 (B7 closer): honor explicit per-leg status
        // first; fall back to the gateway-driven PENDING rule for callers
        // that omit the field (Zod defaults to `'COMPLETED'`).
        const paymentStatus =
          leg.paymentStatus === 'PENDING'
            ? 'PENDING'
            : option.gatewayCode
              ? 'PENDING'
              : 'COMPLETED';
        changeReturned += change;

        // In wiringMode the BVM wiring handler creates this row — skip to avoid double-write
        if (!wiringMode) {
          await tx.org_order_payments_dtl.create({
            data: {
              tenant_org_id: tenantId,
              order_id: orderId,
              org_payment_method_id: option.id,
              payment_method_code: option.paymentMethodCode,
              currency_code: currencyCode,
              payment_nature_snapshot: 'REAL_PAYMENT',
              amount,
              payment_terminal_id: terminalId ?? null,
              tendered_amount: cashTendered ?? null,
              change_returned_amount: change > 0 ? change : null,
              cash_drawer_session_id: option.requiresCashDrawer ? (cashDrawerSessionId ?? null) : null,
              gateway_code: option.gatewayCode ?? null,
              gateway_reference: leg.reference ?? null,
              payment_status: paymentStatus,
              paid_at: paymentStatus === 'COMPLETED' ? new Date() : null,
              is_active: true,
              rec_status: 1,
              received_by: settledBy ?? null,
            },
          });
        }
        continue;
      }

      if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
        // Throw rather than fall back: matches the planner's contract — every
        // CREDIT_APPLICATION leg must have a known credit_application_type.
        if (!option.creditApplicationType) {
          throw new Error('CREDIT_APPLICATION_TYPE_REQUIRED');
        }
        const creditType = option.creditApplicationType;

        // Phase 2 (BVM Wiring) consolidation: when the caller already ran the
        // BVM voucher tx (wiringMode=true), the stored-value ledger debits
        // and the credit-application fact row were both written there. The
        // entire CREDIT_APPLICATION branch in settleOrder must be a no-op or
        // we double-debit the customer's balance. The orchestrator's TX2 owns
        // the redemption now; settleOrder only writes the order snapshot.
        if (wiringMode) {
          continue;
        }

        const order = await tx.org_orders_mst.findFirstOrThrow({
          where: { id: orderId, tenant_org_id: tenantId },
          select: { customer_id: true },
        });
        const customerId = order.customer_id!;

        if (creditType === CREDIT_APPLICATION_TYPES.WALLET) {
          await redeemWalletTx(tx, { tenantId, customerId, amount, orderId });
        } else if (creditType === CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE) {
          await redeemAdvanceTx(tx, { tenantId, customerId, amount, orderId });
        } else if (creditType === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT && creditReferenceId) {
          await redeemCreditNoteTx(tx, {
            tenantId,
            customerId,
            creditNoteId: creditReferenceId,
            amount,
            orderId,
          });
        } else if (creditType === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT) {
          // F21 — Deterministic idempotency key. Previously included Date.now()
          // which produced a fresh key on every retry, defeating the unique
          // constraint on org_loyalty_txn_dtl(tenant_org_id, idempotency_key)
          // and silently double-debiting loyalty points if the orchestrator
          // retried mid-flight. Stable key = single ledger row per order.
          const idempotencyKey = `loyalty-redeem-${orderId}`;
          const pointsToRedeem = Math.ceil(amount / (option.minAmount ?? 1));
          await redeemPointsTx(tx, {
            tenantId,
            customerId,
            pointsToRedeem,
            monetaryAmount: amount,
            orderId,
            idempotencyKey,
          });
        }

        // Gift card debit happens earlier in create-with-payment to preserve
        // the legacy two-transaction order create flow. The settlement step
        // records only the order-level credit application fact.
        await tx.org_order_credit_apps_dtl.create({
          data: {
            tenant_org_id:    tenantId,
            order_id:         orderId,
            currency_code:    currencyCode,
            credit_type:      creditType,
            application_status: 'APPLIED',
            credit_source_id: creditReferenceId ?? null,
            applied_amount:   amount,
            reference_no:     leg.reference ?? null,
            applied_by:       settledBy ?? null,
            is_active:        true,
            rec_status:       1,
          },
        });
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

// ─── Verify Payment (BVM Wiring Phase 6 Sub-item 1) ─────────────────────────

/**
 * Input for the verify-payment endpoint.
 *
 * @property orderId    UUID of the order the payment belongs to.
 * @property paymentId  UUID of the `org_order_payments_dtl` row to verify.
 * @property tenantId   Tenant id resolved from the auth/permission middleware.
 * @property verifiedBy User id of the actor performing the verification.
 */
export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  tenantId: string;
  verifiedBy: string;
}

/**
 * Result of {@link verifyPaymentTx}. The header snapshot fields (status,
 * outstanding) are read from the freshly recalculated order row so the
 * caller can refresh the financial summary in a single round-trip.
 */
export interface VerifyPaymentResult {
  paymentId: string;
  previousStatus: string;            // 'PENDING' | 'COMPLETED' (idempotent path)
  newStatus: 'COMPLETED';
  verifiedAt: string;                // ISO timestamp
  orderPaymentStatus: string;        // header snapshot.paymentStatus after recalc
  outstanding: number;
  /** True when this call performed the PENDING → COMPLETED flip; false on idempotent replays. */
  flipped: boolean;
}

/**
 * BVM Wiring — Phase 6 Sub-item 1.
 *
 * Verify a single PENDING `REAL_PAYMENT` leg and flip it to COMPLETED.
 * This is the back-office assurance step after a gateway/bank confirms
 * funds for a leg that was created in PENDING state (typical for online
 * gateway captures and bank-cleared checks).
 *
 * Invariants (PRD §22.2):
 *
 *  1. **Composite tenant filter.** Every WHERE clause carries
 *     `(tenant_org_id, order_id, id)` so a verifier with one tenant's
 *     session can never touch another tenant's payment row.
 *  2. **Row lock.** The payment row is selected `FOR UPDATE` inside the
 *     transaction so two concurrent verifies cannot double-emit the
 *     outbox event or race the snapshot recalc.
 *  3. **Only REAL_PAYMENT.** Credit-application legs (gift card / wallet /
 *     advance / loyalty / credit note) are not "verified" — those flow
 *     through the stored-value ledgers and never enter PENDING here.
 *  4. **Idempotent.** Re-running on a row already in COMPLETED status is
 *     a silent no-op: same result shape, `flipped: false`, no outbox
 *     emission, no second header recalc.
 *  5. **Rejected for terminal states.** CANCELLED / FAILED / REFUNDED
 *     etc. throw — verification is only meaningful for PENDING.
 *  6. **Header recalc + outbox.** After the flip, the order header
 *     snapshot is recalculated from fact rows and a
 *     `PAYMENT_VERIFIED` outbox event is emitted within the same tx.
 *     The Phase 5 history consumer translates the event into an
 *     `org_order_history` row asynchronously.
 *
 * Tenant context: this service is called from a route handler that has
 * already resolved tenant via `requirePermission('orders:verify_payment')`.
 * `tenantId` is passed explicitly and bound into every Prisma query.
 *
 * @param params payment verification payload scoped to one tenant/order/payment row
 * @returns verification result with the refreshed order payment snapshot
 *
 * @throws Error('Payment not found') when no matching row exists for
 *         the composite key.
 * @throws Error('Payment cannot be verified — not a REAL_PAYMENT leg')
 *         when the leg is a credit application.
 * @throws Error('Payment cannot be verified — status is X')
 *         when the row is in a non-PENDING / non-COMPLETED state.
 */
export async function verifyPaymentTx(
  params: VerifyPaymentParams,
): Promise<VerifyPaymentResult> {
  const { orderId, paymentId, tenantId, verifiedBy } = params;

  return prisma.$transaction(async (tx) => {
    // ── 1. Lock the payment row with composite tenant filter ────────────
    // Raw SQL with FOR UPDATE — Prisma's findFirst does not support row
    // locking inside an interactive transaction. The composite filter is
    // explicit at the SQL level for defense-in-depth even though RLS
    // would already block cross-tenant rows.
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        order_id: string;
        payment_status: string;
        payment_nature_snapshot: string;
        paid_at: Date | null;
      }>
    >`
      SELECT id, order_id, payment_status, payment_nature_snapshot, paid_at
      FROM public.org_order_payments_dtl
      WHERE id = ${paymentId}::uuid
        AND order_id = ${orderId}::uuid
        AND tenant_org_id = ${tenantId}::uuid
      FOR UPDATE
    `;

    const row = rows[0];
    if (!row) {
      throw new Error('Payment not found');
    }

    if (row.payment_nature_snapshot !== PAYMENT_NATURE.REAL_PAYMENT) {
      throw new Error('Payment cannot be verified — not a REAL_PAYMENT leg');
    }

    // ── 2. Idempotent no-op when already COMPLETED ──────────────────────
    // Re-issuing the verify call must not double-emit the outbox event
    // or rewrite paid_at. We still refresh the snapshot from the order
    // header so the caller sees current outstanding/status.
    if (row.payment_status === 'COMPLETED') {
      const order = await tx.org_orders_mst.findFirstOrThrow({
        where: { id: orderId, tenant_org_id: tenantId },
        select: { payment_status: true, outstanding_amount: true },
      });
      return {
        paymentId,
        previousStatus: 'COMPLETED',
        newStatus: 'COMPLETED',
        verifiedAt: (row.paid_at ?? new Date()).toISOString(),
        orderPaymentStatus: order.payment_status ?? 'UNKNOWN',
        outstanding: Number(order.outstanding_amount ?? 0),
        flipped: false,
      };
    }

    if (row.payment_status !== 'PENDING') {
      throw new Error(`Payment cannot be verified — status is ${row.payment_status}`);
    }

    // ── 3. Flip PENDING → COMPLETED ─────────────────────────────────────
    const verifiedAt = new Date();
    const updated = await tx.org_order_payments_dtl.updateMany({
      where: {
        id: paymentId,
        order_id: orderId,
        tenant_org_id: tenantId,
        payment_status: 'PENDING',
      },
      data: {
        payment_status: 'COMPLETED',
        paid_at: verifiedAt,
        updated_at: verifiedAt,
        updated_by: verifiedBy,
      },
    });
    if (updated.count !== 1) {
      // Concurrent verifier already flipped the row between the SELECT
      // FOR UPDATE and the UPDATE — treat as a benign idempotent race.
      throw new Error('Payment verification race detected — please retry');
    }

    // ── 4. Recalculate the order header snapshot from fact rows ─────────
    const snapshot = await recalculateOrderFinancialSnapshotTx(
      tx,
      tenantId,
      orderId,
    );

    // ── 5. Emit outbox PAYMENT_VERIFIED event ───────────────────────────
    // Aggregate is the payment leg (not the order) so the Phase 5
    // history consumer can resolve back to the order via the payment
    // row and persist provenance (which payment was verified).
    await emitEventTx(
      tx,
      tenantId,
      OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED,
      'order_payment',
      paymentId,
      {
        orderId,
        paymentId,
        verifiedBy,
        actor_id: verifiedBy,
        verified_by: verifiedBy,
        previousStatus: 'PENDING',
        newStatus: 'COMPLETED',
        verifiedAt: verifiedAt.toISOString(),
      },
    );

    return {
      paymentId,
      previousStatus: 'PENDING',
      newStatus: 'COMPLETED',
      verifiedAt: verifiedAt.toISOString(),
      orderPaymentStatus: snapshot.paymentStatus,
      outstanding: snapshot.outstandingAmount,
      flipped: true,
    };
  });
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
  }>;
  cashDrawerSessionId?: string;
  collectedBy: string;
  customerId?: string | null;
  overpaymentResolution?: OverpaymentResolutionInput;
  idempotencyKey?: string;
}

/**
 * Collect actual money against an existing deferred order.
 *
 * Why:
 * Batch 0 needs real partial later collection support instead of forcing one
 * full settlement event that zeroes the header immediately.
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
    collectedBy,
    overpaymentResolution,
    idempotencyKey: idempotencyKeyInput,
  } = params;
  const policy = await getPartialLaterCollectionPolicy(tenantId);
  const idempotencyKey = idempotencyKeyInput ?? `${orderId}_collect_${collectedBy}`;

  return prisma.$transaction(async (tx) => {
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
    const currencyCode = rows[0].currency_code ?? 'OMR';
    const branchId = rows[0].branch_id;
    const customerId = params.customerId ?? rows[0].customer_id;
    const totalCollected = paymentLegs.reduce((sum, leg) => sum + leg.amount, 0);

    if (totalCollected <= 0) {
      throw new Error('Collected amount must be greater than zero');
    }
    if ((policy.requireFullCollectionOnPickup || !policy.allowPartialLaterCollection) && totalCollected < outstanding) {
      throw new Error(`Collected amount (${totalCollected}) is less than outstanding (${outstanding})`);
    }

    const resolvedLegs: CollectionLegInput[] = [];
    for (const [legIndex, leg] of paymentLegs.entries()) {
      const method = await tx.org_payment_methods_cf.findFirst({
        where: {
          id: leg.paymentMethodId,
          tenant_org_id: tenantId,
          is_active: true,
          is_enabled: true,
          is_platform_disabled: false,
        },
        select: {
          id: true,
          payment_method_code: true,
          gateway_code: true,
          requires_cash_drawer: true,
          supports_change_return: true,
          supports_overpayment: true,
        },
      });
      if (!method) {
        throw new Error('Selected payment method is not available for later collection');
      }
      const branchOverride = branchId
        ? await tx.org_branch_payment_methods_cf.findFirst({
            where: {
              tenant_org_id: tenantId,
              branch_id: branchId,
              org_payment_method_id: leg.paymentMethodId,
              is_active: true,
              rec_status: 1,
            },
            select: { cash_drawer_required: true },
          })
        : null;
      const requiresCashDrawer = branchOverride?.cash_drawer_required ?? method.requires_cash_drawer;

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

    const overpaymentMetrics = computeCollectionOverpaymentMetrics(outstanding, resolvedLegs);
    if (overpaymentMetrics.unresolvedExcessAmount > SETTLEMENT_MONEY_EPSILON) {
      if (!overpaymentResolution) {
        throw new Error('OVERPAYMENT_RESOLUTION_REQUIRED');
      }
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
        { customerId, tenantId }
      );
    }

    let changeReturned = 0;

    for (const resolved of resolvedLegs) {
      const change =
        resolved.cashTendered && resolved.cashTendered > resolved.amount
          ? resolved.cashTendered - resolved.amount
          : 0;
      changeReturned += change;

      const paymentStatus = resolved.gatewayCode ? 'PENDING' : 'COMPLETED';

      const payment = await tx.org_order_payments_dtl.create({
        data: {
          tenant_org_id: tenantId,
          order_id: orderId,
          org_payment_method_id: resolved.orgPaymentMethodId,
          payment_method_code: resolved.paymentMethodCode,
          currency_code: currencyCode,
          payment_nature_snapshot: 'REAL_PAYMENT',
          amount: resolved.amount,
          tendered_amount: resolved.cashTendered ?? null,
          change_returned_amount: change > 0 ? change : null,
          cash_drawer_session_id: resolved.requiresCashDrawer ? (cashDrawerSessionId ?? null) : null,
          gateway_code: resolved.gatewayCode ?? null,
          gateway_reference: resolved.reference ?? null,
          check_no: resolved.checkNumber ?? null,
          check_bank_name: resolved.checkBank ?? null,
          check_due_date: resolved.checkDate ? new Date(resolved.checkDate) : null,
          payment_status: paymentStatus,
          paid_at: paymentStatus === 'COMPLETED' ? new Date() : null,
          is_active: true,
          rec_status: 1,
          received_by: collectedBy,
        },
        select: { id: true },
      });

      if (resolved.paymentMethodCode === 'CASH' && resolved.requiresCashDrawer) {
        if (!cashDrawerSessionId) {
          throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        }
        const session = await tx.org_cash_drawer_sessions_mst.findFirst({
          where: {
            id: cashDrawerSessionId,
            tenant_org_id: tenantId,
            status: 'OPEN',
          },
          select: { id: true, cash_drawer_id: true, branch_id: true, currency_code: true },
        });
        if (!session) {
          throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        }
        await tx.org_cash_drawer_movements_dtl.create({
          data: {
            tenant_org_id: tenantId,
            branch_id: session.branch_id ?? branchId,
            cash_drawer_id: session.cash_drawer_id,
            cash_drawer_session_id: session.id,
            movement_type: 'CASH_SALE',
            direction: 'IN',
            amount: resolved.amount,
            currency_code: currencyCode ?? session.currency_code,
            order_id: orderId,
            order_payment_id: payment.id,
            performed_by: collectedBy,
            performed_at: new Date(),
            is_active: true,
            rec_status: 1,
            created_by: collectedBy,
          },
        });

        if (change > SETTLEMENT_MONEY_EPSILON && resolved.supportsChangeReturn) {
          await tx.org_cash_drawer_movements_dtl.create({
            data: {
              tenant_org_id: tenantId,
              branch_id: session.branch_id ?? branchId,
              cash_drawer_id: session.cash_drawer_id,
              cash_drawer_session_id: session.id,
              movement_type: 'CASH_OUT',
              direction: 'OUT',
              amount: change,
              currency_code: currencyCode ?? session.currency_code,
              order_id: orderId,
              order_payment_id: payment.id,
              performed_by: collectedBy,
              performed_at: new Date(),
              is_active: true,
              rec_status: 1,
              created_by: collectedBy,
            },
          });
        }
      }
    }

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
          voucherId: null,
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
          voucherId: null,
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

    return {
      orderId,
      paymentStatus: snapshot.paymentStatus,
      // addMoney avoids float drift across multi-leg accumulation.
      totalPaid: addMoney(snapshot.totalPaidAmount, snapshot.totalCreditAppliedAmount).toNumber(),
      outstanding: snapshot.outstandingAmount,
      changeReturned,
    };
  });
}
