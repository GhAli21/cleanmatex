import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Loyalty ledger rows for the order (earn, redeem, reversal); points, never money. */
export function loadOrderLoyalty(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_loyalty_txn_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        txn_type: true,
        points: true,
        points_before: true,
        points_after: true,
        earn_rate: true,
        unreversed_points: true,
        credit_app_id: true,
        idempotency_key: true,
        created_at: true,
      },
    }),
  );
}
