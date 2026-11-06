/**
 * Receipt Management Page
 * View and send receipts for an order
 * PRD-006: Digital Receipts
 * B2B: Default delivery channel is email (formal PDF) when customer is B2B
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReceiptPreview } from '@/src/features/receipts/ui/receipt-preview';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCodeChip } from '@ui/data-display';
import { ArrowLeft, Receipt } from 'lucide-react';

/**
 *
 */
export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('receipts');
  const raw = params?.orderId;
  const orderId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : '';
  const [customerType, setCustomerType] = useState<string | undefined>();
  const [orderNo, setOrderNo] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/v1/orders/${orderId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setCustomerType(res.data.customer_type ?? undefined);
          setOrderNo(typeof res.data.order_no === 'string' ? res.data.order_no : null);
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
            {t('page.title')}
          </h1>
          {orderNo ? (
            <div className="mt-1">
              <CmxCodeChip code={orderNo} kind="order" label={t('page.orderLabel')} copyable={false} size="md" />
            </div>
          ) : null}
        </div>
      </div>

      <ReceiptPreview orderId={orderId} customerType={customerType} />
    </div>
  );
}

