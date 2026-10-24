import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { PaymentModalV4 } from '@features/orders/ui/payment-modal-v4';
import { fetchOrderPaymentQuote } from '@features/orders/api/payment-quote-api';
import type { PaymentQuoteData } from '@/lib/types/payment-quote';

const mockViewMount = jest.fn();
jest.mock('@features/orders/api/payment-quote-api', () => ({
  ...jest.requireActual('@features/orders/api/payment-quote-api'), fetchOrderPaymentQuote: jest.fn(),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'csrf', loading: false }) }));
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock('@ui/primitives', () => ({
  CmxButton: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
  CmxSpinner: () => <span>spinner</span>,
}));
jest.mock('@ui/feedback', () => ({
  CmxSummaryMessage: ({ items }: { items: string[] }) => <div>{items.join(' ')}</div>,
}));
jest.mock('@ui/overlays', () => {
  const Part = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { CmxDialog: Part, CmxDialogContent: Part, CmxDialogHeader: Part, CmxDialogTitle: Part, CmxDialogFooter: Part };
});
jest.mock('@features/orders/payment/primitives/payment-currency-config-gate', () => ({
  PaymentCurrencyConfigGate: ({ state }: { state: { status: string } }) => <div>{state.status}</div>,
}));
jest.mock('@features/orders/ui/payment-full-view', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { useWatch } = jest.requireActual<typeof import('react-hook-form')>('react-hook-form');
  const { usePaymentTotals } = jest.requireActual<typeof import('@features/orders/hooks/use-payment-totals')>('@features/orders/hooks/use-payment-totals');
  return {
    PaymentFullView: (props: import('@features/orders/hooks/use-payment-totals').UsePaymentTotalsParams & {
      form: import('react-hook-form').UseFormReturn<import('@features/orders/model/payment-form-schema').PaymentFormData>;
      initialMode: string;
    }) => {
      useEffect(() => { mockViewMount(); }, []);
      const amountDiscount = useWatch({ control: props.form.control, name: 'amountDiscount' });
      const totals = usePaymentTotals({ ...props, amountDiscount, percentDiscount: 0, decimalPlaces: 2,
        appliedGiftCard: null, appliedPromoCode: null, t: (key) => key });
      return <div>
        <span>{props.initialMode}:{totals.saleTotal}:{totals.totalsLoading ? 'pending' : 'ready'}</span>
        <button onClick={() => props.form.setValue('amountDiscount', 5)}>discount</button>
        <button onClick={() => props.form.setValue('amountDiscount', 0)}>remove discount</button>
      </div>;
    },
  };
});

const quote = (requestId: string, saleTotal = 100): PaymentQuoteData => ({
  requestId, currencyCode: 'SAR', decimalPlaces: 2, currencyExRate: 1,
  subtotal: saleTotal, manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0,
  afterDiscounts: saleTotal, additionalTaxAmount: 0, vatValue: 0, giftCardApplied: 0,
  saleTotal, vatTaxPercent: 0, taxBreakdown: [], taxProfileEntries: [],
  checkoutOptions: { paymentMethods: [], customerCredits: [] }, storedValueSummary: null,
});

describe('PaymentModalV4 opening and refresh integration', () => {
  beforeEach(() => {
    jest.mocked(fetchOrderPaymentQuote).mockReset(); mockViewMount.mockReset();
    if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'request' });
  });

  it.each(['simple', 'full'] as const)('initializes %s once, keeps the mounted form on edits, and refreshes once on item changes', async (mode) => {
    jest.mocked(fetchOrderPaymentQuote).mockImplementation(async (request) => quote(request.requestId, request.amountDiscount ? 95 : request.items[0].quantity * 100));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const props = { open: true, onClose: jest.fn(), onSubmit: jest.fn(), total: 100,
      items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
      tenantOrgId: 'tenant-1', userId: 'user-1', initialPaymentMode: mode };
    const tree = (items = props.items) => <QueryClientProvider client={client}><PaymentModalV4 {...props} items={items} /></QueryClientProvider>;
    const view = render(tree());
    await waitFor(() => expect(screen.getByText(`${mode}:100:ready`)).toBeInTheDocument());
    expect(fetchOrderPaymentQuote).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('discount'));
    expect(screen.getByText(`${mode}:100:pending`)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(`${mode}:95:ready`)).toBeInTheDocument());
    expect(fetchOrderPaymentQuote).toHaveBeenCalledTimes(2);
    view.rerender(tree([{ ...props.items[0], quantity: 2 }]));
    await waitFor(() => expect(fetchOrderPaymentQuote).toHaveBeenCalledTimes(3));
    await act(async () => { await Promise.resolve(); });
    expect(jest.mocked(fetchOrderPaymentQuote).mock.calls[2][0].amountDiscount).toBe(5);
    expect(mockViewMount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('remove discount'));
    await waitFor(() => expect(screen.getByText(`${mode}:200:ready`)).toBeInTheDocument());
    expect(fetchOrderPaymentQuote).toHaveBeenCalledTimes(4);
  });

  it('keeps Cancel active while initializing and explains empty orders without a request', async () => {
    jest.mocked(fetchOrderPaymentQuote).mockReturnValue(new Promise(() => {}));
    const client = new QueryClient(); const onClose = jest.fn();
    const props = { open: true, onClose, onSubmit: jest.fn(), total: 100,
      items: [{ productId: '11111111-1111-4111-8111-111111111111', quantity: 1 }], tenantOrgId: 'tenant', userId: 'user' };
    const view = render(<QueryClientProvider client={client}><PaymentModalV4 {...props} /></QueryClientProvider>);
    fireEvent.click(screen.getByText('cancel')); expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount(); jest.mocked(fetchOrderPaymentQuote).mockClear();
    render(<QueryClientProvider client={new QueryClient()}><PaymentModalV4 {...props} items={[]} /></QueryClientProvider>);
    expect(screen.getByText('addItems')).toBeInTheDocument();
    expect(fetchOrderPaymentQuote).not.toHaveBeenCalled();
  });
});
