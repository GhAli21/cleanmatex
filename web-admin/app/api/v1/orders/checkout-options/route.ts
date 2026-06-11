import { NextRequest, NextResponse } from 'next/server';
import { CREDIT_APPLICATION_TYPES, PAYMENT_NATURE } from '@/lib/constants/order-financial';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getAvailableStoredValueSummary } from '@/lib/services/order-credit-application.service';
import { listCheckoutEligiblePaymentMethodConfigs } from '@/lib/services/payment-config.service';

/**
 * Returns checkout-visible payment methods and customer-credit options for the current tenant and branch context.
 *
 * @param request Next.js route request with optional `branchId`, `amount`, and `customerId` query params.
 * @returns POS-ready payment options grouped for the payment modal method and customer-credit sections.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission('orders:create')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = auth;

  const branchId = request.nextUrl.searchParams.get('branchId') ?? undefined;
  const amount = Number(request.nextUrl.searchParams.get('amount') ?? '0');
  const customerId = request.nextUrl.searchParams.get('customerId') ?? undefined;

  try {
    const methods = await listCheckoutEligiblePaymentMethodConfigs({
      tenantId,
      amount,
      branchId,
    });

    const storedValueSummary = customerId
      ? await getAvailableStoredValueSummary(tenantId, customerId)
      : null;

    const allOptions = methods.map((method) => ({
      id: method.id,
      payment_method_code: method.payment_method_code,
      payment_nature: method.payment_nature,
      gateway_code: method.gateway_code,
      display_name: method.display_name,
      display_name2: method.display_name2,
      description: method.description,
      description2: method.description2,
      requires_cash_drawer: method.requires_cash_drawer,
      requires_terminal: method.requires_terminal,
      supports_overpayment: method.supports_overpayment,
      supports_change_return: method.supports_change_return,
      requires_reference: method.requires_reference,
      allowed_in_pos: method.allowed_in_pos,
      allowed_for_pay_now: method.allowed_for_pay_now,
      allowed_for_pay_on_collection: method.allowed_for_pay_on_collection,
      allowed_for_invoice_payment: method.allowed_for_invoice_payment,
      credit_application_type: method.credit_application_type,
      available_balance:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.WALLET ||
        method.payment_method_code === 'WALLET'
          ? storedValueSummary?.wallet.balance ?? 0
          : method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE ||
              method.payment_method_code === 'ADVANCE'
            ? storedValueSummary?.advance.balance ?? 0
            : method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT ||
                method.payment_method_code === 'CREDIT_NOTE'
              ? storedValueSummary?.creditNoteTotal ?? 0
              : null,
      requires_credit_reference_selection:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT ||
        method.payment_method_code === 'CREDIT_NOTE',
      display_order: method.display_order,
    }));

    const paymentMethods = allOptions.filter(
      (method) =>
        method.payment_nature === PAYMENT_NATURE.REAL_PAYMENT &&
        method.allowed_in_pos
    );

    const customerCredits = allOptions.filter((method) => {
      if (method.payment_nature !== PAYMENT_NATURE.CREDIT_APPLICATION) {
        return false;
      }
      if (!method.allowed_in_pos) {
        return false;
      }
      if (method.credit_application_type === CREDIT_APPLICATION_TYPES.GIFT_CARD) {
        return false;
      }
      return (method.available_balance ?? 0) > 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentMethods,
        customerCredits,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch checkout options';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
