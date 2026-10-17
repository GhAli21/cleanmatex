'use client';

import { use } from 'react';
import { EditOrderPageGate } from '@features/orders/order-change/edit-order-page-gate';

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Order uses the shared New Order workspace.
 * The page gate claims a session started by an in-app Edit action before the workspace mounts.
 * @param root0
 * @param root0.params
 */
export default function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = use(params);
  return <EditOrderPageGate orderId={id} />;
}
