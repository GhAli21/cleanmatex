/**
 * Storybook coverage for the shared cash change-due row.
 *
 * Exercises the counter (`md`) and till (`lg`) scales, RTL mirroring, the
 * below-epsilon hidden case, and tenant decimal precision — the last of these
 * being the reason the component exists, since the copies it replaced had
 * drifted to a hardcoded 3-decimal format.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxChangeDueRow } from '@ui/data-display'

const EPSILON = 0.005

const meta = {
  title: 'DataDisplay/CmxChangeDueRow',
  component: CmxChangeDueRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CmxChangeDueRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Change due',
    amount: 4.71,
    formattedAmount: '4.710 OMR',
    epsilon: EPSILON,
  },
}

export const TillScale: Story = {
  args: {
    ...Default.args,
    size: 'lg',
  },
}

export const RTL: Story = {
  args: {
    label: 'الباقي للعميل',
    amount: 4.71,
    formattedAmount: '4.710 ر.ع.',
    epsilon: EPSILON,
    isRTL: true,
  },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
}

/** Two-decimal tenant — precision follows the caller's currency formatting. */
export const TwoDecimalCurrency: Story = {
  args: {
    label: 'Change due',
    amount: 4.75,
    formattedAmount: 'AED 4.75',
    epsilon: EPSILON,
  },
}

/** Below epsilon renders nothing at all, so exact payments stay uncluttered. */
export const NoChangeHidden: Story = {
  args: {
    label: 'Change due',
    amount: 0,
    formattedAmount: '0.000 OMR',
    epsilon: EPSILON,
  },
}
