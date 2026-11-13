import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 2 }),
}));
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import { PaymentLegDetailFields } from '@features/orders/payment/primitives/payment-leg-detail-fields';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

const cashLeg = { method: 'CASH', amount: 17.83, cashTendered: 20, legRef: 'ref-cash' } as PaymentLeg;

function renderFields(cashChangeAmount?: number) {
  render(
    <PaymentLegDetailFields
      leg={cashLeg}
      legIndex={0}
      option={undefined}
      updateLeg={jest.fn()}
      branchPaymentTerminals={[]}
      cardBrands={[]}
      creditMethodCodes={[]}
      showCashTenderedChange
      cashChangeAmount={cashChangeAmount}
      currencyCode="SAR"
      formatAmount={(value: number) => value.toFixed(2)}
    />,
  );
}

describe('PaymentLegDetailFields cash change', () => {
  it('shows the change the engine hands out after cash rounding', () => {
    renderFields(2.2);
    expect(screen.getByTestId('leg-cash-change')).toHaveTextContent('2.20');
  });

  it('falls back to tendered minus applied without an engine figure', () => {
    renderFields();
    expect(screen.getByTestId('leg-cash-change')).toHaveTextContent('2.17');
  });
});
