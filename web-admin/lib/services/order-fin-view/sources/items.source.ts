import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Live item lines with their stored line money (Line-Level snapshot); removed lines have rec_status 0. */
export function loadOrderItems(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_items_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, rec_status: 1 },
      orderBy: [{ rec_order: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        product_id: true,
        product_name: true,
        product_name2: true,
        service_category_code: true,
        quantity: true,
        price_per_unit: true,
        total_price: true,
        service_pref_charge: true,
        speed_premium_amount: true,
        line_disc_amount: true,
        order_disc_alloc_amount: true,
        net_amount: true,
        tax_rate: true,
        taxable_amount: true,
        tax_amount: true,
        line_total_amount: true,
      },
    }),
  );
}
