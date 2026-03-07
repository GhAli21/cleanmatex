/**
 * Edit Order Page
 * PRD: Edit Order Feature - Phase 2 - Frontend UI
 *
 * This page loads an existing order for editing in the new order form.
 * Business logic: src/features/orders/, backend: lib/services/order-service.ts
 */

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NewOrderProvider } from '@features/orders/ui/context/new-order-context';
import { EditOrderScreen } from '@features/orders/ui/edit-order-screen';
import { useMessage } from '@ui/feedback';
import { useTranslations } from 'next-intl';

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Order Page
 * Loads order data and renders edit screen
 */
export default function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('orders.edit');
  const { showError, showErrorFrom } = useMessage();
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);

        // Fetch order data
        const response = await fetch(`/api/v1/orders/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Order not found');
            showError('Order not found');
            return;
          }
          throw new Error('Failed to load order');
        }

        const data = await response.json();

        if (!data.success || !data.data) {
          throw new Error('Invalid response format');
        }

        const order = data.data;

        // Check if order can be edited
        const editabilityResponse = await fetch(`/api/v1/orders/${id}/editability`);
        if (editabilityResponse.ok) {
          const editabilityData = await editabilityResponse.json();
          if (!editabilityData.success || !editabilityData.data?.canEdit) {
            const reason = editabilityData.data?.reason || 'Cannot edit this order';
            setError(reason);
            showError(reason);
            return;
          }
        }

        // Try to acquire lock
        const lockResponse = await fetch(`/api/v1/orders/${id}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!lockResponse.ok) {
          const lockData = await lockResponse.json();
          const lockError = lockData.error || 'Failed to lock order';
          setError(lockError);
          showError(lockError);
          return;
        }

        setOrderData(order);
      } catch (err) {
        console.error('Error loading order for edit:', err);
        showErrorFrom(err, { fallback: t('error') });
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();

    // Cleanup: release lock on unmount
    return () => {
      fetch(`/api/v1/orders/${id}/unlock`, { method: 'POST' }).catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [id, t, showError, showErrorFrom]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
          <button
            onClick={() => router.push('/dashboard/orders')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <NewOrderProvider>
      <EditOrderScreen orderId={id} initialOrderData={orderData} />
    </NewOrderProvider>
  );
}
