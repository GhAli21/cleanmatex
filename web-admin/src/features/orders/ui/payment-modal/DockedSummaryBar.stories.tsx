/**
 * Stories for `PaymentDockedSummaryBar` — the sub-`xl` footer strip that keeps
 * Final Total and Change visible beside the CTA while the receipt rail is a
 * slide-over (Phase 6 tablet layout). Variants: total only, with change, RTL.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { PaymentDockedSummaryBar } from './docked-summary-bar'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/PaymentModal/PaymentDockedSummaryBar',
  component: PaymentDockedSummaryBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    showChange: { control: 'boolean' },
    isRTL: { control: 'boolean' },
  },
  args: {
    finalTotalLabel: 'Final Total',
    finalTotalValue: 'OMR 50.000',
    changeLabel: 'Change',
    changeValue: 'OMR 12.500',
    showChange: false,
    isRTL: false,
  },
} satisfies Meta<typeof PaymentDockedSummaryBar>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Exact settlement: only the final total docks. */
export const TotalOnly: Story = {}

/** Cash over-tender: change docks beside the total in emerald. */
export const WithChange: Story = {
  args: { showChange: true },
}

// RTL variant — verifies Arabic layout direction
export const RTL: Story = {
  args: {
    showChange: true,
    finalTotalLabel: 'الإجمالي النهائي',
    changeLabel: 'الباقي',
    isRTL: true,
  },
}
