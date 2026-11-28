import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCombobox } from '@ui/forms'

const options = [
  { value: 'PC', label: 'PC — Piece (pc)', group: 'Count' },
  { value: 'BASKET', label: 'BASKET — Basket (bsk)', group: 'Count', badge: 'Custom' },
  { value: 'KG', label: 'KG — Kilogram (kg)', group: 'Weight', keywords: 'كيلوغرام' },
  { value: 'LB', label: 'LB — Pound (lb)', group: 'Weight', keywords: 'رطل', disabled: true },
]

const meta = {
  title: 'Forms/CmxCombobox',
  component: CmxCombobox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { label: 'Unit', options, value: 'KG', onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <div className="h-[24rem] w-[320px]"><CmxCombobox {...args} value={value} onChange={setValue} /></div>
  },
} satisfies Meta<typeof CmxCombobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { value: '', placeholder: 'Choose a unit', options: [] } }
export const WithError: Story = { args: { value: '', error: 'Choose a unit' } }
export const Disabled: Story = { args: { disabled: true } }
export const RTL: Story = { decorators: [(Story) => <div dir="rtl"><Story /></div>] }
