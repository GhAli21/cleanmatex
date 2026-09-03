'use client';

import { HomeCollectionOrderDetailScreen } from '@features/home-collection/ui/home-collection-order-detail-screen';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';

export default function HomeCollectionOrderPage() {
  return (
    <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>
      <HomeCollectionOrderDetailScreen />
    </RequireAnyPermission>
  );
}
