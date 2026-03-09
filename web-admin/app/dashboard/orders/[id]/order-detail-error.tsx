'use client';

/**
 * Order Detail Error State
 *
 * Displays an error message when order cannot be loaded (e.g. not found,
 * invalid ID) instead of showing a 404 page.
 * Includes optional debug info to trace the error.
 */

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';

export interface OrderDetailErrorDebug {
  /** Error message from getOrder or server */
  serverError?: string;
  /** Tenant ID used for the query (from getAuthContext) */
  tenantId?: string;
  /** User ID (from getAuthContext) */
  userId?: string;
  /** Condition that triggered the error */
  condition?: string;
}

interface OrderDetailErrorProps {
  orderId: string;
  title: string;
  description: string;
  backToOrders: string;
  returnUrl?: string;
  returnLabel?: string;
  /** Optional debug info to help trace the error */
  debug?: OrderDetailErrorDebug;
}

export function OrderDetailError({
  orderId,
  title,
  description,
  backToOrders,
  returnUrl = '/dashboard/orders',
  returnLabel,
  debug,
}: OrderDetailErrorProps) {
  const isRTL = useRTL();
  const [showDebug, setShowDebug] = useState(false);
  const hasDebug = debug && Object.values(debug).some((v) => v != null && v !== '');

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

            {hasDebug && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDebug(!showDebug)}
                  className={`flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  {showDebug ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide debug info
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show debug info (to trace error)
                    </>
                  )}
                </button>
                {showDebug && (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-100/50 p-3 font-mono text-xs text-amber-900">
                    <table className="w-full text-left">
                      <tbody>
                        {debug?.condition && (
                          <tr>
                            <td className="py-1 pr-4 font-semibold">Condition:</td>
                            <td className="py-1">{debug.condition}</td>
                          </tr>
                        )}
                        {debug?.serverError && (
                          <tr>
                            <td className="py-1 pr-4 font-semibold">Server error:</td>
                            <td className="py-1">{debug.serverError}</td>
                          </tr>
                        )}
                        {debug?.tenantId && (
                          <tr>
                            <td className="py-1 pr-4 font-semibold">Tenant ID (used for query):</td>
                            <td className="py-1 break-all">{debug.tenantId}</td>
                          </tr>
                        )}
                        {debug?.userId && (
                          <tr>
                            <td className="py-1 pr-4 font-semibold">User ID:</td>
                            <td className="py-1 break-all">{debug.userId}</td>
                          </tr>
                        )}
                        <tr>
                          <td className="py-1 pr-4 font-semibold">Order ID (queried):</td>
                          <td className="py-1 break-all">{orderId || '(empty)'}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="mt-2 text-amber-700">
                      Possible causes: order deleted, tenant mismatch (order belongs to different tenant), database connection issue, or RLS policy blocking access.
                    </p>
                  </div>
                )}
              </div>
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
