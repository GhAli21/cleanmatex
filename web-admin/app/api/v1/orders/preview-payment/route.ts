/**
 * Preview Payment API - Server-side order totals before DB
 * Used by payment modal to display server-calculated amounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createTenantSettingsService,
  SETTING_CODES,
} from '@/lib/services/tenant-settings.service';
import { quoteCheckout } from '@/lib/services/commercial/commercial-checkout.service';
import { checkoutQuoteErrorResponse } from '@/lib/api/commercial-http';
import { checkCreditLimit } from '@/lib/services/credit-limit.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { previewPaymentRequestSchema } from '@/lib/validations/new-order-payment-schemas';
import { assertOrderDiscountAllowed, assertPriceOverridesAllowed } from '@/lib/services/price-override-policy.service';
import { priceOverrideErrorResponse } from '@/lib/api/price-override-http';

/**
 * POST /api/v1/orders/preview-payment
 * Returns server-calculated totals for items + discounts + promo + gift card.
 * @param request
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
  const { tenantId, userId } = authCheck;

  const body = await request.json().catch(() => null);
  const parsed = previewPaymentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body',
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  // PF-01: a previewed override needs `pricing:override`, same as submit.
  try {
    await assertPriceOverridesAllowed(parsed.data.items, { requireReason: false });
    // Owner decision 2026-10-28: an order manual discount needs `orders:discount`.
    await assertOrderDiscountAllowed(parsed.data);
  } catch (error) {
    const priceOverrideResponse = priceOverrideErrorResponse(error);
    if (priceOverrideResponse) return priceOverrideResponse;
    throw error;
  }

  try {
    // P5-02: the same checkout quote as the payment quote and submit (server prices only).
    const { totals: data } = await quoteCheckout({
      tenantId,
      branchId: parsed.data.branchId,
      userId,
      items: parsed.data.items,
      orderServicePrefs: parsed.data.orderServicePrefs,
      customerId: parsed.data.customerId,
      serviceSpeed: parsed.data.serviceSpeed,
      percentDiscount: parsed.data.percentDiscount ?? 0,
      amountDiscount: parsed.data.amountDiscount ?? 0,
      serviceCategories: parsed.data.serviceCategories,
      taxProfileIds: parsed.data.taxProfileIds,
      promoCode: parsed.data.promoCode,
      giftCardNumber: parsed.data.giftCardNumber,
      giftCardAmount: parsed.data.giftCardAmount,
      giftCardId: parsed.data.giftCardId,
    });

    let creditLimit: Awaited<ReturnType<typeof checkCreditLimit>> | undefined;
    let creditLimitMode: 'warn' | 'block' = 'block';
    if (parsed.data.customerId && data.saleTotal > 0) {
      try {
        creditLimit = await checkCreditLimit(
          parsed.data.customerId,
          data.saleTotal,
        );
        if (creditLimit && creditLimit.creditLimit > 0) {
          const supabase = await createClient();
          const settingsService = createTenantSettingsService(supabase);
          const mode = await settingsService.getSettingValue(
            tenantId,
            SETTING_CODES.B2B_CREDIT_LIMIT_MODE,
            parsed.data.branchId ?? null,
            userId,
          );
          creditLimitMode =
            typeof mode === 'string' && (mode === 'warn' || mode === 'block')
              ? mode
              : 'block';
        }
      } catch {
        // Non-fatal; omit credit info
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        ...(creditLimit &&
          creditLimit.creditLimit > 0 && {
            creditLimit: {
              currentBalance: creditLimit.currentBalance,
              creditLimit: creditLimit.creditLimit,
              available: creditLimit.available,
              wouldExceed: creditLimit.wouldExceed,
              mode: creditLimitMode,
            },
          }),
      },
    });
  } catch (error) {
    const checkoutResponse = checkoutQuoteErrorResponse(error, { tenantId, route: 'preview_payment' });
    if (checkoutResponse) return checkoutResponse;

    const message = error instanceof Error ? error.message : 'Calculation failed';
    console.error('[preview-payment] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
