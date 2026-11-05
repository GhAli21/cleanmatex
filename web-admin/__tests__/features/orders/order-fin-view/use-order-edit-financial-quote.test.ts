/**
 * P5-11 — the Edit live quote hook: no server call for an edit that changes no
 * money (EC-08), 500 ms debounce, superseded requests aborted, last confirmed
 * figures kept on refusal (PR-22).
 */
import { act, renderHook } from '@testing-library/react';

import { EDIT_QUOTE_DEBOUNCE_MS, useOrderEditFinancialQuote, type EditQuoteController } from '@/src/features/orders/order-fin-view/hooks/use-order-edit-financial-quote';

const VIEW = { header: { editOutcome: 'OUTSTANDING' } } as never;
const notes = [{ code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'x' } }];
const qty = [{ code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM' }, payload: { quantity: 2 } }];

function controller(ops: unknown[], quote: EditQuoteController['quote']): EditQuoteController {
  return { buildOperations: () => ops as never, quote };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useOrderEditFinancialQuote', () => {
  it('a notes-only edit never calls the server', () => {
    const quote = jest.fn();
    const { result } = renderHook(() => useOrderEditFinancialQuote({ controller: controller(notes, quote), orderId: 'o1', revision: 1, currentSpeed: 'STANDARD' }));
    act(() => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS * 2); });
    expect(quote).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('an order speed set to the same speed is not a money change', () => {
    const quote = jest.fn();
    const same = [{ code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'STANDARD' } }];
    renderHook(() => useOrderEditFinancialQuote({ controller: controller(same, quote), orderId: 'o1', revision: 1, currentSpeed: 'STANDARD' }));
    act(() => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS * 2); });
    expect(quote).not.toHaveBeenCalled();
  });

  it('debounces, sends only the latest draft, and reports ready', async () => {
    const quote = jest.fn().mockResolvedValue({ ok: true, status: 200, body: { success: true, data: { status: 'READY', view: VIEW } } });
    const c = controller(qty, quote);
    const { result, rerender } = renderHook(({ revision }) => useOrderEditFinancialQuote({ controller: c, orderId: 'o1', revision, currentSpeed: null, preset: 'detailed' }), { initialProps: { revision: 1 } });
    expect(result.current.status).toBe('pending');
    act(() => { jest.advanceTimersByTime(200); });
    rerender({ revision: 2 });
    act(() => { jest.advanceTimersByTime(200); });
    expect(quote).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS); });
    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote.mock.calls[0][1]).toMatchObject({ preset: 'detailed' });
    expect(result.current).toMatchObject({ status: 'ready', view: VIEW, previewStatus: 'READY', error: null });
  });

  it('a refusal keeps the last confirmed figures and its code; retry sends again', async () => {
    const quote = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, body: { success: true, data: { status: 'READY', view: VIEW } } })
      .mockResolvedValueOnce({ ok: false, status: 429, body: { success: false, error: { code: 'RATE_LIMITED' } } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: { success: true, data: { status: 'DENIED', view: VIEW } } });
    const c = controller(qty, quote);
    const { result, rerender } = renderHook(({ revision }) => useOrderEditFinancialQuote({ controller: c, orderId: 'o1', revision, currentSpeed: null }), { initialProps: { revision: 1 } });
    await act(async () => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS); });
    rerender({ revision: 2 });
    await act(async () => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS); });
    expect(result.current).toMatchObject({ status: 'error', view: VIEW, error: { code: 'RATE_LIMITED' } });
    act(() => { result.current.retry(); });
    await act(async () => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS); });
    expect(result.current.status).toBe('denied');
  });

  it('aborts the request a newer draft supersedes', async () => {
    let signal: AbortSignal | undefined;
    const quote = jest.fn((_id: string, o: { signal?: AbortSignal }) => { signal = o.signal; return new Promise<never>(() => {}); });
    const c = controller(qty, quote as never);
    const { rerender } = renderHook(({ revision }) => useOrderEditFinancialQuote({ controller: c, orderId: 'o1', revision, currentSpeed: null }), { initialProps: { revision: 1 } });
    await act(async () => { jest.advanceTimersByTime(EDIT_QUOTE_DEBOUNCE_MS); });
    rerender({ revision: 2 });
    expect(signal?.aborted).toBe(true);
  });
});
