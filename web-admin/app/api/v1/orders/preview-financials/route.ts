import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService, SETTING_CODES } from '@/lib/services/tenant-settings.service';
import { calculateOrderTotals } from '@/lib/services/order-calculation.service';
import { checkCreditLimit } from '@/lib/services/credit-limit.service';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { previewPaymentRequestSchema } from '@/lib/validations/new-order-payment-schemas';

/**
 * Canonical Batch 0 preview endpoint.
 * Keeps the older /preview-payment route working while documenting the
 * long-term Order Fin contract explicitly.
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
      { success: false, error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const data = await calculateOrderTotals({
      tenantId,
      branchId: parsed.data.branchId,
      userId,
      items: parsed.data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        servicePrefCharge: item.servicePrefCharge ?? 0,
        packingPrefCharge: item.packingPrefCharge ?? 0,
      })),
      customerId: parsed.data.customerId,
      isExpress: parsed.data.isExpress ?? false,
      percentDiscount: parsed.data.percentDiscount ?? 0,
      amountDiscount: parsed.data.amountDiscount ?? 0,
      promoCode: parsed.data.promoCode,
      giftCardNumber: parsed.data.giftCardNumber,
      giftCardAmount: parsed.data.giftCardAmount,
      giftCardId: parsed.data.giftCardId,
    });

    let creditLimit: Awaited<ReturnType<typeof checkCreditLimit>> | undefined;
    let creditLimitMode: 'warn' | 'block' = 'block';
    if (parsed.data.customerId && data.saleTotal > 0) {
      try {
        creditLimit = await checkCreditLimit(parsed.data.customerId, data.saleTotal);
        if (creditLimit && creditLimit.creditLimit > 0) {
          const supabase = await createClient();
          const settingsService = createTenantSettingsService(supabase);
          const mode = await settingsService.getSettingValue(
            tenantId,
            SETTING_CODES.B2B_CREDIT_LIMIT_MODE,
            parsed.data.branchId ?? null,
            userId
          );
          creditLimitMode =
            typeof mode === 'string' && (mode === 'warn' || mode === 'block') ? mode : 'block';
        }
      } catch {
        // Non-fatal; preview still succeeds without this advisory block.
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        ...(creditLimit && creditLimit.creditLimit > 0 && {
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
    const message = error instanceof Error ? error.message : 'Calculation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
