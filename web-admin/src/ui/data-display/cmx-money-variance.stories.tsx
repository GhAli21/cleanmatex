/**
 * Storybook coverage for the signed cash variance indicator.
 *
 * Exercises the over / short / balanced tones, the tolerance band (a variance
 * inside tolerance reads as balanced), both sizes, and RTL with Arabic labels.
 * The component is presentation-only: amounts arrive pre-formatted.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxMoneyVariance } from '@ui/data-display/cmx-money-variance'

const EN_LABELS = { over: 'Over', short: 'Short', balanced: 'Balanced' }
const AR_LABELS = { over: 'زيادة', short: 'عجز', balanced: 'متوازن' }

const meta = {
  title: 'DataDisplay/CmxMoneyVariance',
  component: CmxMoneyVariance,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'lg'] },
  },
} satisfies Meta<typeof CmxMoneyVariance>

export default meta
type Story = StoryObj<typeof meta>

export const Over: Story = {
  args: { amount: 1.25, formattedAmount: 'OMR 1.250', labels: EN_LABELS },
}

export const Short: Story = {
  args: { amount: -0.75, formattedAmount: 'OMR 0.750', labels: EN_LABELS },
}

export const Balanced: Story = {
  args: { amount: 0, formattedAmount: 'OMR 0.000', labels: EN_LABELS },
}

/** A variance inside the tolerance band is shown as balanced — no sign, no amount. */
export const WithinTolerance: Story = {
  args: { amount: -0.004, formattedAmount: 'OMR 0.004', tolerance: 0.005, labels: EN_LABELS },
}

/** Just outside tolerance flips to short. */
export const JustOutsideTolerance: Story = {
  args: { amount: -0.006, formattedAmount: 'OMR 0.006', tolerance: 0.005, labels: EN_LABELS },
}

/** Standalone summary figure (close wizard result, session detail header). */
export const Large: Story = {
  args: { amount: 12.5, formattedAmount: 'OMR 12.500', size: 'lg', labels: EN_LABELS },
}

export const RTL: Story = {
  args: { amount: -3.5, formattedAmount: '3.500 ر.ع.', labels: AR_LABELS },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
}
