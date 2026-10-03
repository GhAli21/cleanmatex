import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { buildCashChangeRows } from '@features/orders/model/cash-change-rows';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
    t.has = () => false;
    return t;
  },
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
jest.mock('@/lib/hooks/useLocale', () => ({ useLocale: () => 'en' }));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ currencyCode: 'OMR', decimalPlaces: 3 }),
}));

import { OrderReceiptPrint, type ReceiptPaymentLine } from '@features/orders/ui/order-receipt-print';

const order = {
  id: 'o1',
  orderNo: 'ORD-1',
  customer: { name: 'Test Customer', phone: '90000000' },
  rackLocation: null,
  readyBy: null,
  total: 10.003,
  items: [],
  paymentSummary: { paid: 10.003, remaining: 0 },
} as never;

const payment = (over: Partial<ReceiptPaymentLine> = {}): ReceiptPaymentLine => ({
  id: 'p1',
  payment_method_code: 'CASH',
  payment_method_name_snapshot: 'Cash',
  amount: 10.003,
  currency_code: 'OMR',
  tendered_amount: 20,
  change_returned_amount: 9.997,
  payment_status: 'COMPLETED',
  ...over,
});

describe('buildCashChangeRows', () => {
  it('derives the exact change, the rounding and what was handed out per currency', () => {
    const [row] = buildCashChangeRows([payment()], [{ currencyCode: 'OMR', adjustment: -0.003 }], 'OMR');
    expect(row.exactChange).toBeCloseTo(9.997, 6);
    expect(row.handedOut).toBeCloseTo(10, 6);
  });

  it('counts only payments in that currency, falling back to the tenant currency when a payment has none', () => {
    const rows = buildCashChangeRows(
      [payment({ currency_code: null }), payment({ id: 'p2', currency_code: 'USD', change_returned_amount: 5 })],
      [{ currencyCode: 'OMR', adjustment: 0.002 }],
      'OMR',
    );
    expect(rows[0].exactChange).toBeCloseTo(9.997, 6);
    expect(rows[0].handedOut).toBeCloseTo(9.995, 6);
  });

  it('is empty when no rounding applied', () => {
    expect(buildCashChangeRows([payment()], [], 'OMR')).toEqual([]);
  });
});

describe('OrderReceiptPrint — tender and change block', () => {
  it('prints each completed tender with the cash handed over and the change returned', () => {
    render(<OrderReceiptPrint order={order} layout="thermal" payments={[payment()]} />);
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('orders.detailFull.tenderedAmount')).toBeInTheDocument();
    expect(screen.getByText('orders.detailFull.changeReturned')).toBeInTheDocument();
  });

  it('prints the cash-change rounding rows (exact change, loss, handed out) when a rounding applied', () => {
    render(
      <OrderReceiptPrint
        order={order}
        layout="thermal"
        payments={[payment()]}
        cashChangeRounding={[{ currencyCode: 'OMR', adjustment: -0.003 }]}
      />,
    );
    expect(screen.getByText('orders.detailFull.exactChange')).toBeInTheDocument();
    expect(screen.getByText('orders.detailFull.roundingLoss')).toBeInTheDocument();
    expect(screen.getByText('orders.detailFull.handedOut')).toBeInTheDocument();
  });

  it('shows a rounding gain with its own label', () => {
    render(
      <OrderReceiptPrint
        order={order}
        layout="thermal"
        payments={[payment()]}
        cashChangeRounding={[{ currencyCode: 'OMR', adjustment: 0.002 }]}
      />,
    );
    expect(screen.getByText('orders.detailFull.roundingGain')).toBeInTheDocument();
  });

  it('leaves out a tender that is not completed, and the whole block when nothing was paid', () => {
    const { container } = render(
      <OrderReceiptPrint order={order} layout="thermal" payments={[payment({ payment_status: 'PENDING' })]} />,
    );
    expect(screen.queryByText('Cash')).toBeNull();
    expect(container.textContent).not.toContain('orders.detailFull.tenderedAmount');
  });

  it('prints exactly as before when no payments were loaded', () => {
    render(<OrderReceiptPrint order={order} layout="thermal" />);
    expect(screen.queryByText('orders.detailFull.changeReturned')).toBeNull();
  });
});
