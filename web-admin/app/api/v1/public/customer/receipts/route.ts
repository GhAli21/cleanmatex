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
 * GET /api/v1/public/customer/receipts
 * Lists customer-safe digital receipts for the authenticated customer within
 * the selected Organization, including canonical balance status words.
 */
export async function GET(request: NextRequest) {
  const baseContext = buildPublicApiLogContext(request, {
    feature: 'customer_receipts_public_api',
    action: 'list_receipts',
  });

  try {
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
    const { data: orders, error } = await supabase
      .from('org_orders_mst')
      .select(
        'id, order_no, created_at, total_amount, total_paid_amount, currency_code, payment_status, total_items, branch_id, org_branches_mst(name, name2)',
      )
      .eq('tenant_org_id', session.tenantOrgId)
      .eq('customer_id', session.customerId)
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw error;

    const receipts = (orders ?? []).map((row) => {
      const total = Number(row.total_amount ?? 0);
      const paid = Number(row.total_paid_amount ?? 0);
      const outstanding = Math.max(0, Number((total - paid).toFixed(4)));
      const overpaid = Math.max(0, Number((paid - total).toFixed(4)));
      const balanceStatusCode =
        overpaid > 0 ? 'OVERPAID' : outstanding <= 0 ? 'SETTLED' : 'DUE';
      const branch = Array.isArray(row.org_branches_mst)
        ? row.org_branches_mst[0]
        : row.org_branches_mst;

      return {
        orderId: row.id,
        orderNo: row.order_no,
        issuedAtUtc: row.created_at,
        itemCount: Number(row.total_items ?? 0),
        currencyCode: row.currency_code ?? 'OMR',
        totalAmount: total,
        paidAmount: paid,
        outstandingAmount: outstanding,
        overpaidAmount: overpaid,
        balanceStatusCode,
        branchName: (branch?.name as string | null) ?? null,
        branchName2: (branch?.name2 as string | null) ?? null,
      };
    });

    return NextResponse.json({ success: true, data: receipts }, { status: 200 });
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      return NextResponse.json(
        { success: false, errorCode: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required' },
        { status: 403 },
      );
    }
    logger.error(
      'Public customer receipts GET failed',
      error instanceof Error ? error : new Error(String(error)),
      baseContext,
    );
    return NextResponse.json({ success: false, error: 'Failed to load receipts' }, { status: 500 });
  }
}
