import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/** Applied Order Edit changes, in change order. History only: never a second current total. */
export function loadOrderChanges(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_changes_mst.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { change_no: 'asc' },
      select: {
        id: true,
        change_no: true,
        actor_user_id: true,
        actor_name: true,
        change_reason: true,
        currency_code: true,
        financial_before: true,
        financial_after: true,
        commercial_delta: true,
        financial_outcome: true,
        applied_at: true,
      },
    }),
  );
}
