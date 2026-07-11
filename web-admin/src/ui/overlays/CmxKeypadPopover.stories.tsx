/**
 * Stories for `CmxKeypadPopover` — the movable, non-modal keypad that opens
 * next to a numeric field. Because it is controlled (open state + anchor ref)
 * and portals to the body, each story wraps it in a small harness with a
 * trigger button so the drag / dock / restore behaviors can be exercised.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { CmxKeypadPopover } from './cmx-keypad-popover';
import { KEYPAD_PAYMENT_4COL, PAYMENT_KEY_VARIANT, PAYMENT_KEY_CLASS } from '@ui/utilities';

// ─── Harness ────────────────────────────────────────────────────────────────

interface HarnessProps {
  isRTL?: boolean;
  disabled?: boolean;
  storageKey?: string;
}

/** A trigger button + anchored popover with a live amount echo. */
function KeypadHarness({ isRTL = false, disabled = false, storageKey }: HarnessProps) {
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(true);
  const [amount, setAmount] = React.useState('0.000');

  const press = (key: string) => {
    setAmount((prev) => {
      const digits = prev.replace('.', '');
      if (key === 'clear') return '0.000';
      if (key === 'backspace') {
        const next = digits.slice(0, -1) || '0';
        return (parseInt(next, 10) / 1000).toFixed(3);
      }
      if (/^\d$/.test(key)) {
        const next = (digits + key).replace(/^0+/, '').slice(0, 8) || '0';
        return (parseInt(next, 10) / 1000).toFixed(3);
      }
      return prev;
    });
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ minHeight: 420, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          OMR {amount}
        </span>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            borderRadius: 10,
            border: '1.5px solid #0f766e',
            background: '#e3f1ef',
            color: '#0a5751',
            fontWeight: 700,
            padding: '9px 13px',
          }}
        >
          ⌨ Keypad
        </button>
      </div>

      <CmxKeypadPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        storageKey={storageKey}
        isRTL={isRTL}
        disabled={disabled}
        title="Keypad"
        echo={amount}
        dockLabel="Dock to bottom"
        closeLabel="Close keypad"
        hint="Drag to move · stays where you leave it"
        restoredAnnouncement="Keypad restored where you left it"
        keys={KEYPAD_PAYMENT_4COL}
        onKeyPress={press}
        onKeyLongPress={(key) => {
          if (key === 'backspace') press('clear');
        }}
        getKeyVariant={PAYMENT_KEY_VARIANT}
        getKeyClassName={PAYMENT_KEY_CLASS}
        renderKeyLabel={(key) => (key === 'backspace' ? '⌫' : key)}
      />
    </div>
  );
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Overlays/CmxKeypadPopover',
  component: CmxKeypadPopover,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof CmxKeypadPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Default LTR: opens anchored to the trigger; drag the header to move it. */
export const Default: Story = {
  render: () => <KeypadHarness storageKey="sb:keypad-ltr" />,
};

/** RTL: first-open placement mirrors toward the reading side. */
export const RTL: Story = {
  render: () => <KeypadHarness isRTL storageKey="sb:keypad-rtl" />,
};

/** Disabled: keys are inert (e.g. before a payment method is chosen). */
export const Disabled: Story = {
  render: () => <KeypadHarness disabled />,
};

/** No storageKey: position is not persisted between opens. */
export const Ephemeral: Story = {
  render: () => <KeypadHarness />,
};
