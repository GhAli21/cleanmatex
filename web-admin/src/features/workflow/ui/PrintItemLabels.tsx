"use client";

import { useState } from 'react';
import type { OrderItem } from '@/types/order';

interface PrintItemLabelsProps {
  orderNo: string;
  items: OrderItem[];
}

export function PrintItemLabels({ orderNo, items }: PrintItemLabelsProps) {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handlePrint}
        className="inline-flex items-center justify-center rounded-md px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        Print Item Labels
      </button>

      {/* Printable area */}
      <div className="hidden print:block">
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="p-3 border border-gray-300 rounded">
              <div className="text-xs text-gray-600">{orderNo}</div>
              <div className="text-sm font-semibold text-gray-900">
                {(item.product_name || item.service_category_code || 'Item')}
              </div>
              {item.barcode && (
                <img src={item.barcode} alt="barcode" className="mt-2 w-full h-16 object-contain" />
              )}
              <div className="text-xs text-gray-600 mt-1">Qty: {item.quantity}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


