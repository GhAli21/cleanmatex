import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getOrder } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { PreparationForm } from './preparation-form';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';

interface PreparationPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function PreparationContent({ orderId }: { orderId: string }) {
  // Get authenticated user and tenant context
  const { tenantId } = await getAuthContext();

  // Fetch order with tenant context
  const result = await getOrder(tenantId, orderId);

  if (!result.success || !result.data) {
    notFound();
  }

  const order = result.data;

  // Check if order is in a valid state for preparation
  if (order.preparation_status === 'completed') {
    redirect(`/dashboard/orders/${orderId}`);
  }

  if (order.status !== 'intake' && order.status !== 'preparation') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <h2 className="text-lg font-semibold text-yellow-900">Cannot Prepare Order</h2>
          </div>
          <p className="text-yellow-800 mb-4">
            This order is in <span className="font-semibold">{order.status}</span> status and cannot be prepared.
            Preparation is only available for orders in &quot;intake&quot; or &quot;preparation&quot; status.
          </p>
          <Link
            href={`/dashboard/orders/${orderId}`}
            className="inline-flex items-center gap-2 text-yellow-700 hover:text-yellow-800 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Order Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/orders/${orderId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Order Details
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Prepare Order</h1>
          <p className="text-gray-600 mt-1">
            Add items for order <span className="font-semibold">{order.order_no}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Customer</div>
          <div className="text-lg font-semibold text-gray-900">
            {order.customer?.name || 'N/A'}
          </div>
        </div>
      </div>

      {/* Preparation Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Preparation Steps</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Count and inspect all items from the customer</li>
          <li>Take photos of items (especially those with stains or damage)</li>
          <li>Add each item below with accurate details</li>
          <li>Note any stains, damages, or special conditions</li>
          <li>Complete preparation when all items are added</li>
        </ol>
      </div>

      {/* Preparation Form */}
      <PreparationForm order={{ ...order, org_order_items_dtl: order.items || [] }} />
    </div>
  );
}

export default async function PreparationPage({ params }: PreparationPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <PreparationContent orderId={id} />
    </Suspense>
  );
}
