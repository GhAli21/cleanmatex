/**
 * Storybook coverage for the denomination counter (quantity grid + running total).
 *
 * Exercises an empty grid, a pre-filled count, a 2-decimal currency, the disabled
 * state, and RTL. The component is controlled, so the stories wrap it in a small
 * stateful harness — typing a quantity updates the running total live. Denomination
 * values are in minor units, which is why no float math appears here.
 */

import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import {
  CmxDenominationCounter,
  type CmxDenominationOption,
} from '@ui/patterns/cmx-denomination-counter'

const OMR: CmxDenominationOption[] = [
  { id: 'n50', label: '50 OMR', valueMinor: 50_000 },
  { id: 'n20', label: '20 OMR', valueMinor: 20_000 },
  { id: 'n10', label: '10 OMR', valueMinor: 10_000 },
  { id: 'n5', label: '5 OMR', valueMinor: 5_000 },
  { id: 'n1', label: '1 OMR', valueMinor: 1_000 },
  { id: 'c500', label: '500 baisa', valueMinor: 500 },
  { id: 'c100', label: '100 baisa', valueMinor: 100 },
]

const AED: CmxDenominationOption[] = [
  { id: 'a200', label: '200 AED', valueMinor: 20_000 },
  { id: 'a100', label: '100 AED', valueMinor: 10_000 },
  { id: 'a50', label: '50 AED', valueMinor: 5_000 },
  { id: 'a10', label: '10 AED', valueMinor: 1_000 },
  { id: 'a1', label: '1 AED', valueMinor: 100 },
  { id: 'f50', label: '50 fils', valueMinor: 50 },
]

type HarnessProps = {
  denominations: CmxDenominationOption[]
  minorUnit: number
  currency: string
  initial?: Record<string, number>
  disabled?: boolean
  quantityLabel?: string
  totalLabel?: string
  locale?: string
}

function Harness({
  denominations,
  minorUnit,
  currency,
  initial = {},
  disabled,
  quantityLabel = 'Qty',
  totalLabel = 'Counted total',
  locale = 'en-US',
}: HarnessProps) {
  const [value, setValue] = useState<Record<string, number>>(initial)
  return (
    <CmxDenominationCounter
      denominations={denominations}
      value={value}
      onChange={setValue}
      minorUnit={minorUnit}
      formatTotal={(total) =>
        `${currency} ${total.toLocaleString(locale, {
          minimumFractionDigits: minorUnit,
          maximumFractionDigits: minorUnit,
        })}`
      }
      quantityLabel={quantityLabel}
      totalLabel={totalLabel}
      disabled={disabled}
    />
  )
}

const meta = {
  title: 'Patterns/CmxDenominationCounter',
  component: Harness,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Harness>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { denominations: OMR, minorUnit: 3, currency: 'OMR' },
}

/** 2×20 + 1×5 + 3×500 baisa = 46.500. */
export const Prefilled: Story = {
  args: { denominations: OMR, minorUnit: 3, currency: 'OMR', initial: { n20: 2, n5: 1, c500: 3 } },
}

export const TwoDecimalCurrency: Story = {
  args: { denominations: AED, minorUnit: 2, currency: 'AED', initial: { a100: 1, a10: 4, f50: 2 } },
}

export const Disabled: Story = {
  args: { denominations: OMR, minorUnit: 3, currency: 'OMR', initial: { n10: 5 }, disabled: true },
}

export const RTL: Story = {
  args: {
    denominations: OMR.map((d) => ({ ...d, label: d.label.replace('OMR', 'ر.ع.').replace('baisa', 'بيسة') })),
    minorUnit: 3,
    currency: 'ر.ع.',
    initial: { n20: 1, n1: 2 },
    quantityLabel: 'الكمية',
    totalLabel: 'إجمالي العدّ',
    locale: 'ar-OM',
  },
  decorators: [
    (Story) => (
      <div dir="rtl" className="max-w-md">
        <Story />
      </div>
    ),
  ],
}
