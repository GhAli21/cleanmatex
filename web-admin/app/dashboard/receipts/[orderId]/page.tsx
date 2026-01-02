/**
 * Receipt Management Page
 * View and send receipts for an order
 * PRD-006: Digital Receipts
 */

'use client';

import { use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReceiptPreview } from '@/src/features/receipts/ui/receipt-preview';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { ArrowLeft, Receipt } from 'lucide-react';

export default function ReceiptPage() {
  const params = use(useParams());
  const router = useRouter();
  const orderId = params.orderId as string;

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

      <ReceiptPreview orderId={orderId} />
    </div>
  );
}

