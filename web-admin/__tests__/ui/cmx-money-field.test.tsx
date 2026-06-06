import '@testing-library/jest-dom';
import * as React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';

// Prevent jest from loading next-intl ESM through the primitives barrel.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { CmxMoneyField } from '@/src/ui/primitives/cmx-money-field';

function renderField(props: Partial<React.ComponentProps<typeof CmxMoneyField>> & { onValueChange?: jest.Mock } = {}) {
  const onValueChange = props.onValueChange ?? jest.fn();
  const { rerender } = render(
    <CmxMoneyField
      value={props.value ?? null}
      decimalPlaces={props.decimalPlaces ?? 3}
      onValueChange={onValueChange}
      showZero={props.showZero}
      min={props.min}
      max={props.max}
      draftValue={props.draftValue}
      aria-label="amount"
    />
  );
  const input = screen.getByRole('textbox', { name: 'amount' }) as HTMLInputElement;
  return { input, onValueChange, rerender };
}

describe('CmxMoneyField', () => {
  it('renders empty when value is null', () => {
    const { input } = renderField({ value: null });
    expect(input.value).toBe('');
  });

  it('renders empty when value is 0 and showZero is false', () => {
    const { input } = renderField({ value: 0, showZero: false });
    expect(input.value).toBe('');
  });

  it('renders zero display when value is 0 and showZero is true', () => {
    const { input } = renderField({ value: 0, showZero: true });
    expect(input.value).toBe('0.000');
  });

  it('collapses leading zeros on change: 007 → 7', () => {
    const { input, onValueChange } = renderField({ value: null });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '007' } });
    expect(input.value).toBe('7');
    expect(onValueChange).toHaveBeenCalledWith(7, '7', true);
  });

  it('clamps value to max on change', () => {
    const { input, onValueChange } = renderField({ value: null, max: 100 });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    expect(onValueChange).toHaveBeenCalledWith(100, '100.000', true);
  });

  it('clamps value to max on blur when draft exceeds max', () => {
    // sanitizeMoneyDraft strips '-', so negative input is impossible via UI.
    // Test max clamping on blur instead (which is reachable).
    const { input, onValueChange } = renderField({ value: null, max: 10 });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenLastCalledWith(10, '10.000', true);
  });

  it('emits isComplete=false while draft ends with dot', () => {
    const { input, onValueChange } = renderField({ value: null });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.' } });
    expect(onValueChange).toHaveBeenCalledWith(12, '12.', false);
  });

  it('on blur normalizes to full precision', () => {
    const { input, onValueChange } = renderField({ value: null });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '10.5' } });
    fireEvent.blur(input);
    expect(onValueChange).toHaveBeenLastCalledWith(10.5, '10.500', true);
  });

  it('uses formatDisplayValue callback when blurred', () => {
    const formatDisplayValue = jest.fn().mockReturnValue('10.500 OMR');
    render(
      <CmxMoneyField
        value={10.5}
        decimalPlaces={3}
        onValueChange={jest.fn()}
        formatDisplayValue={formatDisplayValue}
        aria-label="display"
      />
    );
    const input = screen.getByRole('textbox', { name: 'display' }) as HTMLInputElement;
    expect(formatDisplayValue).toHaveBeenCalledWith(10.5, 3);
    expect(input.value).toBe('10.500 OMR');
  });

  it('accepts draftValue as initial draft', () => {
    const { input } = renderField({ value: 5, draftValue: '5' });
    expect(input.value).toBe('5');
  });
});
