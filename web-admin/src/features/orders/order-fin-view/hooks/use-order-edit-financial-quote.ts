'use client';

/**
 * Order Edit live card quote (PLAN §6.4, P5-11, PR-22).
 *
 * - An edit that changes no money (notes, ready-by, priority: EC-08) never
 *   calls the server; the card shows the saved order.
 * - Otherwise: wait 500 ms after the last change, cancel any request still
 *   running, call the quote route. While it runs, the last confirmed figures
 *   stay on screen with `pending`; there is never a client-side estimate.
 * - A refusal keeps the last figures and reports why (`error` + `reason`);
 *   a 429 also keeps them ("Try again").
 */
import { useCallback, useEffect, useState } from 'react';

import { orderChangeNeedsPricing } from '@/lib/services/order-change/order-change-priced-ops';
import type { OrderFinancialView, OrderFinPreset } from '@/lib/types/order-fin-view';

/** Debounce before a quote is sent (PR-22). */
export const EDIT_QUOTE_DEBOUNCE_MS = 500;

/** The card's state; `view` is always the last figures the server confirmed. */
export interface OrderEditQuoteState {
  /** `saved`: nothing that changes money is pending, show the saved order. */
  status: 'saved' | 'pending' | 'ready' | 'denied' | 'error';
  /** The edit view of the last confirmed quote; null before the first one. */
  view: OrderFinancialView | null;
  /** The Edit preview status of that quote (`READY`, `DENIED`, …). */
  previewStatus: string | null;
  /** Error code (`orders.finView.errors.<code>`) and the engine's reason, when refused. */
  error: { code: string; reason?: string } | null;
  /** Re-sends the current draft now. */
  retry: () => void;
}

/** What the hook needs from the Edit controller. */
export interface EditQuoteController {
  buildOperations(): ReadonlyArray<{ code: string; target?: { kind: string }; payload?: unknown }>;
  quote(orderId: string, options: { preset?: string; signal?: AbortSignal }): Promise<{ ok: boolean; status: number; body: unknown }>;
}

/**
 * @param input - hook inputs
 * @param input.controller - the Edit controller (builds the operations, sends the quote)
 * @param input.orderId - order being edited
 * @param input.revision - an extra key for a fresh quote (the order's edit-state version); draft changes are tracked through the operations
 * @param input.currentSpeed - the order's stored speed (an order speed set to itself is not a change)
 * @param input.preset - preset of the returned view (`totals` for the card)
 * @returns the card state; scoped to the authenticated tenant by the route
 * @example const quote = useOrderEditFinancialQuote({ controller, orderId, revision, currentSpeed, preset: 'totals' });
 */
export function useOrderEditFinancialQuote(input: {
  controller: EditQuoteController;
  orderId: string;
  revision: number | string;
  currentSpeed: string | null;
  preset?: OrderFinPreset;
}): OrderEditQuoteState {
  const { controller, orderId, revision, currentSpeed, preset = 'totals' } = input;
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<{ key: string; view: OrderFinancialView | null; previewStatus: string | null; error: OrderEditQuoteState['error'] }>(
    { key: '', view: null, previewStatus: null, error: null },
  );
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const operations = controller.buildOperations();
  const needsQuote = operations.length > 0 && orderChangeNeedsPricing(operations, currentSpeed);
  // The operations themselves are part of the key: any draft change is a new quote.
  const key = `${orderId}|${revision}|${preset}|${nonce}|${JSON.stringify(operations)}`;

  useEffect(() => {
    if (!needsQuote) return undefined;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      controller.quote(orderId, { preset, signal: abort.signal })
        .then((res) => {
          if (abort.signal.aborted) return;
          const body = res.body as { success?: boolean; data?: { status: string; view: OrderFinancialView }; error?: { code?: string; reason?: string } } | null;
          if (res.ok && body?.success && body.data) {
            setSettled({ key, view: body.data.view, previewStatus: body.data.status, error: null });
            return;
          }
          // Keep the last confirmed figures; say why this one failed.
          setSettled((prev) => ({ ...prev, key, error: { code: body?.error?.code ?? 'INTERNAL_ERROR', reason: body?.error?.reason } }));
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setSettled((prev) => ({ ...prev, key, error: { code: 'INTERNAL_ERROR' } }));
        });
    }, EDIT_QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [controller, orderId, preset, key, needsQuote]);

  // Nothing that changes money: the saved order is the answer, no request.
  if (!needsQuote) return { status: 'saved', view: null, previewStatus: null, error: null, retry };
  const denied = settled.previewStatus === 'DENIED' || settled.view?.header.editOutcome === 'DENIED';
  const status: OrderEditQuoteState['status'] = settled.key !== key ? 'pending' : settled.error ? 'error' : denied ? 'denied' : 'ready';
  return { status, view: settled.view, previewStatus: settled.previewStatus, error: settled.key === key ? settled.error : null, retry };
}
