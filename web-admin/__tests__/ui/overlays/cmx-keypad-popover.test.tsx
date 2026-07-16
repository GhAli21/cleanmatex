import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// The @ui barrels transitively pull next-intl (ESM) and the Supabase-backed
// auth/currency contexts. This component is purely presentational and takes
// labels as props, so we stub those infra modules to keep the import graph
// resolvable without a locale provider or live Supabase env.
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({}),
}));
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  }),
}));

import { CmxKeypadPopover } from '@/src/ui/overlays/cmx-keypad-popover';
import { KEYPAD_PAYMENT_4COL } from '@ui/utilities';

const STORAGE_KEY = 'test:keypad-pos';

/**
 * Mounts the popover with a real anchor element so first-open placement has a
 * rect to work from, and returns the press spy for assertions.
 */
function renderPopover(overrides: Partial<React.ComponentProps<typeof CmxKeypadPopover>> = {}) {
  const onKeyPress = jest.fn();
  const onClose = jest.fn();
  function Harness() {
    const anchorRef = React.useRef<HTMLButtonElement | null>(null);
    return (
      <>
        <button ref={anchorRef} type="button">
          anchor
        </button>
        <CmxKeypadPopover
          open
          onClose={onClose}
          anchorRef={anchorRef}
          storageKey={STORAGE_KEY}
          title="Keypad"
          dockLabel="Dock to bottom"
          closeLabel="Close keypad"
          keys={KEYPAD_PAYMENT_4COL}
          onKeyPress={onKeyPress}
          {...overrides}
        />
      </>
    );
  }
  render(<Harness />);
  return { onKeyPress, onClose };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('CmxKeypadPopover', () => {
  it('renders as a non-modal dialog when open', () => {
    renderPopover();
    const dialog = screen.getByRole('dialog', { name: 'Keypad' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'false');
  });

  it('does not render when closed', () => {
    renderPopover({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('forwards key presses from the wrapped keypad', () => {
    const { onKeyPress } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Enter 7' }));
    expect(onKeyPress).toHaveBeenCalledWith('7');
  });

  it('closes on Escape and restores focus to the anchor', () => {
    jest.useFakeTimers();
    const { onClose } = renderPopover();
    const anchor = screen.getByRole('button', { name: 'anchor' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.runAllTimers();
    expect(anchor).toHaveFocus();
    jest.useRealTimers();
  });

  it('maps hardware digits to onKeyPress while open', () => {
    const { onKeyPress } = renderPopover();
    fireEvent.keyDown(window, { key: '5', code: 'Digit5' });
    expect(onKeyPress).toHaveBeenCalledWith('5');
  });

  it('dismisses when pointer lands outside the pad and trigger', () => {
    const { onClose } = renderPopover();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when pointer lands on the trigger', () => {
    const { onClose } = renderPopover();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'anchor' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not dismiss when focus moves to a linked amount field', () => {
    const onClose = jest.fn();
    const linkedRef = React.createRef<HTMLInputElement>();
    function Harness() {
      const anchorRef = React.useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <button ref={anchorRef} type="button">
            anchor
          </button>
          <input ref={linkedRef} aria-label="linked-amount" />
          <CmxKeypadPopover
            open
            onClose={onClose}
            anchorRef={anchorRef}
            linkedFieldRefs={[linkedRef]}
            storageKey={STORAGE_KEY}
            title="Keypad"
            dockLabel="Dock to bottom"
            closeLabel="Close keypad"
            keys={KEYPAD_PAYMENT_4COL}
            onKeyPress={jest.fn()}
          />
        </>
      );
    }
    render(<Harness />);
    fireEvent.focusIn(screen.getByLabelText('linked-amount'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('autofocuses home key 7 when keyboard mode opens', async () => {
    renderPopover();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter 7' })).toHaveFocus();
    });
  });

  it('ArrowUp from the top row moves focus to Close; ArrowLeft to Dock', async () => {
    renderPopover();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter 7' })).toHaveFocus();
    });
    // Grid: 7 → 4 → 1 → Close (top edge)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Enter 7' }), {
      key: 'ArrowUp',
    });
    expect(screen.getByRole('button', { name: 'Enter 4' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Enter 4' }), {
      key: 'ArrowUp',
    });
    expect(screen.getByRole('button', { name: 'Enter 1' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Enter 1' }), {
      key: 'ArrowUp',
    });
    expect(screen.getByTestId('cmx-keypad-popover-close')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('cmx-keypad-popover-close'), {
      key: 'ArrowLeft',
    });
    expect(screen.getByTestId('cmx-keypad-popover-dock')).toHaveFocus();

    fireEvent.keyDown(screen.getByTestId('cmx-keypad-popover-dock'), {
      key: 'ArrowDown',
    });
    expect(screen.getByRole('button', { name: 'Enter 7' })).toHaveFocus();
  });

  it('closes via the close button', () => {
    const { onClose } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Close keypad' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists position to storage when docked', () => {
    renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Dock to bottom' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('restores a saved position on open and announces it', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: 120, top: 200 }));
    renderPopover({ restoredAnnouncement: 'Keypad restored where you left it' });
    expect(screen.getByText('Keypad restored where you left it')).toBeInTheDocument();
  });

  it('disables the keys when disabled', () => {
    renderPopover({ disabled: true });
    expect(screen.getByRole('button', { name: 'Enter 7' })).toBeDisabled();
  });
});
