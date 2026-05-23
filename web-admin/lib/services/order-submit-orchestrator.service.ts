/**
 * CANONICAL ORDER SUBMISSION ORCHESTRATOR
 *
 * All business logic for order creation + payment settlement lives here.
 * The submit-order route is a thin shell that delegates to submitOrder().
 *
 * Phase 1B addition: voucher creation + BVM wiring runs BEFORE settleOrder()
 * to prevent duplicate writes to org_order_payments_dtl (D11 design).
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { OrderService } from '@/lib/services/order-service';
import { calculateOrderTotals } from '@/lib/services/order-calculation.service';
import { createInvoice } from '@/lib/services/invoice-service';
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';
import { applyPromoCodeTx } from '@/lib/services/discount-service';
import { redeemGiftCardTx } from '@/lib/services/gift-card-service';
import { settleOrder } from '@/lib/services/order-settlement.service';
import { recordPaymentTransaction } from '@/lib/services/payment-service';
import { checkCreditLimit } from '@/lib/services/credit-limit.service';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher, getVoucherLinkedEffects } from '@/lib/services/voucher-wiring.service';
import { buildSettlementPlan, validateSettlementPlan } from '@/lib/services/order-settlement-planner.service';
import { calculateTax } from '@/lib/services/tax-engine.service';
import { PAYMENT_METHODS, getPaymentTypeFromMethod } from '@/lib/constants/order-types';
import { TAX_TYPES } from '@/lib/constants/order-financial';
import { LINE_ROLE, LINE_TYPE, VOUCHER_TYPE } from '@/lib/constants/voucher';
import { logger } from '@/lib/utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import type { AmountMismatchDifferences, PaymentMethodCode } from '@/lib/types/payment';
import type { PaymentLeg, SubmitOrderRequest } from '@/lib/validations/new-order-payment-schemas';
import type {
  FinancialBreakdownSnapshot,
  ResolvedSettlementLeg,
  TaxLineItem,
  DiscountLineInput as FinancialDiscountLineInput,
  SettlementOption,
} from '@/lib/types/order-financial';
import type { PostAndWireResult } from '@/lib/types/voucher-wiring';
import type { RequestAuditContext } from '@/lib/utils/request-audit';

const TOLERANCE = 0.001;

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

function buildDifferences(
  client: { subtotal: number; manualDiscount?: number; promoDiscount?: number; vatValue: number; finalTotal: number },
  server: { subtotal: number; manualDiscount: number; promoDiscount: number; vatValue: number; finalTotal: number }
): AmountMismatchDifferences {
  const diff: AmountMismatchDifferences = {};
  if (!withinTolerance(client.subtotal, server.subtotal))
    diff.subtotal = { client: client.subtotal, server: server.subtotal };
  if (!withinTolerance(client.manualDiscount ?? 0, server.manualDiscount))
    diff.manualDiscount = { client: client.manualDiscount ?? 0, server: server.manualDiscount };
  if (!withinTolerance(client.promoDiscount ?? 0, server.promoDiscount))
    diff.promoDiscount = { client: client.promoDiscount ?? 0, server: server.promoDiscount };
  if (!withinTolerance(client.vatValue, server.vatValue))
    diff.vatValue = { client: client.vatValue, server: server.vatValue };
  if (!withinTolerance(client.finalTotal, server.finalTotal))
    diff.finalTotal = { client: client.finalTotal, server: server.finalTotal };
  return diff;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SubmitOrderParams {
  tenantId:     string;
  userId:       string;
  userName:     string;
  branchId?:    string;
  input:        SubmitOrderRequest;
  requestAudit: RequestAuditContext;
}

export interface SubmitOrderResult {
  order: {
    id:                       string;
    orderNo:                  string;
    currentStatus:            string;
    totalAmount:              string;
    totalPaidAmount:          string;
    totalCreditAppliedAmount: string;
    outstandingAmount:        string;
    paymentStatus:            string;
    paymentTypeCode:          string;
  };
  voucher?: {
    id:           string;
    voucherNo:    string;
    status:       string;
    wiringStatus: 'WIRED' | 'PARTIALLY_WIRED';
  };
  effects: {
    orderPayments:      Array<{ id: string; amount: unknown; paymentMethodCode: string; paymentStatus: string }>;
    creditApplications: Array<{ id: string; amount: unknown; creditType: string }>;
    cashMovements:      Array<{ id: string; amount: unknown; sessionId: string | null }>;
  };
  warnings: string[];
}

// ── Branch resolution ─────────────────────────────────────────────────────────

/**
 * Resolves the effective branch for an order submission.
 *
 * Resolution order:
 *  1. Use branchId if it is a valid UUID and exists in org_branches_mst for the tenant.
 *  2. Fall back to the tenant's main branch (is_main=true).
 *  3. Return undefined when no branch can be resolved (order proceeds branch-less).
 *
 * Invalid UUIDs (empty string, non-UUID strings) are treated as absent rather than
 * rejected, so callers do not need to pre-validate the branch ID format.
 *
 * @param tenantId  Tenant organisation ID — used to scope the branch lookup.
 * @param branchId  Optional client-supplied branch UUID. Falsy or non-UUID values
 *                  are silently ignored and the main-branch fallback is used.
 * @returns Resolved branch UUID, or undefined when no branch is available.
 *
 * @example
 * const branchId = await resolveOrderBranch(tenantId, input.branchId ?? undefined);
 * // Returns main branch ID when input.branchId is absent or invalid.
 */
