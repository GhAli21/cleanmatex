/**
 * Orders Delivery Screen - Thin Route Shell
 * Renders the RBAC-gated Delivery dispatch console with Active Deliveries & Routes tabs.
 */

import type { Metadata } from 'next';
import { PagePermissionDeniedFallback, RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { DeliveryListScreen } from '@features/delivery/ui/delivery-list-screen';

export const metadata: Metadata = { title: 'Orders Delivery' };

export default function DeliveryPage() {
  return (
    <RequireAnyPermission
      permissions={[ORDERS_PERMISSIONS.READ]}
      fallback={<PagePermissionDeniedFallback />}
    >
      <DeliveryListScreen />
    </RequireAnyPermission>
  );
}
