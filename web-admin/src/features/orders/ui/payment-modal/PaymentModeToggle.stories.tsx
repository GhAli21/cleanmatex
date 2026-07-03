/**
 * Stories for `PaymentModeToggle` — the Simple ⇄ Advanced segmented control in
 * the Payment Modal v4 header (Phase 4, single engine two faces). Variants:
 * Simple selected, Full selected, Simple locked by `needsAdvanced`, and RTL.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { PaymentModeToggle } from './payment-mode-toggle'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/PaymentModal/PaymentModeToggle',
  component: PaymentModeToggle,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    mode: { control: 'radio', options: ['simple', 'full'] },
    simpleDisabled: { control: 'boolean' },
    isRTL: { control: 'boolean' },
  },
  args: {
    mode: 'simple',
    onModeChange: () => {},
    simpleDisabled: false,
    simpleLabel: 'Simple',
    fullLabel: 'Advanced',
    groupLabel: 'Payment view',
    isRTL: false,
  },
} satisfies Meta<typeof PaymentModeToggle>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Default: modal opened on the Simple face. */
export const SimpleSelected: Story = {}

/** Full face selected manually or via auto-escalation. */
export const FullSelected: Story = {
  args: { mode: 'full' },
}

/** Escalated + locked: Simple is disabled while `needsAdvanced` holds. */
export const SimpleLocked: Story = {
  args: {
    mode: 'full',
    simpleDisabled: true,
    simpleDisabledReason:
      'Advanced options are in use — Simple mode is unavailable until they are cleared',
  },
}

/** RTL (Arabic) — segments reverse. */
export const RTL: Story = {
  args: {
    mode: 'simple',
    simpleLabel: 'بسيط',
    fullLabel: 'متقدم',
    groupLabel: 'طريقة عرض الدفع',
    isRTL: true,
  },
}
