import type { Metadata } from 'next';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { DeliveryOrderDetailScreen } from '@features/delivery/ui/delivery-order-detail-screen';

/** Keeps individual delivery tasks distinguishable without exposing customer information. */
export const metadata: Metadata = { title: 'Delivery Order' };

/** Delivery floor detail — profile actions plus stage-owned complete. */
export default function DeliveryOrderPage() {
  return (
    <RequireAnyPermission permissions={['orders:read']}>
      <DeliveryOrderDetailScreen />
    </RequireAnyPermission>
  );
}
