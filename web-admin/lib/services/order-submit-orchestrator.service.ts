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
// eslint-disable-next-line no-restricted-imports -- Order submit still bridges the legacy order-centric invoice shape until the AR service exposes a drop-in create API for this workflow.
import { createInvoice } from '@/lib/services/invoice-service';
import { allocateArPaymentTx } from '@/lib/services/ar-invoice.service';
import { applyPromoCodeTx } from '@/lib/services/discount-service';
import { redeemGiftCardTx } from '@/lib/services/gift-card-service';
import { applyStoredValueDebitTx } from '@/lib/services/order-credit-application.service';
import { settleOrder } from '@/lib/services/order-settlement.service';
import { recordPaymentTransaction } from '@/lib/services/payment-service';
import { checkCreditLimit } from '@/lib/services/credit-limit.service';
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher, getVoucherLinkedEffects } from '@/lib/services/voucher-wiring.service';
import { buildSettlementPlan, validateSettlementPlan } from '@/lib/services/order-settlement-planner.service';
import { listEffectivePaymentMethodConfigs } from '@/lib/services/payment-config.service';
import { calculateTax } from '@/lib/services/tax-engine.service';
import { PAYMENT_METHODS, getPaymentTypeFromMethod } from '@/lib/constants/order-types';
import { getPaymentTypeFromOutstandingPolicy } from '@/lib/constants/payment';
import { TAX_TYPES, CREDIT_APPLICATION_TYPES } from '@/lib/constants/order-financial';
import type { CreditApplicationType } from '@/lib/constants/order-financial';
import { LINE_ROLE, LINE_TYPE, VOUCHER_TYPE } from '@/lib/constants/voucher';
import { logger } from '@/lib/utils/logger';
import { sumMoney } from '@/lib/utils/money';
import { Decimal } from '@prisma/client/runtime/library';
import type { AmountMismatchDifferences, PaymentMethodCode } from '@/lib/types/payment';
import type {
  OutstandingPolicy,
  PaymentLeg,
  SubmitOrderRequest,
} from '@/lib/validations/new-order-payment-schemas';
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

/**
 * Compares two monetary values using the orchestrator tolerance to avoid false mismatches.
 *
 * @param a First amount to compare.
 * @param b Second amount to compare.
 * @returns `true` when the values are close enough to be treated as equal.
 */
function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

/**
 * Normalizes nullable Prisma decimals into plain numbers for calculation helpers.
 *
 * @param d Prisma decimal value from persistence.
 * @returns Numeric amount or zero when the value is absent.
 */
function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/**
 * Short code per stored-value type, used as the discriminator in the Phase 2
 * sub-idempotency key format `${orderId}_sv_${code}_${legIndex}`.
 *
 * Why short codes: keeps the unique-index entries in each *_txn_dtl ledger
 * table lean and matches the Round-2 Fix A pattern (orderId-prefixed sub-keys).
 */
const STORED_VALUE_CODE: Record<CreditApplicationType, 'gc' | 'w' | 'a' | 'cn' | 'lp'> = {
  [CREDIT_APPLICATION_TYPES.GIFT_CARD]:        'gc',
  [CREDIT_APPLICATION_TYPES.WALLET]:           'w',
  [CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE]: 'a',
  [CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT]:  'cn',
  [CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT]:   'lp',
};

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

function normalizeOutstandingPolicy(
  inputPolicy: OutstandingPolicy | undefined,
  unpaidAmount: number,
  fallbackMethod: string
): OutstandingPolicy {
  if (unpaidAmount <= TOLERANCE) {
    return 'NONE';
  }

  if (inputPolicy && inputPolicy !== 'NONE') {
    return inputPolicy;
  }

  if (fallbackMethod === PAYMENT_METHODS.INVOICE) {
    return 'CREDIT_INVOICE';
  }

  return 'PAY_ON_COLLECTION';
}

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Input contract for the canonical order submission orchestrator.
 */
export interface SubmitOrderParams {
  tenantId:     string;
  userId:       string;
  userName:     string;
  branchId?:    string;
  input:        SubmitOrderRequest;
  requestAudit: RequestAuditContext;
}

