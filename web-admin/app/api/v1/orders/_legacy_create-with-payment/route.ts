/**
 * @deprecated FROZEN — do not modify, do not add callers.
 *
 * This route has been superseded by POST /api/v1/orders/submit-order.
 * It is preserved for reference only and is NOT served by Next.js
 * (folder prefix `_legacy_` prevents routing).
 *
 * Canonical path: app/api/v1/orders/submit-order/route.ts
 * Orchestrator:   lib/services/order-submit-orchestrator.service.ts
 *
 * Any new order submission logic MUST go into the orchestrator, not here.
 * See: docs/features/Order_Fin/ADR_submit_order_canonical_path.md
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  createWithPaymentRequestSchema,
  type CreateWithPaymentRequest,
} from '@/lib/validations/new-order-payment-schemas';
import type { AmountMismatchDifferences, PaymentMethodCode } from '@/lib/types/payment';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import { logger } from '@/lib/utils/logger';
import { PAYMENT_METHODS, getPaymentTypeFromMethod } from '@/lib/constants/order-types';
import { TAX_TYPES } from '@/lib/constants/order-financial';
import { getRequestAuditContext } from '@/lib/utils/request-audit';
import { checkCreditLimit } from '@/lib/services/credit-limit.service';
import type {
  FinancialBreakdownSnapshot,
  ResolvedSettlementLeg,
  TaxLineItem,
  DiscountLineInput as FinancialDiscountLineInput,
  SettlementOption,
} from '@/lib/types/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

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
  if (!withinTolerance(client.subtotal, server.subtotal)) {
    diff.subtotal = { client: client.subtotal, server: server.subtotal };
  }
  if (!withinTolerance(client.manualDiscount ?? 0, server.manualDiscount)) {
    diff.manualDiscount = { client: client.manualDiscount ?? 0, server: server.manualDiscount };
  }
  if (!withinTolerance(client.promoDiscount ?? 0, server.promoDiscount)) {
    diff.promoDiscount = { client: client.promoDiscount ?? 0, server: server.promoDiscount };
  }
  if (!withinTolerance(client.vatValue, server.vatValue)) {
    diff.vatValue = { client: client.vatValue, server: server.vatValue };
  }
  if (!withinTolerance(client.finalTotal, server.finalTotal)) {
    diff.finalTotal = { client: client.finalTotal, server: server.finalTotal };
  }
  return diff;
}

/**
 * @deprecated Use submitOrder() orchestrator via /api/v1/orders/submit-order instead.
 * POST /api/v1/orders/create-with-payment
 */
