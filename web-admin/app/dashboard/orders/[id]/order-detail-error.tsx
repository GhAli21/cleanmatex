'use client';

/**
 * Order Detail Error State
 *
 * Displays an error message when order cannot be loaded (e.g. not found,
 * invalid ID) instead of showing a 404 page.
 */

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';

interface OrderDetailErrorProps {
  orderId: string;
  title: string;
  description: string;
  backToOrders: string;
  returnUrl?: string;
  returnLabel?: string;
}

export function OrderDetailError({
  orderId,
  title,
  description,
  backToOrders,
  returnUrl = '/dashboard/orders',
  returnLabel,
}: OrderDetailErrorProps) {
  const isRTL = useRTL();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex-shrink-0">
            <AlertCircle className="h-12 w-12 text-amber-600" aria-hidden />
          </div>
          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h2 className="text-lg font-semibold text-amber-900">{title}</h2>
            <p className="mt-2 text-sm text-amber-800">{description}</p>
            {orderId && /^[0-9a-f-]{36}$/i.test(orderId) && (
              <p className="mt-2 text-xs text-amber-700 font-mono">
                Order ID: {orderId}
              </p>
            )}
            <div className="mt-6">
              <Link
                href={returnUrl}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                {returnLabel ?? backToOrders}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
