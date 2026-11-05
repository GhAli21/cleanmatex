/**
 * P5 — OrderFinancialView, header, statement and the Edit live card.
 * Real EN catalog through next-intl's `createTranslator`; a missing key fails
 * the test (every label the view uses must exist).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { readFileSync } from 'fs';
import { join } from 'path';

// The real EN catalog, read from disk (locale JSON is never imported into code).
const catalog = (file: string) => JSON.parse(readFileSync(join(__dirname, '../../../../messages/en', file), 'utf8'));
const mockMessages = { orders: { finView: catalog('orders/finView.json'), detail: catalog('orders/detail.json') }, paymentConfig: catalog('paymentConfig.json') };

// next-intl ships ESM only; this translator formats {var} and en plurals, and fails on a missing key.
jest.mock('next-intl', () => {
  const format = (msg: string, values: Record<string, unknown> = {}): string => msg
    .replace(/\{(\w+), plural, ((?:[^{}]|\{[^{}]*\})*)\}/g, (_m, name: string, body: string) => {
      const n = Number(values[name]);
      const pick = (form: string) => new RegExp(`${form} \{([^{}]*)\}`).exec(body)?.[1];
      return (n === 1 ? pick('one') ?? pick('other') : pick('other')) ?.replace(/#/g, String(n)) ?? '';
    })
    .replace(/\{(\w+)\}/g, (_m, name: string) => String(values[name] ?? ''));
  const lookup = (path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), mockMessages);
  return {
    useLocale: () => 'en',
    useTranslations: (namespace?: string) => {
      const full = (key: string) => (namespace ? `${namespace}.${key}` : key);
      const t = (key: string, values?: Record<string, unknown>) => {
        const msg = lookup(full(key));
        if (typeof msg !== 'string') throw new Error(`Missing message: ${full(key)}`);
        return format(msg, values);
      };
      t.has = (key: string) => typeof lookup(full(key)) === 'string';
      return t;
    },
  };
});
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));
jest.mock('@/lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/orders/x' }));
const queryMock = jest.fn();
jest.mock('@/src/features/orders/order-fin-view/hooks/use-order-financial-view', () => ({
  useOrderFinancialView: (...a: unknown[]) => queryMock(...a),
}));

import type { OrderFinSnapshotInput, OrderFinSourceSet } from '@/lib/types/order-fin-view';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { assembleOrderFinancialView } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';
import { OrderFinancialView } from '@/src/features/orders/order-fin-view/ui/order-financial-view';
import { OrderEditFinancialCard } from '@/src/features/orders/order-fin-view/ui/order-edit-financial-card';
import type { OrderEditQuoteState } from '@/src/features/orders/order-fin-view/hooks/use-order-edit-financial-quote';

const NOW = '2026-10-31T10:00:00.000Z';
const snapshot: OrderFinSnapshotInput = {
  orderId: 'o1', orderNo: '10234', orderStatus: 'processing', currencyCode: 'OMR', currencyDecimals: 3, snapshotStatus: 'CURRENT',
  paymentStatus: 'PARTIALLY_PAID', settlementType: 'PAY_ON_COLLECTION', mismatchCount: 0,
  itemsBase: 10, extrasIncluded: 1, speedPremiumIncluded: null, charges: 1.5, discount: 0.5, tax: 0.475, rounding: 0,
  taxPricingMode: 'TAX_EXCLUSIVE', total: 11.475, paid: 8, credits: 1, refunded: 0, netCollected: 8, outstanding: 2.475,
  overpaid: 0, changeReturned: 0, receivable: 0, baseCurrency: null, engineVersion: 5, calculationHash: null, traceId: null,
};
const set: OrderFinSourceSet = {
  sourceKind: 'saved', snapshot, errors: {},
  facts: {
    payments: [
      { id: 'p1', amount: 5, state: 'normal', methodCode: 'CASH', label: { name: 'Cash', name2: 'نقدًا' } },
      { id: 'p2', amount: 3, state: 'normal', methodCode: 'CARD', label: { name: 'Card', name2: null }, ref: '••4821' },
      { id: 'p3', amount: 2, state: 'pending', methodCode: 'CARD', label: { name: 'Card', name2: null } },
    ],
    credits: [{ id: 'c1', amount: 1, state: 'normal', methodCode: 'GIFT_CARD' }],
    charges: [{ id: 'ch1', amount: 1.5, state: 'normal', label: { name: 'Delivery', name2: null } }, { id: 'ch2', amount: 0.3, state: 'voided', label: { name: 'Service', name2: null } }],
  },
};
const view = (preset: 'detailed' | 'full' | 'totals' = 'detailed') =>
  assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset }), NOW);

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockReturnValue({ data: undefined, isError: false, error: null, refetch: jest.fn() });
  window.localStorage.clear();
});

describe('OrderFinancialView', () => {
  it('reads like a statement: hero with its word, badges, rows, the total and the balance', () => {
    render(<OrderFinancialView source={{ kind: 'data', view: view() }} config={{ preset: 'detailed' }} />);
    const header = screen.getByRole('banner');
    expect(within(header).getAllByText('Due at collection').length).toBeGreaterThan(0);
    expect(within(header).getByText('Partially paid')).toBeTruthy();
    expect(within(header).getByText('Pay on collection')).toBeTruthy();
    expect(within(header).getByText('Reconciled')).toBeTruthy();
    expect(screen.getByText('Items & extras')).toBeTruthy();
    expect(screen.getByText('Order value')).toBeTruthy();
    expect(screen.getByText('Settlement')).toBeTruthy();
    // The pending card payment is shown, marked, and not counted.
    expect(screen.getByText('Pending · not counted')).toBeTruthy();
    expect(screen.getByText('1 pending')).toBeTruthy();
    expect(screen.getAllByText(/11\.475/).length).toBeGreaterThan(0);
  });

  it('expandable rows toggle with aria-expanded; Expand all opens every one', () => {
    render(<OrderFinancialView source={{ kind: 'data', view: view() }} config={{ preset: 'detailed' }} />);
    // `detailed` opens payments (expanded); a click closes it, Expand all opens it again.
    const payments = screen.getByRole('button', { name: /Payments/ });
    expect(payments.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(payments);
    expect(payments.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Pending · not counted')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByRole('button', { name: /Charges/ }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.queryAllByRole('button', { expanded: false })).toEqual([]);
  });

  it('a voided charge is struck and not in the amount sum; full shows empty sections as None', () => {
    render(<OrderFinancialView source={{ kind: 'data', view: view('full') }} config={{ preset: 'full' }} />);
    expect(screen.getByText('Voided · not counted')).toBeTruthy();
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  it('a draft carries the preview badge; a missing snapshot shows "unavailable", never zeros', () => {
    const { unmount } = render(
      <OrderFinancialView
        source={{ kind: 'draft', draft: {
          currencyCode: 'OMR', currencyDecimals: 3, settlementType: null,
          quote: { subtotal: 10, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0, vatValue: 0.5, additionalTaxAmount: 0, taxBreakdown: [], chargesTotal: 0, roundingAdjustmentAmount: 0, saleTotal: 10.5 },
          realPaymentEntries: [], customerCreditEntries: [], payNowAmount: 0, customerCreditAmount: 0, remainingBalance: 10.5,
          giftCardSettlementAmount: 0, displayChangeAmount: 0, unresolvedOverpaymentAmount: 0,
        } }}
        config={{ preset: 'detailed' }}
      />,
    );
    expect(screen.getByText('Preview — not yet saved')).toBeTruthy();
    unmount();
    const missing = assembleOrderFinancialView({ ...set, snapshot: null }, resolveOrderFinDisplayConfig({}), NOW);
    render(<OrderFinancialView source={{ kind: 'data', view: missing }} />);
    expect(screen.getByText('Financial data unavailable')).toBeTruthy();
  });

  it('a saved order loads through the query; an error offers Retry; loading shows a skeleton', () => {
    const refetch = jest.fn();
    queryMock.mockReturnValue({ data: undefined, isError: true, error: null, refetch });
    const { unmount } = render(<OrderFinancialView source={{ kind: 'order', orderId: 'o1' }} config={{ preset: 'detailed' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
    expect(queryMock.mock.calls[0][0]).toBe('o1');
    unmount();
    queryMock.mockReturnValue({ data: undefined, isError: false, error: null, refetch });
    render(<OrderFinancialView source={{ kind: 'order', orderId: 'o1' }} />);
    expect(screen.getByLabelText('Loading financial summary…').getAttribute('aria-busy')).toBe('true');
  });

  it('the preset switcher changes the preset and remembers it per route', () => {
    queryMock.mockImplementation((_id: string, request: { preset: string }) => ({ data: view(request.preset as 'detailed'), isError: false, error: null, refetch: jest.fn() }));
    render(<OrderFinancialView source={{ kind: 'order', orderId: 'o1' }} config={{ preset: 'detailed', presetSwitcher: ['detailed', 'full'] }} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Full' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Full' }));
    expect(queryMock.mock.calls.at(-1)[1]).toMatchObject({ preset: 'full' });
    expect(window.localStorage.getItem('cmx.orderFinView.preset:/dashboard/orders/x')).toBe('full');
  });

  it('a recalculating snapshot shows the warning bar and the Recalculating badge', () => {
    const stale = assembleOrderFinancialView({ ...set, snapshot: { ...snapshot, snapshotStatus: 'RECALCULATION_REQUIRED' } }, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    render(<OrderFinancialView source={{ kind: 'data', view: stale }} config={{ preset: 'detailed' }} />);
    expect(screen.getByText('Figures are being recalculated.')).toBeTruthy();
    expect(screen.getByText('Recalculating')).toBeTruthy();
  });
});

describe('OrderFinancialView lifecycle states (PR-09)', () => {
  it('a cancelled order shows the cancelled bar; an unknown currency is said, never guessed', () => {
    const cancelled = assembleOrderFinancialView({ ...set, snapshot: { ...snapshot, orderStatus: 'cancelled', currencyCode: null } }, resolveOrderFinDisplayConfig({ preset: 'detailed' }), NOW);
    render(<OrderFinancialView source={{ kind: 'data', view: cancelled }} config={{ preset: 'detailed' }} />);
    expect(screen.getByText('This order is cancelled. The figures show what was recorded.')).toBeTruthy();
    expect(screen.getAllByText('Currency unknown').length).toBeGreaterThan(0);
  });
});

describe('OrderEditFinancialCard', () => {
  const editView = assembleOrderFinancialView(
    { ...set, sourceKind: 'edit', edit: { originalTotal: 11.475, projectedTotal: 13.47, totalDelta: 1.995, outcome: 'OUTSTANDING' }, snapshot: { ...snapshot, total: 13.47, outstanding: 4.47 } },
    resolveOrderFinDisplayConfig({ preset: 'detailed' }, 'edit'), NOW,
  );
  const state = (over: Partial<OrderEditQuoteState>): OrderEditQuoteState => ({ status: 'ready', view: editView, previewStatus: 'READY', error: null, retry: jest.fn(), ...over });

  it('shows new total, was, difference, balance after the change and the outcome chip', () => {
    render(<OrderEditFinancialCard orderId="o1" quote={state({})} />);
    expect(screen.getByText('New total')).toBeTruthy();
    expect(screen.getByText('Was')).toBeTruthy();
    expect(screen.getByText('Balance after change')).toBeTruthy();
    expect(screen.getByText('To collect')).toBeTruthy();
    expect(screen.getAllByText(/13\.470/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.995/).length).toBeGreaterThan(0);
  });

  it('keeps the last figures while updating, and says why a quote failed with Try again', () => {
    const retry = jest.fn();
    const { rerender } = render(<OrderEditFinancialCard orderId="o1" quote={state({ status: 'pending' })} />);
    expect(screen.getByText('Updating…')).toBeTruthy();
    expect(screen.getByText('New total')).toBeTruthy();
    rerender(<OrderEditFinancialCard orderId="o1" quote={state({ status: 'error', error: { code: 'RATE_LIMITED' }, retry })} />);
    expect(screen.getByText('Too many requests. Wait a moment.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('with no money change it shows the saved order, and Details opens the full statement', () => {
    queryMock.mockReturnValue({ data: view('totals'), isError: false, error: null, refetch: jest.fn() });
    const { unmount } = render(<OrderEditFinancialCard orderId="o1" quote={state({ status: 'saved', view: null })} />);
    expect(screen.getByText('No money change')).toBeTruthy();
    unmount();
    render(<OrderEditFinancialCard orderId="o1" quote={state({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
