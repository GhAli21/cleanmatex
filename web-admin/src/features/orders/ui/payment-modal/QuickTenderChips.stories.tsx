import type { Meta, StoryObj } from '@storybook/nextjs'
import { PaymentQuickTenderChips } from './quick-tender-chips'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/PaymentModal/PaymentQuickTenderChips',
  component: PaymentQuickTenderChips,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    onSelect: () => {},
    disabled: false,
    items: [
      { id: 'exact', kind: 'exact', label: 'Exact' },
      { id: 'tender-40', kind: 'tender', tenderAmount: 40, label: '40.000' },
      { id: 'tender-45', kind: 'tender', tenderAmount: 45, label: '45.000' },
      { id: 'tender-50', kind: 'tender', tenderAmount: 50, label: '50.000' },
    ],
  },
} satisfies Meta<typeof PaymentQuickTenderChips>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Cash leg with remaining 37.500 OMR: Exact + round-ups + a flat note. */
export const CashChips: Story = {}

/** Non-cash legs only get the Exact (remaining-cap) chip. */
export const NonCashExactOnly: Story = {
  args: {
    items: [{ id: 'exact', kind: 'exact', label: 'Exact' }],
  },
}

/** Disabled while no leg is active or submit is busy. */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

/** RTL (Arabic): the page dir mirrors the row; labels stay tabular. */
export const RTL: Story = {
  args: {
    items: [
      { id: 'exact', kind: 'exact', label: 'المتبقي بالضبط' },
      { id: 'tender-40', kind: 'tender', tenderAmount: 40, label: '40.000' },
      { id: 'tender-50', kind: 'tender', tenderAmount: 50, label: '50.000' },
    ],
  },
  // Direction comes from the page's dir, as in the app.
  decorators: [(Story) => <div dir="rtl"><Story /></div>],
}
