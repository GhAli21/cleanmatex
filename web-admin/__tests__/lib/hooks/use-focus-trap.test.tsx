import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  useFocusTrap,
  isAllowedFocusOutside,
  getFocusableElements,
} from '@/lib/hooks/use-focus-trap';

function TrapHarness({ open }: { open: boolean }) {
  const ref = useFocusTrap(open, { returnFocus: true, autoFocus: true });
  return (
    <div ref={ref} role="dialog" aria-modal="true" data-testid="trap-root">
      <button type="button">First</button>
      <input aria-label="Middle" />
      <button type="button">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('autofocuses the first control and cycles Tab within the container', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);

    render(<TrapHarness open />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Middle')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();

    // Wrap to first — does not escape to Outside
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    expect(outside).not.toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();

    outside.remove();
  });

  it('allows focus in the keypad popover without pulling it back', () => {
    const container = document.createElement('div');
    const keypad = document.createElement('div');
    keypad.setAttribute('data-cmx-keypad-popover', 'true');
    const key = document.createElement('button');
    keypad.appendChild(key);
    document.body.append(container, keypad);

    expect(isAllowedFocusOutside(container, key)).toBe(true);
    keypad.remove();
    container.remove();
  });

  it('lists only enabled visible focusables', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>A</button>
      <button disabled>B</button>
      <button tabindex="-1">C</button>
      <input />
    `;
    document.body.appendChild(root);
    const list = getFocusableElements(root);
    expect(list.map((el) => el.tagName + (el.textContent || ''))).toEqual([
      'BUTTONA',
      'INPUT',
    ]);
    root.remove();
  });
});
