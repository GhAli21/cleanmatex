import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { checkoutQuoteErrorResponse } from '@/lib/api/commercial-http';
import { withTenantContext } from '@/lib/db/tenant-context';
import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import {
  quoteCheckout,
  type CheckoutQuote,
} from '@/lib/services/commercial/commercial-checkout.service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

const quotePieceSchema = z.object({
  pieceSeq: z.coerce.number().int().min(1),
  servicePreferenceIds: z.array(z.string().min(1).max(120)).optional().default([]),
  packingPrefCode: z.string().max(120).optional().nullable(),
});

const quoteItemSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(99),
  pieces: z.array(quotePieceSchema).optional(),
});

const bookingQuoteSchema = z.object({
  tenantId: z.string().uuid(),
  branchId: z.string().uuid(),
  serviceSpeed: z.string().trim().min(1).max(40).optional(),
  items: z.array(quoteItemSchema).min(1).max(100),
  servicePreferenceIds: z.array(z.string().min(1).max(120)).optional().default([]),
  pickupPreferenceIds: z.array(z.string().min(1).max(120)).optional().default([]),
  promoCode: z.string().trim().max(80).optional().nullable(),
  giftCardNumber: z.string().trim().max(80).optional().nullable(),
});

/**
 * POST /api/v1/public/customer/booking/quote
 * Live POS-parity server quote for the 6-step Detailed Order flow.
 * Calls the exact same `quoteCheckout()` commercial calculator, promo validator,
 * gift card validator, and tax engine used by POS New Order.
 */
export async function POST(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'public_customer_booking_quote',
    action: 'quote',
  });

  try {
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!bearerToken) {
      return NextResponse.json(
        { success: false, errorCode: 'missing_token', error: 'Bearer token is required' },
        { status: 401 },
      );
    }

    const parsed = bookingQuoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errorCode: 'quote_validation_failed',
          error: 'Quote payload is invalid',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json(
        { success: false, errorCode: 'unauthorized', error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: branch } = await supabase
      .from('org_branches_mst')
      .select('id, name, name2, timezone_code')
      .eq('tenant_org_id', body.tenantId)
      .eq('id', body.branchId)
      .eq('is_active', true)
      .eq('is_customer_app_enabled', true)
      .maybeSingle();

    if (!branch) {
      return NextResponse.json(
        { success: false, errorCode: 'BRANCH_NOT_ELIGIBLE', error: 'Selected branch is not available' },
        { status: 400 },
      );
    }

    const preferredPackingCode = body.pickupPreferenceIds[0] ?? null;

    let checkout: CheckoutQuote;
    try {
      checkout = await withTenantContext(body.tenantId, () =>
        quoteCheckout({
          tenantId: body.tenantId,
          branchId: branch.id,
          customerId: session.customerId,
          serviceSpeed: body.serviceSpeed,
          promoCode: body.promoCode?.trim() || undefined,
          giftCardNumber: body.giftCardNumber?.trim() || undefined,
          strictFinancialReads: true,
          items: body.items.map((item) => ({
            productId: item.itemId,
            quantity: item.qty,
            servicePrefs: body.servicePreferenceIds.map((code) => ({ preference_code: code })),
            packingPrefCode: preferredPackingCode,
            pieces: item.pieces?.map((piece) => ({
              servicePrefs: piece.servicePreferenceIds.map((code) => ({ preference_code: code })),
              packingPrefCode: piece.packingPrefCode ?? null,
            })),
          })),
        }),
      );
    } catch (error) {
      const mapped = checkoutQuoteErrorResponse(error, {
        tenantId: body.tenantId,
        route: 'public_customer_booking_quote',
      });
      if (mapped) return mapped;
      throw error;
    }

    const branchTimeZone = await resolveOperationalTimeZone(
      body.tenantId,
      'ready_by',
      branch.id,
    );

    const totals = checkout.totals;
    const totalDiscounts =
      (totals.manualDiscount ?? 0) +
      (totals.autoRuleDiscount ?? 0) +
      (totals.promoDiscount ?? 0);
    const giftCardApplied = totals.giftCardApplied ?? 0;
    const orderTotal = totals.saleTotal;
    const balanceDue = Math.max(0, Number((orderTotal - giftCardApplied).toFixed(4)));
    const taxTotal = totals.taxBreakdown.reduce((sum, row) => sum + row.taxAmount, 0);

    // Group into the exact 3 POS New Order breakdown sections (`OrderValueBreakdownPanel`).
    const grossRows = [
      { id: 'items_subtotal', labelKey: 'booking.review.itemsSubtotal', amount: totals.subtotal },
      ...(totals.chargesTotal > 0
        ? [{ id: 'charges_total', labelKey: 'booking.review.additionalCharges', amount: totals.chargesTotal }]
        : []),
    ];

    const discountRows = [
      ...(totals.autoRuleDiscount > 0
        ? [{ id: 'rule_discount', labelKey: 'booking.review.ruleDiscount', amount: totals.autoRuleDiscount }]
        : []),
      ...(totals.promoDiscount > 0
        ? [{ id: 'promo_discount', labelKey: 'booking.review.promoDiscount', amount: totals.promoDiscount }]
        : []),
      ...(totals.manualDiscount > 0
        ? [{ id: 'manual_discount', labelKey: 'booking.review.manualDiscount', amount: totals.manualDiscount }]
        : []),
    ];

    const taxRows = totals.taxBreakdown.map((taxLine, idx) => ({
      id: `tax_${idx}`,
      label: taxLine.label || taxLine.taxType,
      rate: taxLine.rate,
      amount: taxLine.taxAmount,
    }));

    const speedUpper = (body.serviceSpeed ?? 'STANDARD').toUpperCase();
    const estimatedHours =
      speedUpper === 'SAME_DAY' ? 6 : speedUpper === 'EXPRESS' ? 18 : 36;
    const estimatedReadyByUtc = new Date(
      Date.now() + estimatedHours * 60 * 60 * 1000,
    ).toISOString();

    return NextResponse.json(
      {
        success: true,
        data: {
          currencyCode: totals.currencyCode,
          grossRows,
          discountRows,
          taxRows,
          subtotal: totals.subtotal,
          discountTotal: totalDiscounts,
          afterDiscounts: totals.afterDiscounts,
          taxTotal,
          roundingAdjustment: totals.roundingAdjustmentAmount ?? 0,
          orderTotal,
          giftCardApplied,
          balanceDue,
          balanceStatusCode: balanceDue <= 0 ? 'SETTLED' : 'DUE_AT_COLLECTION',
          promoApplied: Boolean(checkout.promotionId),
          promoNotice: checkout.promoNotice ?? null,
          estimatedReadyByUtc,
          branchTimeZone: branchTimeZone ?? branch.timezone_code ?? null,
          readyByMayVaryHint: true,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer booking quote failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json(
      { success: false, errorCode: 'quote_failed', error: 'Failed to calculate quote' },
      { status: 500 },
    );
  }
}
