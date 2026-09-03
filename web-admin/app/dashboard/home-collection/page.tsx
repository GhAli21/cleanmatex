'use client';

import { HomeCollectionListScreen } from '@features/home-collection/ui/home-collection-list-screen';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';

export default function HomeCollectionPage() {
  return (
    <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>
      <div className="p-6">
        <HomeCollectionListScreen />
      </div>
    </RequireAnyPermission>
  );
}
