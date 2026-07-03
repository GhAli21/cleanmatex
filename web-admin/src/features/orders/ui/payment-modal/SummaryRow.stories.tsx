/**
 * Stories for `SummaryRow` — the shared receipt line (label + tabular value)
 * used by the Full right rail, submit-confirm summary, and Simple receipt
 * card. Variants: default, bold total, negative, loading skeleton, Arabic.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { SummaryRow } from './summary-row'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/PaymentModal/SummaryRow',
  component: SummaryRow,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    loading: { control: 'boolean' },
    bold: { control: 'boolean' },
    negative: { control: 'boolean' },
  },
  args: {
    label: 'Order Total',
    value: 'OMR 50.000',
    loading: false,
    bold: false,
    negative: false,
  },
} satisfies Meta<typeof SummaryRow>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Plain receipt line. */
export const Default: Story = {}

/** Total-style row: bold with a top divider. */
export const BoldTotal: Story = {
  args: { label: 'Final Total', value: 'OMR 50.000', bold: true },
}

/** Negative amounts (discounts, remaining balance) render in rose. */
export const Negative: Story = {
  args: { label: 'Remaining Balance', value: 'OMR 12.500', negative: true },
}

/** Skeleton while server totals load. */
export const Loading: Story = {
  args: { loading: true },
}

/** Arabic labels — value stays tabular; layout is direction-agnostic. */
export const Arabic: Story = {
  args: { label: 'إجمالي الطلب', value: 'OMR 50.000' },
}
