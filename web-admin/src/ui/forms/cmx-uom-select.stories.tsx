import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxUomSelect } from '@ui/forms'

const units = [
  { code: 'PC', name: 'Piece', name2: 'قطعة', symbol: 'pc', symbol2: 'قطعة', dimension: 'COUNT', isActive: true },
  { code: 'KG', name: 'Kilogram', name2: 'كيلوغرام', symbol: 'kg', symbol2: 'كجم', dimension: 'MASS', isActive: true },
  { code: 'LB', name: 'Pound', name2: 'رطل', symbol: 'lb', symbol2: 'رطل', dimension: 'MASS', isActive: false },
  { code: 'BASKET', name: 'Basket', name2: 'سلة', symbol: 'bsk', symbol2: 'سلة', dimension: 'COUNT', isActive: true, origin: 'CUSTOM' },
] as const

const meta = {
  title: 'Forms/CmxUomSelect',
  component: CmxUomSelect,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { units: [...units], value: 'KG', onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <div className="h-[24rem] w-[320px]"><CmxUomSelect {...args} value={value} onChange={setValue} /></div>
  },
} satisfies Meta<typeof CmxUomSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MassOnly: Story = { args: { dimension: 'MASS' } }
export const WithError: Story = { args: { error: 'Choose a unit' } }
export const RTL: Story = { decorators: [(Story) => <div dir="rtl"><Story /></div>] }
