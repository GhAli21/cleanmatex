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
import { CmxButton } from '@ui/primitives';
import { Table, TableBody, TableCell, TableRow } from '@ui/primitives/table';

/**
 *
 */
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

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.title
 * @param root0.description
 * @param root0.backToOrders
 * @param root0.returnUrl
 * @param root0.returnLabel
 * @param root0.debug
 */
export function OrderDetailError({
  orderId,
  title,
  description,
  backToOrders,
  returnUrl = '/dashboard/orders',
  returnLabel,
  debug,
}: OrderDetailErrorProps) {
  const [showDebug, setShowDebug] = useState(false);
  const hasDebug = debug && Object.values(debug).some((v) => v != null && v !== '');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-lg border border-warning-border bg-warning-bg p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-12 w-12 text-warning-text" aria-hidden />
          </div>
          <div className="flex-1 text-start">
            <h2 className="text-lg font-semibold text-warning-text">{title}</h2>
            <p className="mt-2 text-sm text-warning-text">{description}</p>
            {orderId && /^[0-9a-f-]{36}$/i.test(orderId) && (
              <p className="mt-2 text-xs text-warning-text font-mono">
                Order ID: {orderId}
              </p>
            )}

            {hasDebug && (
              <div className="mt-4">
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowDebug(!showDebug)}
                  className="h-auto px-0 py-0 flex items-center gap-1 text-xs font-medium text-warning-text hover:bg-transparent hover:text-warning-text/80"
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
                </CmxButton>
                {showDebug && (
                  <div className="mt-2 rounded border border-warning-border bg-warning-bg/50 p-3 font-mono text-xs text-warning-text">
                    <Table className="w-full text-start">
                      <TableBody>
                        {debug?.condition && (
                          <TableRow>
                            <TableCell className="py-1 pe-4 font-semibold">Condition:</TableCell>
                            <TableCell className="py-1">{debug.condition}</TableCell>
                          </TableRow>
                        )}
                        {debug?.serverError && (
                          <TableRow>
                            <TableCell className="py-1 pe-4 font-semibold">Server error:</TableCell>
                            <TableCell className="py-1">{debug.serverError}</TableCell>
                          </TableRow>
                        )}
                        {debug?.tenantId && (
                          <TableRow>
                            <TableCell className="py-1 pe-4 font-semibold">Tenant ID (used for query):</TableCell>
                            <TableCell className="py-1 break-all">{debug.tenantId}</TableCell>
                          </TableRow>
                        )}
                        {debug?.userId && (
                          <TableRow>
                            <TableCell className="py-1 pe-4 font-semibold">User ID:</TableCell>
                            <TableCell className="py-1 break-all">{debug.userId}</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell className="py-1 pe-4 font-semibold">Order ID (queried):</TableCell>
                          <TableCell className="py-1 break-all">{orderId || '(empty)'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <p className="mt-2 text-warning-text">
                      Possible causes: order deleted, tenant mismatch (order belongs to different tenant), database connection issue, or RLS policy blocking access.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <Link
                href={returnUrl}
                className="inline-flex items-center rounded-lg bg-warning px-4 py-2 text-sm font-medium text-warning-foreground hover:bg-warning/90"
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
