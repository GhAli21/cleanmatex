import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { DeliveryOrderDetailScreen } from '@features/delivery/ui/delivery-order-detail-screen';

/** Delivery floor detail — profile actions plus stage-owned complete. */
export default function DeliveryOrderPage() {
  return (
    <RequireAnyPermission permissions={['orders:read']}>
      <DeliveryOrderDetailScreen />
    </RequireAnyPermission>
  );
}
