import type { Metadata } from 'next';
import { HomeCollectionListScreen } from '@features/home-collection/ui/home-collection-list-screen';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';

export const metadata: Metadata = { title: 'Home Collection' };

export default function HomeCollectionPage() {
  return (
    <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>
      <HomeCollectionListScreen />
    </RequireAnyPermission>
  );
}