export async function POST(request: NextRequest) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const authCheck = await requirePermission('orders:create')(request);
  if (authCheck instanceof NextResponse) {
    return authCheck;
  }
  const { tenantId, userId, userName } = authCheck;
  const requestAudit = getRequestAuditContext(request);

  const body = await request.json().catch(() => null);
  const parsed = createWithPaymentRequestSchema.safeParse(body);
  if (!parsed.success) {
    const rawBranchId = body && typeof body === 'object' && 'branchId' in body ? body.branchId : undefined;
    logger.error(
      '[create-with-payment] Request body validation failed',
      undefined,
      {
        feature: 'orders',
        action: 'create-with-payment',
        zodIssues: parsed.error.issues,
        branchId: {
          value: rawBranchId,
          type: typeof rawBranchId,
          length: rawBranchId != null ? String(rawBranchId).length : undefined,
        },
        payloadSummary: body && typeof body === 'object'
          ? {
              itemsCount: Array.isArray((body as { items?: unknown[] }).items) ? (body as { items: unknown[] }).items.length : undefined,
              paymentMethod: 'paymentMethod' in body ? (body as { paymentMethod?: unknown }).paymentMethod : undefined,
            }
          : { rawBodyType: body === null ? 'null' : typeof body },
      }
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body',
        details: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const input = parsed.data as CreateWithPaymentRequest;
  const { clientTotals } = input;

  // Idempotency: if the client sent a key we've already seen, return the
  // existing order instead of creating a duplicate (handles network retries).
  if (input.idempotencyKey) {
    const existing = await prisma.$queryRaw<{ id: string; order_no: string; current_status: string }[]>`
      SELECT id, order_no, current_status
      FROM org_orders_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        data: { id: existing[0].id, orderId: existing[0].id, orderNo: existing[0].order_no, currentStatus: existing[0].current_status },
      });
    }
  }

  const UUID_REGEX_V2 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

  // Resolve branchId: use provided value if valid UUID and exists for tenant; otherwise main branch
  let branchId: string | undefined = input.branchId;
  if (branchId && !UUID_REGEX_V2.test(branchId.trim())) {
    branchId = undefined;
  }
  if (branchId) {
    const branch = await prisma.org_branches_mst.findFirst({
      where: { id: branchId, tenant_org_id: tenantId },
      select: { id: true },
    });
    if (!branch) branchId = undefined;
  }
  if (!branchId) {
    const mainBranch = await prisma.org_branches_mst.findFirst({
      where: { tenant_org_id: tenantId, is_main: true },
      select: { id: true },
    });
    branchId = mainBranch?.id ?? undefined;
  }

  try {
    // Promo / gift fields are optional; clients may omit while checkout promo/gift UI is disabled.
    const serverTotals = await calculateOrderTotals({
      tenantId,
      branchId,
      userId,
      items: input.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        servicePrefCharge: i.servicePrefCharge ?? 0,
        packingPrefCharge: i.packingPrefCharge ?? 0,
      })),
      customerId: input.customerId,
      isExpress: input.express ?? false,
      percentDiscount: input.percentDiscount ?? 0,
      amountDiscount: input.amountDiscount ?? 0,
      promoCode: input.promoCode,
      promoCodeId: input.promoCodeId,
      giftCardNumber: input.giftCardNumber,
      giftCardAmount: input.giftCardAmount,
      giftCardId: input.giftCardId,
      additionalTaxRate: input.additionalTaxRate,
      additionalTaxAmount: input.additionalTaxAmount,
    });

    const differences = buildDifferences(
      {
        subtotal: clientTotals.subtotal,
        manualDiscount: clientTotals.manualDiscount,
        promoDiscount: clientTotals.promoDiscount,
        vatValue: clientTotals.vatValue,
        finalTotal: clientTotals.finalTotal,
      },
      {
        subtotal: serverTotals.subtotal,
        manualDiscount: serverTotals.manualDiscount,
        promoDiscount: serverTotals.promoDiscount,
        vatValue: serverTotals.vatValue,
        finalTotal: serverTotals.finalTotal,
      }
    );

    if (Object.keys(differences).length > 0) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'AMOUNT_MISMATCH',
          error: 'Amount mismatch. Values have changed. Please refresh to get correct amounts.',
          differences,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------------
    // Resolve payment legs (multi-leg split or single-leg fallback)
    // ---------------------------------------------------------------------------
    const DEFERRED_METHODS = new Set<string>([PAYMENT_METHODS.PAY_ON_COLLECTION, PAYMENT_METHODS.INVOICE]);

    /** Resolved legs — always at least one entry */
    const resolvedLegs: PaymentLeg[] = (input.paymentLegs && input.paymentLegs.length > 0)
      ? input.paymentLegs
      : [
          {
            method: input.paymentMethod as PaymentLeg['method'],
            amount: input.amountToCharge ?? clientTotals.finalTotal,
            checkNumber: input.checkNumber,
            checkBank: input.checkBank,
            checkDate: input.checkDate,
          },
        ];

    // isInvoiceOnly: true when ALL legs are deferred methods
    const isInvoiceOnly = resolvedLegs.every((leg) => DEFERRED_METHODS.has(leg.method));

    const creditLimitOverride = input.creditLimitOverride === true;
    if (isInvoiceOnly) {
      const creditCheck = await checkCreditLimit(input.customerId, serverTotals.finalTotal);
      if (creditCheck.isCreditHold) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'B2B_CREDIT_HOLD',
            error: 'This B2B customer is on credit hold. New orders are blocked until the hold is released.',
          },
          { status: 400 }
        );
      }
      if (creditCheck.wouldExceed && !creditLimitOverride) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'B2B_CREDIT_EXCEEDED',
            error: `Credit limit exceeded. Available: ${creditCheck.available.toLocaleString()}, Order total: ${serverTotals.finalTotal.toLocaleString()}`,
            creditLimit: creditCheck.creditLimit,
            currentBalance: creditCheck.currentBalance,
            available: creditCheck.available,
          },
          { status: 400 }
        );
      }
    }
    const hasImmediatePayment = !isInvoiceOnly;

    // Total amount across all immediate (non-deferred) legs
    const amountToCharge = resolvedLegs
      .filter((leg) => !DEFERRED_METHODS.has(leg.method))
      .reduce((sum, leg) => sum + leg.amount, 0);

    if (!Number.isFinite(amountToCharge) || amountToCharge < 0 || amountToCharge > serverTotals.finalTotal + TOLERANCE) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount to charge must be between 0 and the order total.',
        },
        { status: 400 }
      );
    }
    if (hasImmediatePayment && amountToCharge <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount to charge must be greater than 0 for immediate payment methods.',
        },
        { status: 400 }
      );
    }

    // Validate: multi-leg sum must equal finalTotal (within tolerance) when more than one leg
    if (resolvedLegs.length > 1) {
      const legSum = resolvedLegs.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(legSum - serverTotals.finalTotal) > TOLERANCE) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'SPLIT_AMOUNT_MISMATCH',
            error: `Sum of payment legs (${legSum}) must equal order total (${serverTotals.finalTotal}).`,
          },
          { status: 400 }
        );
      }
    }

    // Validate: if any leg uses deferred method it must be the only leg
    if (resolvedLegs.length > 1 && resolvedLegs.some((leg) => DEFERRED_METHODS.has(leg.method))) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'DEFERRED_LEG_NOT_ALONE',
          error: 'A deferred payment method (Invoice/Pay on Collection) must be the only payment leg.',
        },
        { status: 400 }
      );
    }

    // Validate check legs: each CHECK leg must have a checkNumber
    for (const leg of resolvedLegs) {
      if (leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()) {
        return NextResponse.json(
          {
            success: false,
            errorCode: 'CHECK_NUMBER_REQUIRED',
            error: 'Check number is required for check payments.',
          },
          { status: 400 }
        );
      }
    }

    const createOrderParams = {
      tenantId,
      userId,
      userName: userName ?? 'User',
      customerId: input.customerId,
      branchId,
      orderTypeId: input.orderTypeId,
      items: input.items.map((i) => ({
        ...i,
        productName: i.productName ?? null,
        productName2: i.productName2 ?? null,
      })),
      isQuickDrop: input.isQuickDrop,
      quickDropQuantity: input.quickDropQuantity,
      express: input.express,
      customerNotes: input.customerNotes,
      paymentNotes: input.paymentNotes,
      readyByAt: input.readyByAt,
      paymentMethod: input.paymentMethod,
      totals: {
        subtotal: serverTotals.subtotal,
        discount: serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount,
        tax: serverTotals.additionalTaxAmount ?? 0,
        total: serverTotals.finalTotal,
        vatRate: serverTotals.vatTaxPercent,
        vatAmount: serverTotals.vatValue,
        taxRate: input.additionalTaxRate ?? (input.additionalTaxAmount != null && serverTotals.afterDiscounts > 0
          ? (serverTotals.additionalTaxAmount / serverTotals.afterDiscounts) * 100
          : undefined),
      },
      discountRate: input.percentDiscount ?? 0,
      promoCodeId: input.promoCodeId,
      giftCardId: input.giftCardId,
      promoDiscountAmount: serverTotals.promoDiscount,
      giftCardDiscountAmount: serverTotals.giftCardApplied,
      paymentTypeCode: getPaymentTypeFromMethod(input.paymentMethod),
      currencyCode: serverTotals.currencyCode,
      orderSourceCode: 'pos',
      useOldWfCodeOrNew: false,
      stockDeductionAudit: {
        referenceType: 'ORDER',
        userId,
        userName: userName ?? 'User',
        userAgent: requestAudit.userAgent,
        userIp: requestAudit.userIp,
        reason: 'Order sale deduction',
      },
      ...(input.customerMobile != null && { customerMobile: input.customerMobile }),
      ...(input.customerEmail != null && input.customerEmail !== '' && { customerEmail: input.customerEmail }),
      ...(input.customerName != null && { customerName: input.customerName }),
      ...(input.isDefaultCustomer != null && { isDefaultCustomer: input.isDefaultCustomer }),
      ...(input.customerDetails != null && { customerDetails: input.customerDetails }),
      ...(input.b2bContractId != null && { b2bContractId: input.b2bContractId }),
      ...(input.costCenterCode != null && input.costCenterCode !== '' && { costCenterCode: input.costCenterCode }),
      ...(input.poNumber != null && input.poNumber !== '' && { poNumber: input.poNumber }),
      ...(creditLimitOverride && {
        creditLimitOverrideBy: userName ?? userId,
        creditLimitOverrideAt: new Date(),
      }),
    };

    // ── Transaction 1: create order, invoice, redeem promo/gift card ───────────
    const result = await withTenantContext(tenantId, async () =>
      prisma.$transaction(async (tx) => {
        const orderResult = await OrderService.createOrderInTransaction(tx, createOrderParams);
        if (!orderResult.success || !orderResult.order) {
          throw new Error(orderResult.error ?? 'Order creation failed');
        }

        const orderId = orderResult.order.id;
        const orderNo = orderResult.order.orderNo;

        const invoice = await createInvoice(
          {
            order_id: orderId,
            subtotal: serverTotals.subtotal,
            discount: serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount,
            total: serverTotals.finalTotal,
            promo_discount_amount: serverTotals.promoDiscount,
            gift_card_applied_amount: serverTotals.giftCardApplied,
            vatAmount: serverTotals.vatValue,
            tax: serverTotals.additionalTaxAmount ?? 0,
            payment_method_code: input.paymentMethod as PaymentMethodCode,
          },
          tx
        );

        // Apply promo code usage atomically within this transaction.
        // SELECT FOR UPDATE inside applyPromoCodeTx prevents TOCTOU races on max_uses.
        if (input.promoCodeId && serverTotals.promoDiscount > 0) {
          await applyPromoCodeTx(tx, {
            promoCodeId: input.promoCodeId,
            orderId,
            invoiceId: invoice.id,
            tenantOrgId: tenantId,
            customerId: input.customerId ?? undefined,
            discountAmount: serverTotals.promoDiscount,
            orderTotalBefore: serverTotals.afterDiscounts + serverTotals.promoDiscount,
            appliedBy: userId,
          });
        }

        // Store idempotency key on the order row so retries are detected above.
        if (input.idempotencyKey) {
          await tx.$executeRaw`
            UPDATE org_orders_mst
            SET idempotency_key = ${input.idempotencyKey}
            WHERE id = ${orderId}::uuid
              AND tenant_org_id = ${tenantId}::uuid
          `;
        }

        // Debit gift card atomically within this transaction.
        // SELECT FOR UPDATE inside redeemGiftCardTx prevents double-debit races.
        if (input.giftCardId && serverTotals.giftCardApplied > 0) {
          await redeemGiftCardTx(tx, {
            giftCardId: input.giftCardId,
            amount: serverTotals.giftCardApplied,
            orderId,
            invoiceId: invoice.id,
            branchId,
            processedBy: userId,
            tenantOrgId: tenantId,
            idempotencyKey: `${orderId}:redeem`,
          });
        } else if (input.giftCardNumber && serverTotals.giftCardApplied > 0) {
          // Legacy fallback — resolve card ID from code then delegate to redeemGiftCardTx
          const legacyCard = await tx.org_gift_cards_mst.findFirst({
            where: { tenant_org_id: tenantId, gift_card_code: input.giftCardNumber, is_active: true },
            select: { id: true },
          });
          if (legacyCard) {
            await redeemGiftCardTx(tx, {
              giftCardId: legacyCard.id,
              amount: serverTotals.giftCardApplied,
              orderId,
              invoiceId: invoice.id,
              branchId,
              processedBy: userId,
              tenantOrgId: tenantId,
              idempotencyKey: `${orderId}:redeem`,
            });
          }
        }

        return { orderId, orderNo, invoiceId: invoice.id, currentStatus: orderResult.order.currentStatus };
      })
    );

    // ── Transaction 2: write financial fact tables via settleOrder ─────────────

    // Look up org_payment_methods_cf rows for each method code
    const methodCodes = [...new Set(resolvedLegs.map((l) => l.method))];
    const methodRows = await prisma.org_payment_methods_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        payment_method_code: { in: methodCodes },
        is_active: true,
      },
    });

    // Build ResolvedSettlementLeg[] for each payment leg
    const settlementLegs: ResolvedSettlementLeg[] = resolvedLegs.map((leg) => {
      const row = methodRows.find((r) => r.payment_method_code === leg.method);
      if (!row) {
        throw new Error(`Payment method config not found for code: ${leg.method}`);
      }
      const settlementOption: SettlementOption = {
        id:                    row.id,
        paymentMethodCode:     row.payment_method_code,
        paymentNature:         row.payment_nature as SettlementOption['paymentNature'],
        gatewayCode:           row.gateway_code ?? null,
        displayName:           row.display_name,
        displayName2:          row.display_name2 ?? null,
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
      };
      return {
        settlementOption,
        amount:        leg.amount,
        cashTendered:  leg.cashTendered,
        // checkNumber/checkBank/checkDate stored on order; creditReferenceId N/A for standard payment legs
      };
    });

    // Build FinancialBreakdownSnapshot from server-computed totals
    const discountTotal = serverTotals.manualDiscount + serverTotals.autoRuleDiscount + serverTotals.promoDiscount;
    const taxTotal      = serverTotals.vatValue + (serverTotals.additionalTaxAmount ?? 0);
    const creditsTotal  = serverTotals.giftCardApplied;

    const taxLines: TaxLineItem[] = [];
    if (serverTotals.vatValue > 0) {
      taxLines.push({
        taxType:    TAX_TYPES.VAT,
        label:      'VAT',
        label2:     'ضريبة القيمة المضافة',
        rate:       serverTotals.vatTaxPercent,
        baseAmount: serverTotals.afterDiscounts,
        taxAmount:  serverTotals.vatValue,
      });
    }
    if ((serverTotals.additionalTaxAmount ?? 0) > 0) {
      taxLines.push({
        taxType:    TAX_TYPES.CUSTOM,
        label:      'Additional Tax',
        label2:     'ضريبة إضافية',
        rate:       input.additionalTaxRate ?? 0,
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
      creditsTotal,
      netReceivable:    serverTotals.finalTotal - creditsTotal,
      paymentLegsTotal: amountToCharge,
      changeReturned:   0,
      outstanding:      isInvoiceOnly
        ? serverTotals.finalTotal
        : Math.max(0, serverTotals.finalTotal - creditsTotal - amountToCharge),
      currencyCode:     serverTotals.currencyCode,
      decimalPlaces:    serverTotals.decimalPlaces,
    };

    // Map discount lines to the financial platform type
    const financialDiscountLines: FinancialDiscountLineInput[] = serverTotals.discountLines.map((d) => ({
      sourceType:     d.sourceType,
      sourceId:       d.sourceId ?? null,
      sourceName:     d.sourceName,
      sourceName2:    d.sourceName2 ?? null,
      discountType:   d.discountType,
      discountRate:   d.discountRate ?? null,
      discountAmount: d.discountAmount,
    }));

    // Write charges, taxes, discounts, payments to financial fact tables.
    // settleOrder also updates org_orders_mst snapshot and emits outbox events.
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
      })
    );

    // Canonical AR settlement for checkout payments: create payment rows,
    // anchor them to receipt vouchers, then allocate through the shared AR
    // ledger/history service so checkout and finance screens stay consistent.
    if (hasImmediatePayment && amountToCharge > 0) {
      const immediateLegs = resolvedLegs.filter((leg) => !DEFERRED_METHODS.has(leg.method));

      await withTenantContext(tenantId, async () =>
        prisma.$transaction(async (tx) => {
          for (const leg of immediateLegs) {
            const payment = await recordPaymentTransaction(
              {
                invoice_id: result.invoiceId,
                order_id: result.orderId,
                customer_id: input.customerId,
                paid_amount: leg.amount,
                payment_method_code: leg.method as PaymentMethodCode,
                payment_type_code: getPaymentTypeFromMethod(leg.method),
                paid_by: userId,
                branch_id: branchId,
                currency_code: serverTotals.currencyCode,
                currency_ex_rate: 1,
                check_number: leg.checkNumber,
                check_bank: leg.checkBank,
                check_date: leg.checkDate ? new Date(leg.checkDate) : undefined,
                rec_notes: input.paymentNotes,
                trans_desc: input.paymentNotes,
                payment_channel: 'web_admin_checkout',
              },
              tx
            );

            await allocateArPaymentTx(
              tx,
              result.invoiceId,
              {
                payment_id: payment.id,
                voucher_id: payment.voucher_id,
                allocated_amount: leg.amount,
                unapplied_credit_amount: 0,
                applied_at: new Date().toISOString(),
                notes: input.paymentNotes,
              },
              {
                tenantId,
                userId,
                userName,
              }
            );
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id:            result.orderId,
        orderId:       result.orderId,
        orderNo:       result.orderNo,
        currentStatus: result.currentStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create with payment failed';
    const isProductNotFound = message.startsWith('Product not found:');

    if (input.idempotencyKey) {
      const existing = await prisma.$queryRaw<{ id: string; order_no: string; current_status: string }[]>`
        SELECT id, order_no, current_status
        FROM org_orders_mst
        WHERE tenant_org_id = ${tenantId}::uuid
          AND idempotency_key = ${input.idempotencyKey}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            id:            existing[0].id,
            orderId:       existing[0].id,
            orderNo:       existing[0].order_no,
            currentStatus: existing[0].current_status,
          },
        });
      }
    }

    if (isProductNotFound) {
      const productId = message.replace('Product not found: ', '').trim();
      return NextResponse.json(
        {
          success: false,
          errorCode: 'PRODUCT_NOT_FOUND',
          error: 'One or more products could not be found. They may have been removed from the catalog. Please remove them from your order.',
          productId,
        },
        { status: 400 }
      );
    }

    logger.error('[create-with-payment] Error', error instanceof Error ? error : new Error(String(error)), {});
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
