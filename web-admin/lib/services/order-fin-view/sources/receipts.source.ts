import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Receipts sent for the order (type, channel, delivery status); content columns are not loaded. */
export function loadOrderReceipts(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_rcpt_receipts_mst.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        receipt_type_code: true,
        delivery_channel_code: true,
        delivery_status_code: true,
        voucher_id: true,
        sent_at: true,
        delivered_at: true,
        created_at: true,
      },
    }),
  );
}
