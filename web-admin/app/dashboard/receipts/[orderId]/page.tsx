/**
 * Receipt Management Page
 * View and send receipts for an order
 * PRD-006: Digital Receipts
 * B2B: Default delivery channel is email (formal PDF) when customer is B2B
 */

'use client';

import { use, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReceiptPreview } from '@/src/features/receipts/ui/receipt-preview';
import { CmxButton } from '@ui/primitives/cmx-button';
import { ArrowLeft, Receipt } from 'lucide-react';

export default function ReceiptPage() {
  const params = use(useParams());
  const router = useRouter();
  const orderId = params.orderId as string;
  const [customerType, setCustomerType] = useState<string | undefined>();

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/v1/orders/${orderId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.customer_type) {
          setCustomerType(res.data.customer_type);
        }
      })
      .catch(() => {});
  }, [orderId]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-4">
        <CmxButton
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </CmxButton>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="h-8 w-8" />
            Receipts
          </h1>
          <p className="text-gray-600 mt-1">Order: {orderId}</p>
        </div>
      </div>

      <ReceiptPreview orderId={orderId} customerType={customerType} />
    </div>
  );
}

