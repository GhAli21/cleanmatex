import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { CmxMoneyFieldController } from '@/src/ui/primitives/cmx-money-field-controller';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({
    currencyCode: 'OMR',
    decimalPlaces: 3,
    formatMoney: (v: number) => v.toFixed(3),
    formatMoneyWithCode: (v: number, dp: number) => `${v.toFixed(dp)} OMR`,
    roundMoney: (v: number) => v,
    refresh: jest.fn(),
    isReady: true,
  }),
}));

interface TestForm {
  amount: number;
}

function TestWrapper({
  onSubmit = jest.fn(),
  defaultAmount = 0,
}: {
  onSubmit?: jest.Mock;
  defaultAmount?: number;
}) {
  const { control, handleSubmit } = useForm<TestForm>({
    defaultValues: { amount: defaultAmount },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CmxMoneyFieldController name="amount" control={control} aria-label="amount" />
      <button type="submit">Submit</button>
    </form>
  );
}

describe('CmxMoneyFieldController', () => {
  it('renders inside a react-hook-form context', () => {
    render(<TestWrapper />);
    expect(screen.getByRole('textbox', { name: 'amount' })).toBeInTheDocument();
  });

  it('showZero is true by default — zero renders via formatMoneyWithCode', () => {
    // Controller passes formatMoneyWithCode as formatDisplayValue, so blurred zero
    // renders as "0.000 OMR" (not bare "0.000") — that is the correct behavior.
    render(<TestWrapper defaultAmount={0} />);
    const input = screen.getByRole('textbox', { name: 'amount' }) as HTMLInputElement;
    expect(input.value).toBe('0.000 OMR');
  });

  it('uses decimalPlaces from tenant currency context (3 decimals)', () => {
    render(<TestWrapper defaultAmount={10} />);
    const input = screen.getByRole('textbox', { name: 'amount' }) as HTMLInputElement;
    // blurred — shows full precision via formatMoneyWithCode
    expect(input.value).toBe('10.000 OMR');
  });

  it('reports numeric value to react-hook-form on change', async () => {
    const onSubmit = jest.fn();
    render(<TestWrapper onSubmit={onSubmit} defaultAmount={0} />);
    const input = screen.getByRole('textbox', { name: 'amount' });
    await act(async () => {
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '25.5' } });
      fireEvent.blur(input);
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25.5 }),
      expect.anything()
    );
  });

  it('decimalPlaces prop overrides tenant context value', () => {
    function OverrideForm() {
      const { control } = useForm<TestForm>({ defaultValues: { amount: 5 } });
      return (
        <CmxMoneyFieldController
          name="amount"
          control={control}
          decimalPlaces={2}
          aria-label="dp-override"
        />
      );
    }
    render(<OverrideForm />);
    const input = screen.getByRole('textbox', { name: 'dp-override' }) as HTMLInputElement;
    // Blurred initial state — formatMoneyWithCode(5, 2) = "5.00 OMR"
    expect(input.value).toBe('5.00 OMR');
  });
});
