import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Prevent jest from loading tenant-currency-context (which imports next-intl ESM)
// via the @ui/primitives barrel → cmx-money-field-controller.
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import {
  CmxKeypad,
  resolveKeypadArrowIndex,
  resolveKeypadHomeIndex,
} from '@/src/ui/utilities/cmx-keypad';
import {
  KEYPAD_NUMERIC_3COL,
  KEYPAD_PAYMENT_4COL,
  KEYPAD_PIN_3COL,
} from '@/src/ui/utilities/cmx-keypad-presets';

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

  it('resolveKeypadHomeIndex prefers 7 then 1 (never backspace)', () => {
    const keys = [...KEYPAD_PAYMENT_4COL];
    const interactive = (i: number) => keys[i] !== '';
    expect(keys[resolveKeypadHomeIndex(keys, interactive)]).toBe('7');
    expect(resolveKeypadHomeIndex(['backspace', 'clear', '1'], () => true)).toBe(2);
  });

  it('resolveKeypadArrowIndex moves across the payment grid', () => {
    const keys = [...KEYPAD_PAYMENT_4COL];
    const interactive = () => true;
    // index of 7 is 8 (col 0) — right → 8, up → 4; left stays (edge).
    const seven = keys.indexOf('7');
    expect(keys[resolveKeypadArrowIndex(seven, 'ArrowRight', keys, 4, interactive)]).toBe('8');
    expect(keys[resolveKeypadArrowIndex(seven, 'ArrowUp', keys, 4, interactive)]).toBe('4');
    expect(resolveKeypadArrowIndex(seven, 'ArrowLeft', keys, 4, interactive)).toBe(seven);
  });

  it('keyboard navigation autofocuses the home key (7)', async () => {
    render(
      <CmxKeypad
        keys={KEYPAD_PAYMENT_4COL}
        columns={4}
        onKeyPress={jest.fn()}
        keyboardNavigation
        autoFocusHomeKey
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter 7' })).toHaveFocus();
    });
  });

  it('arrow keys move focus inside the keypad', () => {
    render(
      <CmxKeypad
        keys={KEYPAD_PAYMENT_4COL}
        columns={4}
        onKeyPress={jest.fn()}
        keyboardNavigation
        autoFocusHomeKey
      />
    );
    const seven = screen.getByRole('button', { name: 'Enter 7' });
    seven.focus();
    fireEvent.keyDown(seven.parentElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Enter 8' })).toHaveFocus();
  });
});
