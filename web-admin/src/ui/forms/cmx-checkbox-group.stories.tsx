import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCheckboxGroup } from '@ui/forms'

const options = [
  { value: 'express', label: 'Express service', description: 'Prioritize processing.' },
  { value: 'hanger', label: 'Hanger finish', description: 'Return garments ready to hang.' },
  { value: 'sms', label: 'SMS updates', description: 'Notify the customer at each milestone.' },
]

const meta = {
  title: 'Forms/CmxCheckboxGroup',
  component: CmxCheckboxGroup,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Order preferences',
    description: 'Choose the options to apply to this order.',
    options,
  },
  render: (args) => {
    const [value, setValue] = useState<string[]>(args.value ?? [])

    return (
      <div className="w-[420px]">
        <CmxCheckboxGroup {...args} value={value} onChange={setValue} />
      </div>
    )
  },
} satisfies Meta<typeof CmxCheckboxGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPreselected: Story = {
  args: {
    value: ['express', 'hanger'],
  },
}

export const RTL: Story = {
  args: {
    label: 'خيارات الطلب',
    description: 'اختر التفضيلات التي تريد تطبيقها على هذا الطلب.',
    options: [
      { value: 'express', label: 'خدمة سريعة', description: 'تسريع التنفيذ.' },
      { value: 'hanger', label: 'تجهيز على علاقة', description: 'إرجاع القطع جاهزة للتعليق.' },
      { value: 'sms', label: 'رسائل نصية', description: 'إرسال تحديثات للعميل.' },
    ],
  },
  parameters: {
    direction: 'rtl',
  },
}
