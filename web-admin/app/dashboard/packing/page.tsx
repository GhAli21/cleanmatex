/**
 * Orders Packing Screen - Thin Route Shell
 * Renders the RBAC-gated Packing queue built on WorkflowQueueShell.
 */

import type { Metadata } from 'next';
import { PagePermissionDeniedFallback, RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { PackingListScreen } from '@features/packing/ui/packing-list-screen';

export const metadata: Metadata = { title: 'Orders Packing' };

export default function PackingPage() {
  return (
    <RequireAnyPermission
      permissions={[ORDERS_PERMISSIONS.READ]}
      fallback={<PagePermissionDeniedFallback />}
    >
      <PackingListScreen />
    </RequireAnyPermission>
  );
}
