import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    return t;
  },
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));

import { FxRoundingLine } from '@features/orders/payment/capabilities/fx-rounding/fx-rounding-line';

const baseProps = {
  exchangeRate: 1,
  roundingAmount: 0,
  moneyEpsilon: 0.0005,
  currencyCode: 'KWD',
  formatAmount: (n: number) => n.toFixed(3),
};

describe('FxRoundingLine', () => {
  it('renders nothing at base rate with no rounding', () => {
    const { container } = render(<FxRoundingLine {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the exchange-rate row when the rate is non-base', () => {
    render(<FxRoundingLine {...baseProps} exchangeRate={1.05} />);
    expect(screen.getByTestId('fx-rounding-line')).toBeInTheDocument();
    expect(screen.getByTestId('fx-rounding-rate')).toHaveTextContent('1.0500');
    expect(screen.queryByTestId('fx-rounding-adjustment')).not.toBeInTheDocument();
  });

  it('shows the rounding row when a rounding adjustment applies', () => {
    render(<FxRoundingLine {...baseProps} roundingAmount={-0.25} />);
    expect(screen.getByTestId('fx-rounding-adjustment')).toHaveTextContent('KWD -0.250');
    expect(screen.queryByTestId('fx-rounding-rate')).not.toBeInTheDocument();
  });

  it('shows both rows when rate and rounding are active, using formatRate', () => {
    render(
      <FxRoundingLine
        {...baseProps}
        exchangeRate={3.75}
        roundingAmount={0.01}
        formatRate={(n) => n.toFixed(2)}
      />,
    );
    expect(screen.getByTestId('fx-rounding-rate')).toHaveTextContent('3.75');
    expect(screen.getByTestId('fx-rounding-adjustment')).toHaveTextContent('KWD 0.010');
  });

  it('treats sub-epsilon rate/rounding as trivial and renders nothing', () => {
    const { container } = render(
      <FxRoundingLine {...baseProps} exchangeRate={1.0002} roundingAmount={0.0001} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
