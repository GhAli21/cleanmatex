import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Prevent jest from loading tenant-currency-context (which imports next-intl ESM)
// via the @ui/primitives barrel → cmx-money-field-controller.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import { CmxKeypad } from '@/src/ui/utilities/cmx-keypad';
import { KEYPAD_NUMERIC_3COL, KEYPAD_PIN_3COL } from '@/src/ui/utilities/cmx-keypad-presets';

describe('CmxKeypad', () => {
  it('renders all non-spacer keys as buttons', () => {
    render(
      <CmxKeypad keys={KEYPAD_NUMERIC_3COL} columns={3} onKeyPress={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Enter 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument();
  });

  it('renders empty string key as a spacer div, not a button', () => {
    const { container } = render(
      <CmxKeypad keys={KEYPAD_PIN_3COL} columns={3} onKeyPress={jest.fn()} />
    );
    const spacers = container.querySelectorAll('[aria-hidden="true"]');
    expect(spacers.length).toBe(1);
    // Total buttons = 9 digits + '.' + '0' + 'backspace' = 12 - 1 spacer
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(11);
  });

  it('calls onKeyPress when a key is clicked', () => {
    const onKeyPress = jest.fn();
    render(
      <CmxKeypad keys={KEYPAD_NUMERIC_3COL} columns={3} onKeyPress={onKeyPress} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enter 5' }));
    expect(onKeyPress).toHaveBeenCalledWith('5');
  });

  it('applies default aria-labels for special keys', () => {
    render(<CmxKeypad keys={['backspace', 'clear', '.']} columns={3} onKeyPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear amount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeInTheDocument();
  });

  it('respects ariaLabelMessages overrides', () => {
    render(
      <CmxKeypad
        keys={['backspace', 'clear']}
        columns={2}
        onKeyPress={jest.fn()}
        ariaLabelMessages={{ backspace: 'حذف آخر رقم', clear: 'مسح المبلغ' }}
      />
    );
    expect(screen.getByRole('button', { name: 'حذف آخر رقم' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مسح المبلغ' })).toBeInTheDocument();
  });

  it('disabled keys have aria-disabled', () => {
    render(
      <CmxKeypad
        keys={['1', '2']}
        columns={2}
        onKeyPress={jest.fn()}
        isKeyDisabled={(key) => key === '1'}
      />
    );
    const btn = screen.getByRole('button', { name: 'Enter 1' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Enter 2' })).not.toHaveAttribute('aria-disabled');
  });

  it('long press fires onKeyLongPress and NOT onKeyPress', () => {
    jest.useFakeTimers();
    const onKeyPress = jest.fn();
    const onKeyLongPress = jest.fn();
    render(
      <CmxKeypad
        keys={['backspace']}
        columns={1}
        onKeyPress={onKeyPress}
        onKeyLongPress={onKeyLongPress}
        longPressMs={600}
      />
    );
    const btn = screen.getByRole('button', { name: 'Delete last digit' });
    fireEvent.pointerDown(btn);
    jest.advanceTimersByTime(700);
    fireEvent.click(btn);
    expect(onKeyLongPress).toHaveBeenCalledWith('backspace');
    expect(onKeyPress).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('short tap fires onKeyPress and NOT onKeyLongPress', () => {
    jest.useFakeTimers();
    const onKeyPress = jest.fn();
    const onKeyLongPress = jest.fn();
    render(
      <CmxKeypad
        keys={['backspace']}
        columns={1}
        onKeyPress={onKeyPress}
        onKeyLongPress={onKeyLongPress}
        longPressMs={600}
      />
    );
    const btn = screen.getByRole('button', { name: 'Delete last digit' });
    fireEvent.pointerDown(btn);
    jest.advanceTimersByTime(100);
    fireEvent.pointerUp(btn);
    fireEvent.click(btn);
    expect(onKeyPress).toHaveBeenCalledWith('backspace');
    expect(onKeyLongPress).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('renders headerSlot above key grid', () => {
    render(
      <CmxKeypad
        keys={['1']}
        columns={1}
        onKeyPress={jest.fn()}
        headerSlot={<div data-testid="header">My Header</div>}
      />
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });
});
