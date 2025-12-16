"use client";

import { useState } from 'react';
import type { OrderWithDetails } from '@/types/order';
import { PresetButtons } from './PresetButtons';
import { ItemList } from './ItemList';
import { PricePreview } from './PricePreview';
import { PrintItemLabels } from './PrintItemLabels';

interface FastItemizerProps {
  order: OrderWithDetails;
  productCatalog: Array<{ id: string; name: string; name2?: string; price: number; expressPrice?: number; serviceCategory: string; unit: string }>;
}

export function FastItemizer({ order, productCatalog }: FastItemizerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState(order.items || []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <PresetButtons
          productCatalog={productCatalog}
          onAddPreset={async (presetItems) => {
            setIsSubmitting(true);
            try {
              await fetch(`/api/v1/preparation/${order.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: presetItems }),
              }).then((r) => r.json()).then((res) => {
                if (res.success) setItems(res.data.items);
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
        />

        <ItemList orderId={order.id} items={items} onItemsChange={setItems} disabled={isSubmitting} />
      </div>

      <div className="space-y-4">
        <PricePreview orderId={order.id} />
        <PrintItemLabels orderNo={order.order_no} items={items as any} />
        <div className="flex gap-3">
          <button
            className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => { /* save draft no-op server side for now */ }}
          >
            Save Draft
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                // Complete preparation via transition API
                await fetch(`/api/v1/orders/${order.id}/transition`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    toStatus: 'processing',
                    notes: 'Preparation complete',
                  }),
                });
                // redirect back to order
                window.location.href = `/dashboard/orders/${order.id}`;
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            Complete & Continue
          </button>
        </div>
      </div>
    </div>
  );
}