/**
 * Output contract returned after order creation, settlement, and optional voucher wiring.
 */
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
 * @param params Submission context containing tenant scope, actor identity, input payload, and request audit data.
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

  const isDeferredOnly = paymentLegs.every((leg) => DEFERRED_METHODS.has(leg.method));
  const hasDeferredLeg = paymentLegs.some((leg) => DEFERRED_METHODS.has(leg.method));
  const hasImmediatePayment = paymentLegs.some((leg) => !DEFERRED_METHODS.has(leg.method));
  const creditLimitOverride = input.creditLimitOverride === true;
  // sumMoney avoids float drift across multi-leg totals (e.g. CASH 33.333 + CARD 66.667).
  const amountToCharge = sumMoney(
    paymentLegs.filter((leg) => !DEFERRED_METHODS.has(leg.method)).map((leg) => leg.amount)
  ).toNumber();
  const unpaidBalance = Math.max(0, serverTotals.finalTotal - amountToCharge);

  if (input.outstandingPolicy === 'NONE' && unpaidBalance > TOLERANCE) {
    throw new Error('OUTSTANDING_POLICY_REQUIRED');
  }

  const effectiveOutstandingPolicy = normalizeOutstandingPolicy(
    input.outstandingPolicy,
    unpaidBalance,
    input.paymentMethod
  );
  const paymentTypeCodeForOrder = getPaymentTypeFromOutstandingPolicy(
    effectiveOutstandingPolicy
  );

  if (effectiveOutstandingPolicy === 'CREDIT_INVOICE') {
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

  if (!Number.isFinite(amountToCharge) || amountToCharge < 0 || amountToCharge > serverTotals.finalTotal + TOLERANCE)
    throw new Error('AMOUNT_OUT_OF_RANGE');
  if (hasImmediatePayment && amountToCharge <= 0)
    throw new Error('AMOUNT_OUT_OF_RANGE');

  if (paymentLegs.length > 1) {
    // Split validation: sum legs via sumMoney so 33.333 + 33.333 + 33.334 = 100.000 exactly.
    const legSum = sumMoney(paymentLegs.map((l) => l.amount)).toNumber();
    const expectedLegSum = input.amountToCharge ?? amountToCharge;
    if (Math.abs(legSum - expectedLegSum) > TOLERANCE)
      throw new Error('SPLIT_AMOUNT_MISMATCH');
  }

  if (paymentLegs.length > 1 && hasDeferredLeg)
    throw new Error('DEFERRED_LEG_NOT_ALONE');

  if (isDeferredOnly && input.outstandingPolicy === 'NONE') {
    throw new Error('OUTSTANDING_POLICY_REQUIRED');
  }

  for (const leg of paymentLegs) {
    if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim())
      throw new Error('CHECK_NUMBER_REQUIRED');
  }

  // ── 3. Resolve payment method config + build + validate settlement plan ─────────
  // Must happen BEFORE tx1 so infrastructure errors (drawer closed, gateway missing,
  // payment method not configured) abort before any DB writes are committed.
  const methodCodes = [...new Set(paymentLegs.map((l) => l.method))];
  const methodRows = await listEffectivePaymentMethodConfigs({
    tenantId,
    branchId,
    methodCodes,
  });

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
      minAmount:             row.min_amount,
      maxAmount:             row.max_amount,
      minOrderAmount:        row.min_order_amount,
      maxOrderAmount:        row.max_order_amount,
      isPlatformDisabled:    row.is_platform_disabled,
      isGloballyDisabled:    row.is_globally_disabled,
      defaultCreationStatus: row.default_creation_status ?? 'PENDING',
      allowStatusOverride:   row.allow_status_override ?? false,
      requiresReference:     row.requires_reference ?? false,
      isUserIdRequired:      row.is_user_id_required ?? false,
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
    paymentTypeCodeForOrder,
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
    paymentTypeCode:        paymentTypeCodeForOrder ?? getPaymentTypeFromMethod(input.paymentMethod),
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

  // ADR_ar_invoice_is_receivable_only.md — `org_invoice_mst` rows represent
  // AR receivables only. Fully-paid cash/card/gateway orders and PAY_ON_COLLECTION
  // orders do NOT produce an AR invoice row at submit time. CREDIT_INVOICE / B2B
  // orders DO. The voucher receipt print serves as the cash-sale fiscal artifact
  // (Tax Documents Module replaces this dual role in a future feature).
  const shouldCreateArInvoice = effectiveOutstandingPolicy === 'CREDIT_INVOICE';

  const result = await withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const orderResult = await OrderService.createOrderInTransaction(tx, createOrderParams);
      if (!orderResult.success || !orderResult.order)
        throw new Error(orderResult.error ?? 'Order creation failed');

      const { id: orderId, orderNo, currentStatus } = orderResult.order;

      let invoiceId: string | null = null;
      if (shouldCreateArInvoice) {
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
        invoiceId = invoice.id;
      }

      if (input.promoCodeId && serverTotals.promoDiscount > 0) {
        await applyPromoCodeTx(tx, {
          promoCodeId:       input.promoCodeId,
          orderId,
          invoiceId:         invoiceId ?? undefined,
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
          invoiceId:         invoiceId ?? undefined,
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
            invoiceId:      invoiceId ?? undefined,
            branchId,
            processedBy:    userId,
            tenantOrgId:    tenantId,
            idempotencyKey: `${orderId}:redeem`,
          });
        }
      }

      return { orderId, orderNo, invoiceId, currentStatus };
    })
  );

  // ── 5. Voucher creation + lines + stored-value debits + post & wire ──────────
  //
  // Phase 2 (BVM Wiring) consolidation: header create → real-payment lines →
  // credit-application lines + the matching stored-value redemption (with the
  // voucher line backlink) → post & wire all run inside ONE Prisma transaction.
  //
  // Why one tx: a mid-flow failure (wallet insufficient, lock timeout, etc.)
  // must roll back the voucher header AND any partial debits. Previously each
  // step lived in its own withTenantContext, so a wallet-debit failure would
  // leave the voucher header committed with no payment fact rows.
  //
  // Lock order: plan.creditApplicationLegs are already sorted by
  // STORED_VALUE_LOCK_ORDER (planner Step 2), so `SELECT … FOR UPDATE` inside
  // each redeem*Tx is acquired in canonical sequence regardless of how the
  // client submitted the legs.
  let voucherPostResult: PostAndWireResult | null = null;

  if (plan.shouldCreateReceiptVoucher) {
    voucherPostResult = await withTenantContext(tenantId, () =>
      prisma.$transaction(async (tx) => {
        // 5.1 Voucher header
        const voucher = await createBizVoucher(
          tenantId,
          {
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
            // P3 Fix A (B6 RESUME doc): sub-keys are prefixed with
            // result.orderId so a fresh retry order produces fresh
            // sub-keys (no cross-order leak via the unique constraint).
            idempotency_key: `${result.orderId}_vch`,
          },
          userId,
          tx,
        );

        // 5.2 Real-payment lines (cash, card, gateway, check, bank transfer)
        for (const leg of plan.realPaymentLegs) {
          await addVoucherLine(
            tenantId,
            voucher.id,
            {
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
              idempotency_key:        `${result.orderId}_vl_rp_${leg.legIndex}`,
            },
            userId,
            undefined,
            tx,
          );
        }

        // 5.3 Credit-application legs: voucher line + matching stored-value
        // debit. Iteration order follows STORED_VALUE_LOCK_ORDER (planner
        // sort) so concurrent submits take row locks in the same sequence.
        for (const leg of plan.creditApplicationLegs) {
          const line = await addVoucherLine(
            tenantId,
            voucher.id,
            {
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
              idempotency_key:         `${result.orderId}_vl_ca_${leg.legIndex}`,
            },
            userId,
            undefined,
            tx,
          );

          if (!input.customerId) {
            // Credit-application legs require a customer. The planner already
            // validates this upstream, but the type system can't see that —
            // throw rather than passing `undefined` into the dispatcher.
            throw new Error('CUSTOMER_ID_REQUIRED_FOR_CREDIT_APPLICATION');
          }

          await applyStoredValueDebitTx(tx, {
            tenantId,
            orderId:           result.orderId,
            customerId:        input.customerId,
            creditType:        leg.creditType,
            amount:             leg.amount,
            creditReferenceId: leg.creditReferenceId,
            appliedBy:         userId,
            currencyCode:      leg.currencyCode,
            idempotencyKey:    `${result.orderId}_sv_${STORED_VALUE_CODE[leg.creditType]}_${leg.legIndex}`,
            voucherId:         voucher.id,
            voucherLineId:     line.id,
          });
        }

        // 5.4 Post + wire — joins the same tx so a wiring failure rolls back
        // the header, every line, every stored-value debit atomically.
        return postAndWireBizVoucher(
          tenantId,
          voucher.id,
          userId,
          `${result.orderId}_vch_post`,
          tx,
        );
      }),
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
      taxType:    profileLine?.taxType    ?? TAX_TYPES.VAT,
      label:      profileLine?.label      ?? 'VAT',
      label2:     profileLine?.label2     ?? 'ضريبة القيمة المضافة',
      profileId:  profileLine?.profileId,
      rate:       profileLine?.rate       ?? serverTotals.vatTaxPercent,
      // isCompound comes from org_tax_profiles_cf.is_compound; default FALSE matches DB default
      // when no profile is configured (additive VAT is the safe assumption).
      isCompound: profileLine?.isCompound ?? false,
      baseAmount: serverTotals.afterDiscounts,
      // Use profile-computed amount — consistent with stored rate and taxable_amount.
      taxAmount:  profileLine?.taxAmount  ?? serverTotals.vatValue,
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
    outstanding:      Math.max(0, serverTotals.finalTotal - serverTotals.giftCardApplied - amountToCharge),
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
  // ADR_ar_invoice_is_receivable_only.md — AR allocation only makes sense when
  // an AR invoice row exists (CREDIT_INVOICE / B2B). For fully-paid cash/card
  // sales, BVM wiring's voucher + org_order_payments_dtl IS the canonical
  // record of payment; the legacy AR tracking block would only add duplicate
  // rows in org_payments_dtl_tr and try to allocate against a null invoice.
  if (result.invoiceId && hasImmediatePayment && amountToCharge > 0) {
    const invoiceIdForAr = result.invoiceId;
    const immediateLegs = paymentLegs.filter((leg) => !DEFERRED_METHODS.has(leg.method));

    await withTenantContext(tenantId, async () =>
      prisma.$transaction(async (tx) => {
        for (const leg of immediateLegs) {
          const payment = await recordPaymentTransaction(
            {
              invoice_id:          invoiceIdForAr,
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
            invoiceIdForAr,
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
