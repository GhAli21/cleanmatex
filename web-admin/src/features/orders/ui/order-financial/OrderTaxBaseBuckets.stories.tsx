import type { Meta, StoryObj } from '@storybook/nextjs'
import { OrderTaxBaseBuckets } from './order-tax-base-buckets'

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Features/Orders/Financial/OrderTaxBaseBuckets',
  component: OrderTaxBaseBuckets,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    currencyCode: { control: 'text' },
    pricingMode: {
      control: 'select',
      options: [undefined, 'TAX_EXCLUSIVE', 'TAX_INCLUSIVE'],
    },
  },
  args: {
    currencyCode: 'OMR',
    pricingMode: 'TAX_EXCLUSIVE',
    amounts: {
      taxableAmount: 100,
      nonTaxableAmount: 0,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      outOfScopeAmount: 0,
    },
  },
} satisfies Meta<typeof OrderTaxBaseBuckets>

export default meta
type Story = StoryObj<typeof meta>

// ─── Stories ──────────────────────────────────────────────────────────────────

export const TaxableOnly: Story = {
  args: {
    amounts: {
      taxableAmount: 100,
      nonTaxableAmount: 0,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      outOfScopeAmount: 0,
    },
    pricingMode: 'TAX_EXCLUSIVE',
  },
}

export const AllBuckets: Story = {
  args: {
    amounts: {
      taxableAmount: 60,
      nonTaxableAmount: 15,
      exemptAmount: 10,
      zeroRatedAmount: 10,
      outOfScopeAmount: 5,
    },
    pricingMode: 'TAX_EXCLUSIVE',
  },
}

export const TaxInclusive: Story = {
  args: {
    amounts: {
      taxableAmount: 100,
      nonTaxableAmount: 0,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      outOfScopeAmount: 0,
    },
    pricingMode: 'TAX_INCLUSIVE',
  },
}

export const NoPricingMode: Story = {
  args: {
    amounts: {
      taxableAmount: 85,
      nonTaxableAmount: 15,
      exemptAmount: 0,
      zeroRatedAmount: 0,
      outOfScopeAmount: 0,
    },
    pricingMode: undefined,
  },
}

export const RTL: Story = {
  name: 'RTL (Arabic)',
  args: {
    amounts: {
      taxableAmount: 100,
      nonTaxableAmount: 20,
      exemptAmount: 10,
      zeroRatedAmount: 5,
      outOfScopeAmount: 0,
    },
    pricingMode: 'TAX_EXCLUSIVE',
    currencyCode: 'SAR',
  },
  parameters: {
    direction: 'rtl',
  },
}
