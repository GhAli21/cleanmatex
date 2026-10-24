import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

// Same infra stubs as the keypad-popover test: @ui/primitives transitively
// pulls next-intl (ESM) and the Supabase-backed currency context. This field
// pair is presentational RHF wiring, so both are stubbed out.
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) =>
    ({
      'rightRail.discounts': 'Discounts',
      'rightRail.discountsHelp':
        'Manual discounts reduce the order value before payment is finalized.',
      'manualDiscount.amount': 'SAR Discount',
      'manualDiscount.percent': '% Discount',
      'manualDiscount.amountPlaceholder': '0.000',
      'manualDiscount.percentPlaceholder': '0',
    })[key] ?? key,
}));
// The currency context calls a 'use server' action. In Jest that module would
// load the real server-action guard (next/server needs a fetch `Request`
// global that jsdom lacks); with no session it is never called, so stub it.
jest.mock('@/app/actions/tenant/get-currency-config', () => ({
  getCurrencyConfigOutcomeAction: jest.fn(),
}));
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  }),
}));

import { PaymentDiscountFields } from '@/src/features/orders/payment/primitives/payment-discount-fields';
import type { PaymentFormData } from '@/src/features/orders/model/payment-form-schema';

const TOTAL = 10;

/** Minimal RHF harness — only the two discount fields matter for this unit. */
function Harness({ total = TOTAL }: { total?: number }) {
  const { control, setValue, formState } = useForm<PaymentFormData>({
    defaultValues: {
      amountDiscount: 0,
      percentDiscount: 0,
    } as Partial<PaymentFormData>,
  });
  return (
    <PaymentDiscountFields
      control={control}
      setValue={setValue}
      errors={formState.errors}
      total={total}
      decimalPlaces={3}
      currencyCode="SAR"
    />
  );
}

describe('PaymentDiscountFields', () => {
  it('renders the resolved currency and % inputs with the discounts help copy', () => {
    render(<Harness />);
    expect(screen.getByTestId('payment-discount-amount')).toBeInTheDocument();
    expect(screen.getByTestId('payment-discount-percent')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manual discounts reduce the order value before payment is finalized.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('SAR Discount')).toBeInTheDocument();
  });

  it('syncs the currency field into the % field on blur', () => {
    render(<Harness />);
    const amountField = screen.getByTestId(
      'payment-discount-amount',
    ) as HTMLInputElement;
    fireEvent.focus(amountField);
    fireEvent.change(amountField, { target: { value: '2.500' } });
    fireEvent.blur(amountField);
    const percentField = screen.getByTestId(
      'payment-discount-percent',
    ) as HTMLInputElement;
    expect(percentField.value).toBe('25');
  });

  it('syncs the % field into the currency field on change', () => {
    render(<Harness />);
    const percentField = screen.getByTestId(
      'payment-discount-percent',
    ) as HTMLInputElement;
    fireEvent.change(percentField, { target: { value: '50' } });
    // Unfocused display goes through formatDecimalDraft, which trims trailing
    // zeros by design (same helper the Full-view field always used).
    const amountField = screen.getByTestId(
      'payment-discount-amount',
    ) as HTMLInputElement;
    expect(amountField.value).toBe('5');
  });

  it('clamps a currency discount above the order total instead of silently accepting it', () => {
    render(<Harness total={10} />);
    const amountField = screen.getByTestId(
      'payment-discount-amount',
    ) as HTMLInputElement;
    fireEvent.focus(amountField);
    fireEvent.change(amountField, { target: { value: '999' } });
    fireEvent.blur(amountField);
    expect(amountField.value).toBe('10');
    const percentField = screen.getByTestId(
      'payment-discount-percent',
    ) as HTMLInputElement;
    expect(percentField.value).toBe('100');
  });

  it('clamps a percent discount above 100', () => {
    render(<Harness />);
    const percentField = screen.getByTestId(
      'payment-discount-percent',
    ) as HTMLInputElement;
    fireEvent.change(percentField, { target: { value: '250' } });
    expect(percentField.value).toBe('100');
  });
});
