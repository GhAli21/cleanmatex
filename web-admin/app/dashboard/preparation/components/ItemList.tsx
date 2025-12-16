"use client";

import { useState } from 'react';
import type { OrderItem } from '@/types/order';

interface ItemListProps {
  orderId: string;
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  disabled?: boolean;
}

export function ItemList({ orderId, items, onItemsChange, disabled }: ItemListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/v1/preparation/${orderId}/items/${id}`, { method: 'DELETE' });
      onItemsChange(items.filter((i) => i.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="border border-gray-200 rounded p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {item.product_name || item.service_category_code || 'Item'}
            </div>
            <div className="text-xs text-gray-500">{item.quantity} × {Number(item.price_per_unit).toFixed(3)} OMR</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-900">{Number(item.total_price).toFixed(3)} OMR</div>
            <button
              disabled={disabled || busyId === item.id}
              onClick={() => handleDelete(item.id)}
              className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


