import { NextRequest, NextResponse } from 'next/server';

import { CustomerAppAuthError } from '@/lib/services/customer-app-auth.service';
import {
  extractMobileBearerToken,
  resolveCustomerMobileSession,
} from '@/lib/services/customer-mobile-session.service';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { buildPublicApiLogContext } from '@/lib/utils/public-api-log-context';

/**
 * GET /api/v1/public/customer/receipts/[orderNo]
 * Returns the full bilingual VAT digital receipt payload for one customer-owned
 * order, including itemized lines, discounts, VAT, canonical balance status,
 * organization VAT/CR metadata, and a ZATCA/GCC QR payload string.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderNo: string }> },
) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_receipts_public_api',
    action: 'get_receipt_detail',
  });

  try {
    const { orderNo } = await context.params;
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const bearerToken = extractMobileBearerToken(request.headers.get('authorization'));
    if (!tenantId || !bearerToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and Bearer token are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken: bearerToken,
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();

    const [{ data: order, error: orderErr }, { data: tenant }] = await Promise.all([
      supabase
        .from('org_orders_mst')
        .select(
          `
          id,
          order_no,
          created_at,
          subtotal_amount,
          total_discount_amount,
          total_tax_amount,
          total_amount,
          total_paid_amount,
          currency_code,
          payment_status,
          total_items,
          org_branches_mst(name, name2),
          org_order_items_dtl(
            id,
            product_name,
            product_name2,
            quantity,
            price_per_unit,
            total_price
          )
        `,
        )
        .eq('tenant_org_id', session.tenantOrgId)
        .eq('customer_id', session.customerId)
        .eq('order_no', orderNo)
        .maybeSingle(),
      supabase
        .from('org_tenants_mst')
        .select('name, name2, tax_registration_no')
        .eq('id', session.tenantOrgId)
        .maybeSingle(),
    ]);

    if (orderErr) throw orderErr;
    if (!order) {
      return NextResponse.json(
        { success: false, errorCode: 'RECEIPT_NOT_FOUND', error: 'Receipt not found' },
        { status: 404 },
      );
    }

    const total = Number(order.total_amount ?? 0);
    const paid = Number(order.total_paid_amount ?? 0);
    const subtotal = Number(order.subtotal_amount ?? total);
    const discount = Number(order.total_discount_amount ?? 0);
    const tax = Number(order.total_tax_amount ?? 0);
    const outstanding = Math.max(0, Number((total - paid).toFixed(4)));
    const overpaid = Math.max(0, Number((paid - total).toFixed(4)));
    const balanceStatusCode =
      overpaid > 0 ? 'OVERPAID' : outstanding <= 0 ? 'SETTLED' : 'DUE';
    const branch = Array.isArray(order.org_branches_mst)
      ? order.org_branches_mst[0]
      : order.org_branches_mst;
    const rawItems = Array.isArray(order.org_order_items_dtl) ? order.org_order_items_dtl : [];

    const qrPayload = JSON.stringify({
      org: tenant?.name ?? '',
      vat: tenant?.tax_registration_no ?? null,
      orderNo: order.order_no,
      issuedAt: order.created_at,
      total: total.toFixed(3),
      tax: tax.toFixed(3),
      currency: order.currency_code ?? 'OMR',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: order.id,
          orderNo: order.order_no,
          issuedAtUtc: order.created_at,
          organizationName: tenant?.name ?? '',
          organizationName2: tenant?.name2 ?? null,
          vatNumber: (tenant?.tax_registration_no as string | null) ?? null,
          crNumber: null,
          branchName: (branch?.name as string | null) ?? null,
          branchName2: (branch?.name2 as string | null) ?? null,
          currencyCode: order.currency_code ?? 'OMR',
          subtotal,
          discountTotal: discount,
          afterDiscounts: Math.max(0, Number((subtotal - discount).toFixed(4))),
          taxTotal: tax,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          overpaidAmount: overpaid,
          balanceStatusCode,
          qrPayload,
          items: rawItems.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            name: String(item.product_name ?? 'Item'),
            name2: (item.product_name2 as string | null) ?? null,
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.price_per_unit ?? 0),
            lineTotal: Number(item.total_price ?? 0),
          })),
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
      'Public customer receipt detail GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json({ success: false, error: 'Failed to load receipt' }, { status: 500 });
  }
}
