import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCountPicker } from '@ui/forms'

const meta = {
  title: 'Forms/CmxCountPicker',
  component: CmxCountPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    groupLabel: 'Bags',
    customLabel: 'Custom',
    min: 0,
    max: 7,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? 1)

    return (
      <div className="w-[420px]">
        <CmxCountPicker {...args} value={value} onChange={setValue} />
      </div>
    )
  },
} satisfies Meta<typeof CmxCountPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomExpanded: Story = {
  args: {
    value: 12,
  },
}

export const RTL: Story = {
  args: {
    groupLabel: 'الأكياس',
    customLabel: 'مخصص',
    isRTL: true,
  },
}
