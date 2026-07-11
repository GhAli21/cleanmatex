/**
 * Stories for `PaymentModeToggle` — the Simple ⇄ Advanced segmented control in
 * the Payment Modal v4 header (single engine, two faces). Both segments are
 * always clickable (amended ADR — the cashier controls the view). Variants:
 * Simple selected, Full selected, and RTL.
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
    isRTL: { control: 'boolean' },
  },
  args: {
    mode: 'simple',
    onModeChange: () => {},
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

/** Full face selected by the cashier. */
export const FullSelected: Story = {
  args: { mode: 'full' },
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
