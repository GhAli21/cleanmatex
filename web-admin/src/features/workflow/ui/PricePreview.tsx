"use client";

import { useEffect, useState } from 'react';

interface PricePreviewProps {
  orderId: string;
}

export function PricePreview({ orderId }: PricePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ subtotal: number; tax: number; total: number; total_items: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/preparation/${orderId}/preview`);
        const json = await res.json();
        if (mounted && json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  if (loading) {
    return <div className="border border-gray-200 rounded p-4">Calculating...</div>;
  }

  if (!data) return null;

  return (
    <div className="border border-gray-200 rounded p-4">
      <div className="flex justify-between text-sm">
        <span>Items</span>
        <span>{data.total_items}</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span>Subtotal</span>
        <span>{data.subtotal.toFixed(3)} OMR</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span>Tax</span>
        <span>{data.tax.toFixed(3)} OMR</span>
      </div>
      <div className="flex justify-between text-sm mt-2 font-semibold">
        <span>Total</span>
        <span>{data.total.toFixed(3)} OMR</span>
      </div>
    </div>
  );
}


