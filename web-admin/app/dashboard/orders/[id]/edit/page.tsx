'use client';

import { use } from 'react';
import { EditOrderWorkspace } from '@features/orders/order-change/edit-order-workspace';

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Order loads the Change context and reviews through the governed workspace.
 * Commit stays on the Apply route and is not started from this screen.
 * @param root0
 * @param root0.params
 */
export default function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = use(params);
  return <EditOrderWorkspace orderId={id} />;
}
