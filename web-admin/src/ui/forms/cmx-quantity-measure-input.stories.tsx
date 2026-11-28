import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxQuantityMeasureInput } from '@ui/forms'

const meta = {
  title: 'Forms/CmxQuantityMeasureInput',
  component: CmxQuantityMeasureInput,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    dimension: 'MASS',
    unitSymbol: 'kg',
    qtyDecimals: 3,
    value: { measuredQty: '', length: '', width: '' },
    onChange: () => {},
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)
    return <div className="w-[320px]"><CmxQuantityMeasureInput {...args} value={value} onChange={setValue} /></div>
  },
} satisfies Meta<typeof CmxQuantityMeasureInput>

export default meta
type Story = StoryObj<typeof meta>

export const Weight: Story = { args: { billedPreview: '3.5 kg' } }
export const Area: Story = { args: { dimension: 'AREA', unitSymbol: 'm²', qtyDecimals: 2 } }
export const AreaInFeet: Story = { args: { dimension: 'AREA', unitSymbol: 'm²', lengthSymbol: 'ft', qtyDecimals: 2 } }
export const WithError: Story = { args: { error: 'Enter the measure' } }
export const RTL: Story = { decorators: [(Story) => <div dir="rtl"><Story /></div>] }
