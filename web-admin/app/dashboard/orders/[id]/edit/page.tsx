'use client';

import { use } from 'react';
import { EditSharedWorkspace } from '@features/orders/order-change/edit-shared-workspace';

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Order uses the shared New Order workspace.
 * The Edit session owns review. This page does not submit a new order or call the legacy update.
 * @param root0
 * @param root0.params
 */
export default function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = use(params);
  return <EditSharedWorkspace orderId={id} />;
}