export async function resolveOrderBranch(
  tenantId: string,
  branchId?: string
): Promise<string | undefined> {
  const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

  let resolved: string | undefined = branchId;
  if (resolved && !UUID_REGEX.test(resolved.trim())) resolved = undefined;

  if (resolved) {
    const branch = await prisma.org_branches_mst.findFirst({
      where: { id: resolved, tenant_org_id: tenantId },
      select: { id: true },
    });
    if (!branch) resolved = undefined;
  }

  if (!resolved) {
    const mainBranch = await prisma.org_branches_mst.findFirst({
      where: { tenant_org_id: tenantId, is_main: true },
      select: { id: true },
    });
    resolved = mainBranch?.id ?? undefined;
  }

  return resolved;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Submits an order with payment settlement, optionally wiring a receipt voucher.
 *
 * This function is idempotency-unaware by design (D11). The route handler owns
 * the full idempotency lifecycle: it checks for an existing order by idempotencyKey
 * before calling this function, and writes the key back to the order row after
 * success. This keeps the orchestrator stateless and testable without key management.
 *
 * Flow:
 *  1. Calculate server-side totals + validate against client
 *  2. Validate payment legs (deferred rules, credit limit, check fields)
 *  3. tx1 — create order + invoice + promo/gift redemptions
 *  4. Resolve org_payment_methods_cf with D9 COALESCE config
 *  5. Build + validate settlement plan (fail-fast before any voucher creation)
 *  6. Create receipt voucher + lines + post+wire (when plan.shouldCreateReceiptVoucher)
 *  7. settleOrder(wiringMode) — skips payment fact rows when wiring ran
 *  8. AR payment tracking via recordPaymentTransaction + allocateArPaymentTx
 *  9. Return SubmitOrderResult (order snapshot + voucher + effects + warnings)
 *
 * @param params.tenantId      Tenant organisation ID — all DB calls scoped to this tenant.
 * @param params.userId        Authenticated user ID — written to audit and created_by fields.
 * @param params.userName      Display name for audit trail (falls back to 'User' at call site).
 * @param params.branchId      Resolved branch UUID (from resolveOrderBranch); may be undefined.
 * @param params.input         Validated SubmitOrderRequest — idempotencyKey is guaranteed non-empty.
 * @param params.requestAudit  IP and user-agent captured at the route boundary for stock deduction audit.
 * @returns SubmitOrderResult containing order snapshot, optional voucher summary,
 *          linked BVM effects, and non-fatal warnings (e.g. GATEWAY_PAYMENT_PROCESSING).
 * @throws Error('AMOUNT_MISMATCH')               — server totals differ from client totals.
 * @throws Error('PRODUCT_NOT_FOUND')             — a line item product does not exist for this tenant.
 * @throws Error('B2B_CREDIT_HOLD')               — customer has a credit hold; order blocked.
 * @throws Error('B2B_CREDIT_EXCEEDED')           — order would exceed credit limit (with creditLimit/available attached).
 * @throws Error('SPLIT_AMOUNT_MISMATCH')         — sum of multi-leg amounts ≠ order total.
 * @throws Error('DEFERRED_LEG_NOT_ALONE')        — deferred method mixed with other legs in a split.
 * @throws Error('CHECK_NUMBER_REQUIRED')         — CHECK leg missing a non-empty checkNumber.
 * @throws Error('CASH_DRAWER_SESSION_REQUIRED')  — CASH leg needs a drawer session but none supplied or found.
 * @throws Error('CASH_DRAWER_SESSION_CLOSED')    — referenced drawer session is not in OPEN status.
 * @throws Error('CASH_TENDERED_LESS_THAN_AMOUNT') — tendered cash is below the leg amount.
 * @throws Error('GATEWAY_NOT_CONFIGURED')        — gateway leg has no active org_payment_gateway_cf row.
 * @throws Error('PAYMENT_REFERENCE_REQUIRED')    — requiresReference=true leg has no reference field.
 *
 * @example
 * const result = await submitOrder({
 *   tenantId:     'org_uuid',
 *   userId:       'user_uuid',
 *   userName:     'Ali',
 *   branchId:     'branch_uuid',
 *   input:        parsedInput,
 *   requestAudit: getRequestAuditContext(request),
 * });
 * // result.order.id  → created order UUID
 * // result.voucher   → receipt voucher summary (when real/credit legs exist)
 * // result.warnings  → ['GATEWAY_PAYMENT_PROCESSING'] etc.
 */
export async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const { tenantId, userId, userName, branchId, input, requestAudit } = params;
  const { clientTotals } = input;

  // ── 1. Server-side totals ────────────────────────────────────────────────────
  const serverTotals = await calculateOrderTotals({
    tenantId,
    branchId,
    userId,
    items: input.items.map((i) => ({
      productId:        i.productId,
      quantity:         i.quantity,
      servicePrefCharge: i.servicePrefCharge ?? 0,
      packingPrefCharge: i.packingPrefCharge ?? 0,
    })),
    customerId:          input.customerId,
    isExpress:           input.express ?? false,
    percentDiscount:     input.percentDiscount ?? 0,
    amountDiscount:      input.amountDiscount ?? 0,
    promoCode:           input.promoCode,
    promoCodeId:         input.promoCodeId,
    giftCardNumber:      input.giftCardNumber,
    giftCardAmount:      input.giftCardAmount,
    giftCardId:          input.giftCardId,
    additionalTaxRate:   input.additionalTaxRate,
    additionalTaxAmount: input.additionalTaxAmount,
  });

  const differences = buildDifferences(
    {
      subtotal:       clientTotals.subtotal,
      manualDiscount: clientTotals.manualDiscount,
      promoDiscount:  clientTotals.promoDiscount,
      vatValue:       clientTotals.vatValue,
      finalTotal:     clientTotals.finalTotal,
    },
    {
      subtotal:       serverTotals.subtotal,
      manualDiscount: serverTotals.manualDiscount,
      promoDiscount:  serverTotals.promoDiscount,
      vatValue:       serverTotals.vatValue,
      finalTotal:     serverTotals.finalTotal,
    }
  );

  if (Object.keys(differences).length > 0) {
    const err = new Error('AMOUNT_MISMATCH');
    (err as Error & { differences: unknown }).differences = differences;
    throw err;
  }

  // ── 2. Payment leg resolution + validation ───────────────────────────────────
  const DEFERRED_METHODS = new Set<string>([PAYMENT_METHODS.PAY_ON_COLLECTION, PAYMENT_METHODS.INVOICE]);

  const paymentLegs: PaymentLeg[] = (input.paymentLegs && input.paymentLegs.length > 0)
    ? input.paymentLegs
    : [
        {
          method:      input.paymentMethod as PaymentLeg['method'],
          amount:      input.amountToCharge ?? clientTotals.finalTotal,
          checkNumber: input.checkNumber,
          checkBank:   input.checkBank,
          checkDate:   input.checkDate,
        },
      ];

  const isInvoiceOnly = paymentLegs.every((leg) => DEFERRED_METHODS.has(leg.method));
  const creditLimitOverride = input.creditLimitOverride === true;

  if (isInvoiceOnly) {
    const creditCheck = await checkCreditLimit(input.customerId, serverTotals.finalTotal);
    if (creditCheck.isCreditHold) {
      const err = new Error('B2B_CREDIT_HOLD'); throw err;
    }
    if (creditCheck.wouldExceed && !creditLimitOverride) {
      const err = new Error('B2B_CREDIT_EXCEEDED');
      Object.assign(err, {
        creditLimit:    creditCheck.creditLimit,
        currentBalance: creditCheck.currentBalance,
        available:      creditCheck.available,
      });
      throw err;
    }
  }

  const hasImmediatePayment = !isInvoiceOnly;
  const amountToCharge = paymentLegs
    .filter((leg) => !DEFERRED_METHODS.has(leg.method))
    .reduce((sum, leg) => sum + leg.amount, 0);

  if (!Number.isFinite(amountToCharge) || amountToCharge < 0 || amountToCharge > serverTotals.finalTotal + TOLERANCE)
    throw new Error('AMOUNT_OUT_OF_RANGE');
  if (hasImmediatePayment && amountToCharge <= 0)
    throw new Error('AMOUNT_OUT_OF_RANGE');

  if (paymentLegs.length > 1) {
    const legSum = paymentLegs.reduce((s, l) => s + l.amount, 0);
    if (Math.abs(legSum - serverTotals.finalTotal) > TOLERANCE)
      throw new Error('SPLIT_AMOUNT_MISMATCH');
  }

  if (paymentLegs.length > 1 && paymentLegs.some((leg) => DEFERRED_METHODS.has(leg.method)))
    throw new Error('DEFERRED_LEG_NOT_ALONE');

  for (const leg of paymentLegs) {
    if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim())
      throw new Error('CHECK_NUMBER_REQUIRED');
  }

  // ── 3. Resolve payment method config + build + validate settlement plan ─────────
  // Must happen BEFORE tx1 so infrastructure errors (drawer closed, gateway missing,
  // payment method not configured) abort before any DB writes are committed.
  type RawMethodRow = {
    id: string;
    payment_method_code: string;
    payment_nature: string;
    gateway_code: string | null;
    display_name: string;
    display_name2: string | null;
    settlement_type_code: string | null;
    credit_application_type: string | null;
    requires_cash_drawer: boolean;
    requires_terminal: boolean;
    min_amount: Decimal | null;
    max_amount: Decimal | null;
    min_order_amount: Decimal | null;
    max_order_amount: Decimal | null;
    is_platform_disabled: boolean;
    eff_default_creation_status: string;
    eff_allow_status_override: boolean;
    eff_requires_reference: boolean;
    eff_is_user_id_required: boolean;
    allowed_in_pos: boolean;
  };

  const methodCodes = [...new Set(paymentLegs.map((l) => l.method))];
  const methodRows = await withTenantContext(tenantId, () =>
    prisma.$queryRaw<RawMethodRow[]>`
      SELECT
        o.id, o.payment_method_code, o.payment_nature, o.gateway_code,
        o.display_name, o.display_name2, o.settlement_type_code, o.credit_application_type,
        o.requires_cash_drawer, o.requires_terminal,
        o.min_amount, o.max_amount, o.min_order_amount, o.max_order_amount,
        o.is_platform_disabled, o.allowed_in_pos,
        COALESCE(o.default_creation_status, s.default_creation_status) AS eff_default_creation_status,
        COALESCE(o.allow_status_override,   s.allow_status_override)   AS eff_allow_status_override,
        COALESCE(o.requires_reference,      s.requires_reference)      AS eff_requires_reference,
        COALESCE(o.is_user_id_required,     s.is_user_id_required)     AS eff_is_user_id_required
      FROM org_payment_methods_cf o
      JOIN sys_payment_method_cd s ON s.payment_method_code = o.payment_method_code
      WHERE o.tenant_org_id = ${tenantId}::uuid
        AND o.payment_method_code = ANY(${methodCodes}::text[])
        AND o.is_active  = true
        AND o.rec_status = 1
    `
  );

  const settlementLegs: ResolvedSettlementLeg[] = paymentLegs.map((leg) => {
    const row = methodRows.find((r) => r.payment_method_code === leg.method);
    if (!row) throw new Error(`Payment method config not found for code: ${leg.method}`);

    const settlementOption: SettlementOption = {
      id:                    row.id,
      paymentMethodCode:     row.payment_method_code,
      paymentNature:         row.payment_nature as SettlementOption['paymentNature'],
      gatewayCode:           row.gateway_code,
      displayName:           row.display_name,
      displayName2:          row.display_name2,
      settlementTypeCode:    row.settlement_type_code as SettlementOption['settlementTypeCode'],
      creditApplicationType: row.credit_application_type as SettlementOption['creditApplicationType'],
      requiresCashDrawer:    row.requires_cash_drawer,
      requiresTerminal:      row.requires_terminal,
      minAmount:             row.min_amount != null ? toNum(row.min_amount) : null,
      maxAmount:             row.max_amount != null ? toNum(row.max_amount) : null,
      minOrderAmount:        row.min_order_amount != null ? toNum(row.min_order_amount) : null,
      maxOrderAmount:        row.max_order_amount != null ? toNum(row.max_order_amount) : null,
      isPlatformDisabled:    row.is_platform_disabled,
      isGloballyDisabled:    false,
      defaultCreationStatus: row.eff_default_creation_status ?? 'PENDING',
      allowStatusOverride:   row.eff_allow_status_override ?? false,
      requiresReference:     row.eff_requires_reference ?? false,
      isUserIdRequired:      row.eff_is_user_id_required ?? false,
      allowedInPos:          row.allowed_in_pos ?? true,
    };

    return {
      settlementOption,
      amount:           leg.amount,
      cashTendered:     leg.cashTendered,
      reference:        leg.bank_reference ?? leg.gateway_reference,
      terminalId:       undefined,
      creditReferenceId: undefined,
    };
  });

  // orderId placeholder — plan is built before tx1 so we use '' here;
  // voucher lines use result.orderId directly after tx1.
  const plan = buildSettlementPlan(
    '',
    serverTotals.finalTotal,
    serverTotals.currencyCode,
    settlementLegs,
    paymentLegs,
    getPaymentTypeFromMethod(input.paymentMethod),
    input.cashDrawerSessionId ?? undefined
  );

  await validateSettlementPlan(plan, tenantId);

  const warnings: string[] = [];
  for (const leg of plan.realPaymentLegs) {
    if (leg.resolvedPaymentStatus === 'PENDING')    warnings.push(`${leg.paymentMethodCode}_PENDING_CONFIRMATION`);
    if (leg.resolvedPaymentStatus === 'PROCESSING') warnings.push('GATEWAY_PAYMENT_PROCESSING');
  }

  // ── 4. tx1 — create order + invoice + promo/gift (idempotency-unaware) ────────
  // All pre-flight checks above passed — safe to commit order rows now.
  const createOrderParams = {
    tenantId,
    userId,
    userName,
    customerId:   input.customerId,
    branchId,
    orderTypeId:  input.orderTypeId,
    items: input.items.map((i) => ({
      ...i,
      productName:  i.productName ?? null,
      productName2: i.productName2 ?? null,
    })),
    isQuickDrop:       input.isQuickDrop,
    quickDropQuantity: input.quickDropQuantity,
    express:           input.express,
    customerNotes:     input.customerNotes,
    paymentNotes:      input.paymentNotes,
    readyByAt:         input.readyByAt,
    paymentMethod:     input.paymentMethod,
    totals: {
      subtotal:  serverTotals.subtotal,
      discount:  serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount,
      tax:       serverTotals.additionalTaxAmount ?? 0,
      total:     serverTotals.finalTotal,
      vatRate:   serverTotals.vatTaxPercent,
      vatAmount: serverTotals.vatValue,
      taxRate:   input.additionalTaxRate ?? (input.additionalTaxAmount != null && serverTotals.afterDiscounts > 0
        ? (serverTotals.additionalTaxAmount / serverTotals.afterDiscounts) * 100
        : undefined),
    },
    discountRate:           input.percentDiscount ?? 0,
    promoCodeId:            input.promoCodeId,
    giftCardId:             input.giftCardId,
    promoDiscountAmount:    serverTotals.promoDiscount,
    giftCardDiscountAmount: serverTotals.giftCardApplied,
    paymentTypeCode:        getPaymentTypeFromMethod(input.paymentMethod),
    currencyCode:           serverTotals.currencyCode,
    orderSourceCode:        'pos',
    useOldWfCodeOrNew:      false,
    stockDeductionAudit: {
      referenceType: 'ORDER',
      userId,
      userName,
      userAgent: requestAudit.userAgent,
      userIp:    requestAudit.userIp,
      reason:    'Order sale deduction',
    },
    ...(input.customerMobile   != null && { customerMobile:   input.customerMobile }),
    ...(input.customerEmail    != null && input.customerEmail !== '' && { customerEmail: input.customerEmail }),
    ...(input.customerName     != null && { customerName:     input.customerName }),
    ...(input.isDefaultCustomer != null && { isDefaultCustomer: input.isDefaultCustomer }),
    ...(input.customerDetails  != null && { customerDetails:  input.customerDetails }),
    ...(input.b2bContractId    != null && { b2bContractId:    input.b2bContractId }),
    ...(input.costCenterCode   != null && input.costCenterCode !== '' && { costCenterCode: input.costCenterCode }),
    ...(input.poNumber         != null && input.poNumber !== '' && { poNumber: input.poNumber }),
    ...(creditLimitOverride && {
      creditLimitOverrideBy: userName,
      creditLimitOverrideAt: new Date(),
    }),
  };

  const result = await withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const orderResult = await OrderService.createOrderInTransaction(tx, createOrderParams);
      if (!orderResult.success || !orderResult.order)
        throw new Error(orderResult.error ?? 'Order creation failed');

      const { id: orderId, orderNo, currentStatus } = orderResult.order;

      const invoice = await createInvoice(
        {
          order_id:               orderId,
          subtotal:               serverTotals.subtotal,
          discount:               serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount,
          total:                  serverTotals.finalTotal,
          promo_discount_amount:  serverTotals.promoDiscount,
          gift_card_applied_amount: serverTotals.giftCardApplied,
          vatAmount:              serverTotals.vatValue,
          tax:                    serverTotals.additionalTaxAmount ?? 0,
          payment_method_code:    input.paymentMethod as PaymentMethodCode,
        },
        tx
      );

      if (input.promoCodeId && serverTotals.promoDiscount > 0) {
        await applyPromoCodeTx(tx, {
          promoCodeId:       input.promoCodeId,
          orderId,
          invoiceId:         invoice.id,
          tenantOrgId:       tenantId,
          customerId:        input.customerId ?? undefined,
          discountAmount:    serverTotals.promoDiscount,
          orderTotalBefore:  serverTotals.afterDiscounts + serverTotals.promoDiscount,
          appliedBy:         userId,
        });
      }

      if (input.giftCardId && serverTotals.giftCardApplied > 0) {
        await redeemGiftCardTx(tx, {
          giftCardId:        input.giftCardId,
          amount:            serverTotals.giftCardApplied,
          orderId,
          invoiceId:         invoice.id,
          branchId,
          processedBy:       userId,
          tenantOrgId:       tenantId,
          idempotencyKey:    `${orderId}:redeem`,
        });
      } else if (input.giftCardNumber && serverTotals.giftCardApplied > 0) {
        const legacyCard = await tx.org_gift_cards_mst.findFirst({
          where:  { tenant_org_id: tenantId, gift_card_code: input.giftCardNumber, is_active: true },
          select: { id: true },
        });
        if (legacyCard) {
          await redeemGiftCardTx(tx, {
            giftCardId:     legacyCard.id,
            amount:         serverTotals.giftCardApplied,
            orderId,
            invoiceId:      invoice.id,
            branchId,
            processedBy:    userId,
            tenantOrgId:    tenantId,
            idempotencyKey: `${orderId}:redeem`,
          });
        }
      }

      return { orderId, orderNo, invoiceId: invoice.id, currentStatus };
    })
  );

  // ── 5. Voucher creation + wiring (only when real/credit-app legs exist) ───────
    let voucherPostResult: PostAndWireResult | null = null;

      if (plan.shouldCreateReceiptVoucher) {
          const voucher = await withTenantContext(tenantId, () =>
                createBizVoucher(tenantId, {
                        voucher_type:    VOUCHER_TYPE.RECEIPT,
                                direction:       'IN',
                                        party_type:      'CUSTOMER',
                                                customer_id:     input.customerId ?? undefined,
                                                        order_id:        result.orderId,
                                                                source_module:   'ORDERS',
                                                                        source_ref_type: 'ORDER',
                                                                                source_ref_id:   result.orderId,
                                                                                        currency_code:   serverTotals.currencyCode,
                                                                                                total_amount:    plan.immediateSettlementAmount,
                                                                                                        branch_id:       branchId,
                                                                                                                idempotency_key: `${input.idempotencyKey}_vch`,
                                                                                                                      }, userId)
                                                                                                                          );

    for (const leg of plan.realPaymentLegs) {
      await withTenantContext(tenantId, () =>
        addVoucherLine(tenantId, voucher.id, {
          line_type:              LINE_TYPE.RECEIPT,
          line_role:              LINE_ROLE.ORDER_PAYMENT,
          direction:              'IN',
          target_type:            'ORDER',
          order_id:               result.orderId,
          customer_id:            input.customerId ?? undefined,
          branch_id:              branchId,
          payment_method_code:    leg.paymentMethodCode,
          org_payment_method_id:  leg.orgPaymentMethodId,
          amount:                 leg.amount,
          currency_code:          leg.currencyCode,
          cash_drawer_session_id: leg.cashDrawerSessionId,
          tendered_amount:        leg.tenderedAmount,
          gateway_code:           leg.gatewayCode,
          gateway_transaction_id: leg.gatewayTransactionId,
          gateway_reference:      leg.gatewayReference,
          bank_reference:         leg.bankReference,
          check_number:           leg.checkNumber,
          check_bank:             leg.checkBank,
          check_date:             leg.checkDate,
          payment_terminal_id:    leg.terminalId,
          card_brand_code:        leg.cardBrandCode,
          card_last4:             leg.cardLast4,
          auth_code:              leg.authCode,
          idempotency_key:        `${input.idempotencyKey}_vl_rp_${leg.legIndex}`,
        }, userId)
      );
    }

    for (const leg of plan.creditApplicationLegs) {
      await withTenantContext(tenantId, () =>
        addVoucherLine(tenantId, voucher.id, {
          line_type:               LINE_TYPE.CREDIT_APPLICATION,
          line_role:               LINE_ROLE.ORDER_CREDIT_APPLICATION,
          direction:               'NEUTRAL',
          target_type:             'ORDER',
          order_id:                result.orderId,
          customer_id:             input.customerId ?? undefined,
          branch_id:               branchId,
          amount:                  leg.amount,
          currency_code:           leg.currencyCode,
          credit_application_type: leg.creditType,
          idempotency_key:         `${input.idempotencyKey}_vl_ca_${leg.legIndex}`,
        }, userId)
      );
    }

    voucherPostResult = await withTenantContext(tenantId, () =>
      postAndWireBizVoucher(
        tenantId,
        voucher.id,
        userId,
        `${input.idempotencyKey}_vch_post`
      )
    );
  }

  // ── 7. settleOrder — wiringMode=true skips payment fact-row direct writes ─────
  // wiringMode: plan.shouldCreateReceiptVoucher tells settleOrder to skip its own
  // org_order_payments_dtl inserts because the BVM wiring (step 6) already wrote
  // those rows via postAndWireBizVoucher. Without this flag, settleOrder would
  // duplicate the payment fact rows and double-count paid amounts.
  const discountTotal = serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount;
  const taxTotal      = serverTotals.vatValue + (serverTotals.additionalTaxAmount ?? 0);

  // calculateTax() is the single source of truth for all tax line fields.
  // It reads org_tax_profiles_cf directly, so label, label2, rate, taxAmount,
  // and profileId are all internally consistent (rate × baseAmount = taxAmount).
  const profileLines = await withTenantContext(tenantId, () =>
    calculateTax({ tenantId, branchId, baseAmount: serverTotals.afterDiscounts, customerId: input.customerId ?? undefined })
  );

  const taxLines: TaxLineItem[] = [];
  if (serverTotals.vatValue > 0) {
    const profileLine = profileLines[0];
    taxLines.push({
      taxType:    profileLine?.taxType   ?? TAX_TYPES.VAT,
      label:      profileLine?.label     ?? 'VAT',
      label2:     profileLine?.label2    ?? 'ضريبة القيمة المضافة',
      profileId:  profileLine?.profileId,
      rate:       profileLine?.rate      ?? serverTotals.vatTaxPercent,
      baseAmount: serverTotals.afterDiscounts,
      // Use profile-computed amount — consistent with stored rate and taxable_amount.
      taxAmount:  profileLine?.taxAmount ?? serverTotals.vatValue,
    });
  }
  if ((serverTotals.additionalTaxAmount ?? 0) > 0) {
    taxLines.push({
      taxType:    TAX_TYPES.CUSTOM,
      label:      'Additional Tax',
      label2:     'ضريبة إضافية',
      rate:       input.additionalTaxRate ?? 0,
      isCompound: false,
      baseAmount: serverTotals.afterDiscounts,
      taxAmount:  serverTotals.additionalTaxAmount!,
    });
  }

  const breakdown: FinancialBreakdownSnapshot = {
    subtotal:         serverTotals.subtotal,
    chargesTotal:     0,
    grossTotal:       serverTotals.subtotal,
    discountTotal,
    netBeforeTax:     serverTotals.afterDiscounts,
    taxBreakdown:     taxLines,
    taxTotal,
    grandTotal:       serverTotals.finalTotal,
    creditsTotal:     serverTotals.giftCardApplied,
    netReceivable:    serverTotals.finalTotal - serverTotals.giftCardApplied,
    paymentLegsTotal: amountToCharge,
    changeReturned:   0,
    outstanding:      isInvoiceOnly
      ? serverTotals.finalTotal
      : Math.max(0, serverTotals.finalTotal - serverTotals.giftCardApplied - amountToCharge),
    currencyCode:     serverTotals.currencyCode,
    decimalPlaces:    serverTotals.decimalPlaces,
  };

  const financialDiscountLines: FinancialDiscountLineInput[] = serverTotals.discountLines.map((d) => ({
    sourceType:     d.sourceType,
    sourceId:       d.sourceId ?? null,
    sourceName:     d.sourceName,
    sourceName2:    d.sourceName2 ?? null,
    discountType:   d.discountType,
    discountRate:   d.discountRate ?? null,
    discountAmount: d.discountAmount,
  }));

  await withTenantContext(tenantId, () =>
    settleOrder({
      orderId:             result.orderId,
      tenantId,
      breakdown,
      chargeLines:         [],
      taxLines,
      discountLines:       financialDiscountLines,
      settlementLegs,
      cashDrawerSessionId: input.cashDrawerSessionId ?? undefined,
      settledBy:           userId,
      wiringMode:          plan.shouldCreateReceiptVoucher,
    })
  );

  // ── 8. AR payment tracking (writes to AR tables, not org_order_payments_dtl) ──
  if (hasImmediatePayment && amountToCharge > 0) {
    const immediateLegs = paymentLegs.filter((leg) => !DEFERRED_METHODS.has(leg.method));

    await withTenantContext(tenantId, async () =>
      prisma.$transaction(async (tx) => {
        for (const leg of immediateLegs) {
          const payment = await recordPaymentTransaction(
            {
              invoice_id:          result.invoiceId,
              order_id:            result.orderId,
              customer_id:         input.customerId,
              paid_amount:         leg.amount,
              payment_method_code: leg.method as PaymentMethodCode,
              payment_type_code:   getPaymentTypeFromMethod(leg.method),
              paid_by:             userId,
              branch_id:           branchId,
              currency_code:       serverTotals.currencyCode,
              currency_ex_rate:    1,
              check_number:        leg.checkNumber,
              check_bank:          leg.checkBank,
              check_date:          leg.checkDate ? new Date(leg.checkDate) : undefined,
              rec_notes:           input.paymentNotes,
              trans_desc:          input.paymentNotes,
              payment_channel:     'web_admin_checkout',
              // BVM wiring already created the receipt voucher (RV-*) — skip the legacy VCR-RCP-* voucher
              skipReceiptVoucher:  plan.shouldCreateReceiptVoucher,
            },
            tx
          );

          await allocateArPaymentTx(
            tx,
            result.invoiceId,
            {
              payment_id:              payment.id,
              voucher_id:              payment.voucher_id,
              allocated_amount:        leg.amount,
              unapplied_credit_amount: 0,
              applied_at:              new Date().toISOString(),
              notes:                   input.paymentNotes,
            },
            { tenantId, userId, userName }
          );
        }
      })
    );
  }

  // ── 9. Build response ─────────────────────────────────────────────────────────
  const finalOrder = await withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findFirstOrThrow({
      where:  { id: result.orderId, tenant_org_id: tenantId },
      select: {
        id: true, order_no: true, current_status: true,
        total: true, total_paid_amount: true,
        total_credit_applied_amount: true, outstanding_amount: true,
        payment_status: true, payment_type_code: true,
      },
    })
  );

  const linkedEffects = voucherPostResult
    ? await withTenantContext(tenantId, () =>
        getVoucherLinkedEffects(tenantId, voucherPostResult!.voucherId)
      )
    : null;

  const wiringLinesTotal = voucherPostResult
    ? (voucherPostResult.wiring.linesWired ?? 0) + (voucherPostResult.wiring.linesSkipped ?? 0)
    : 0;

  return {
    order: {
      id:                       finalOrder.id,
      orderNo:                  finalOrder.order_no,
      currentStatus:            finalOrder.current_status,
      totalAmount:              String(finalOrder.total ?? 0),
      totalPaidAmount:          String(finalOrder.total_paid_amount ?? 0),
      totalCreditAppliedAmount: String(finalOrder.total_credit_applied_amount ?? 0),
      outstandingAmount:        String(finalOrder.outstanding_amount ?? 0),
      paymentStatus:            finalOrder.payment_status ?? '',
      paymentTypeCode:          finalOrder.payment_type_code ?? '',
    },
    ...(voucherPostResult && {
      voucher: {
        id:           voucherPostResult.voucherId,
        voucherNo:    voucherPostResult.voucher_no,
        status:       voucherPostResult.voucher_status,
        wiringStatus: (voucherPostResult.wiring.linesWired ?? 0) === wiringLinesTotal
          ? 'WIRED' as const
          : 'PARTIALLY_WIRED' as const,
      },
    }),
    effects: {
      orderPayments: (linkedEffects?.orderPayments ?? []).map((p) => ({
        id:                p.id,
        amount:            p.amount,
        paymentMethodCode: p.payment_method_code ?? '',
        paymentStatus:     p.payment_status ?? '',
      })),
      creditApplications: (linkedEffects?.creditApplications ?? []).map((c) => ({
        id:         c.id,
        amount:     c.amount,
        creditType: c.credit_type ?? '',
      })),
      cashMovements: (linkedEffects?.cashDrawerMovements ?? []).map((m) => ({
        id:        m.id,
        amount:    m.amount,
        sessionId: m.session_id,
      })),
    },
    warnings,
  };
}
