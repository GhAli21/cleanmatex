import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxRadioGroup } from '@ui/forms'

const options = [
  { value: 'standard', label: 'Standard', description: 'Normal processing time.' },
  { value: 'express', label: 'Express', description: 'Faster turnaround.' },
  { value: 'same_day', label: 'Same day', description: 'Priority same-day service.' },
]

const meta = {
  title: 'Forms/CmxRadioGroup',
  component: CmxRadioGroup,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Service speed',
    description: 'Choose one processing option.',
    options,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? 'standard')

    return (
      <div className="w-[420px]">
        <CmxRadioGroup {...args} value={value} onChange={setValue} />
      </div>
    )
  },
} satisfies Meta<typeof CmxRadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TwoColumns: Story = {
  args: {
    columns: 2,
  },
}

export const RTL: Story = {
  args: {
    label: 'سرعة الخدمة',
    description: 'اختر خيار معالجة واحد.',
    options: [
      { value: 'standard', label: 'عادي', description: 'وقت معالجة طبيعي.' },
      { value: 'express', label: 'سريع', description: 'إنجاز أسرع.' },
      { value: 'same_day', label: 'نفس اليوم', description: 'أولوية لنفس اليوم.' },
    ],
  },
  parameters: {
    direction: 'rtl',
  },
}
