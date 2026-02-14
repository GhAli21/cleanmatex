/**
 * Create Order With Payment API - Single transaction flow
 * Replaces sequential create order → create invoice → process payment.
 * On amount mismatch: returns AMOUNT_MISMATCH, creates nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { OrderService } from '@/lib/services/order-service';
import { calculateOrderTotals } from '@/lib/services/order-calculation.service';
import { createInvoice } from '@/lib/services/invoice-service';
import { recordPaymentTransaction } from '@/lib/services/payment-service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  createWithPaymentRequestSchema,
  type CreateWithPaymentRequest,
} from '@/lib/validations/new-order-payment-schemas';
import type { AmountMismatchDifferences } from '@/lib/types/payment';
import { PAYMENT_METHODS, getPaymentTypeFromMethod } from '@/lib/constants/order-types';

const TOLERANCE = 0.001;

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
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

  const body = await request.json().catch(() => null);
  const parsed = createWithPaymentRequestSchema.safeParse(body);
  if (!parsed.success) {
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

  try {
    const serverTotals = await calculateOrderTotals({
      tenantId,
      branchId: input.branchId,
      items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customerId: input.customerId,
      isExpress: input.express ?? false,
      percentDiscount: input.percentDiscount ?? 0,
      amountDiscount: input.amountDiscount ?? 0,
      promoCode: input.promoCode,
      promoCodeId: input.promoCodeId,
      giftCardNumber: input.giftCardNumber,
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

    const orderResult = await OrderService.createOrder({
      tenantId,
      userId,
      userName,
      customerId: input.customerId,
      branchId: input.branchId,
      orderTypeId: input.orderTypeId,
      items: input.items,
      isQuickDrop: input.isQuickDrop,
      quickDropQuantity: input.quickDropQuantity,
      express: input.express,
      customerNotes: input.customerNotes,
      readyByAt: input.readyByAt,
      paymentMethod: input.paymentMethod,
      totals: {
        subtotal: serverTotals.subtotal,
        discount: serverTotals.manualDiscount + serverTotals.promoDiscount,
        tax: serverTotals.taxAmount,
        total: serverTotals.finalTotal,
        vatRate: serverTotals.vatTaxPercent,
        vatAmount: serverTotals.vatValue,
      },
      discountRate: input.percentDiscount ?? 0,
      promoCodeId: input.promoCodeId,
      giftCardId: input.giftCardId,
      promoDiscountAmount: serverTotals.promoDiscount,
      giftCardDiscountAmount: serverTotals.giftCardApplied,
      paymentTypeCode: getPaymentTypeFromMethod(input.paymentMethod),
      currencyCode: serverTotals.currencyCode,
      useOldWfCodeOrNew: false,
    });

    if (!orderResult.success || !orderResult.order) {
      return NextResponse.json(
        {
          success: false,
          error: orderResult.error ?? 'Order creation failed',
        },
        { status: 500 }
      );
    }

    const orderId = orderResult.order.id;
    const orderNo = orderResult.order.orderNo;

    const isInvoiceOnly = input.paymentMethod === PAYMENT_METHODS.INVOICE || input.paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION;
    const hasImmediatePayment = !isInvoiceOnly && (
      input.paymentMethod === PAYMENT_METHODS.CASH ||
      input.paymentMethod === PAYMENT_METHODS.CARD ||
      input.paymentMethod === PAYMENT_METHODS.CHECK
    );

    await prisma.$transaction(async (tx) => {
      const invoice = await createInvoice(
        {
          order_id: orderId,
          subtotal: serverTotals.subtotal,
          discount: serverTotals.manualDiscount + serverTotals.promoDiscount,
          tax: serverTotals.vatValue,
          payment_method_code: input.paymentMethod,
        },
        tx
      );

      if (hasImmediatePayment && serverTotals.finalTotal > 0) {
        const paymentMethodCode = input.paymentMethod === PAYMENT_METHODS.CASH
          ? 'CASH'
          : input.paymentMethod === PAYMENT_METHODS.CARD
            ? 'CARD'
            : 'CHECK';

        await recordPaymentTransaction(
          {
            invoice_id: invoice.id,
            order_id: orderId,
            customer_id: input.customerId ?? undefined,
            paid_amount: serverTotals.finalTotal,
            payment_method_code: paymentMethodCode,
            payment_type_code: getPaymentTypeFromMethod(input.paymentMethod),
            paid_by: userId,
            branch_id: input.branchId,
            subtotal: serverTotals.subtotal,
            manual_discount_amount: serverTotals.manualDiscount,
            promo_discount_amount: serverTotals.promoDiscount,
            gift_card_applied_amount: serverTotals.giftCardApplied,
            vat_rate: serverTotals.vatTaxPercent,
            vat_amount: serverTotals.vatValue,
            currency_code: serverTotals.currencyCode,
            check_number: input.checkNumber,
            check_bank: input.checkBank,
            check_date: input.checkDate ? new Date(input.checkDate) : undefined,
            promo_code_id: input.promoCodeId,
            gift_card_id: input.giftCardId,
            metadata: {
              promo_code: input.promoCode,
              gift_card_number: input.giftCardNumber,
              gift_card_amount: input.giftCardAmount,
            },
            payment_channel: 'web_admin',
          },
          tx
        );

        await tx.org_invoice_mst.update({
          where: { id: invoice.id },
          data: {
            paid_amount: serverTotals.finalTotal,
            status: 'paid',
            paid_at: new Date(),
            paid_by: userId,
            payment_method_code: paymentMethodCode,
            updated_at: new Date(),
            updated_by: userId,
          },
        });

        await tx.org_orders_mst.update({
          where: { id: orderId },
          data: {
            paid_amount: serverTotals.finalTotal,
            payment_status: 'paid',
            paid_at: new Date(),
            paid_by: userId,
            updated_at: new Date(),
            updated_by: userId,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        orderId,
        orderNo,
        currentStatus: orderResult.order.currentStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Create with payment failed';
    const isProductNotFound = message.startsWith('Product not found:');

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

    console.error('[create-with-payment] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
