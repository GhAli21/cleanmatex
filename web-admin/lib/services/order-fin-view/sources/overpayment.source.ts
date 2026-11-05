import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** How the order's overpayment was resolved (refund, wallet, change…), oldest first. */
export function loadOrderOverpayment(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_fin_overpay_disp_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        resolution_code: true,
        amount: true,
        currency_code: true,
        target_ref: true,
        voucher_id: true,
        note_reason: true,
        created_at: true,
      },
    }),
  );
}
