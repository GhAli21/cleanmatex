import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCheckbox } from '@ui/primitives'

const meta = {
  title: 'Primitives/CmxCheckbox',
  component: CmxCheckbox,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Notify me when ready',
    description: 'Send an SMS when the order reaches Ready status.',
  },
  render: (args) => {
    const [checked, setChecked] = useState(Boolean(args.checked))

    return (
      <div className="w-[360px] rounded-lg bg-white p-6 shadow-sm">
        <CmxCheckbox
          {...args}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      </div>
    )
  },
} satisfies Meta<typeof CmxCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex w-[360px] flex-col gap-4 rounded-lg bg-white p-6 shadow-sm">
      <CmxCheckbox size="sm" label="Small (dense tables)" defaultChecked />
      <CmxCheckbox size="md" label="Medium (default, prominent)" defaultChecked />
      <CmxCheckbox size="lg" label="Large (touch-first)" defaultChecked />
    </div>
  ),
}

export const ErrorState: Story = {
  args: {
    error: 'You must accept the terms to continue.',
    label: 'I agree to the terms',
    description: undefined,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    checked: true,
    label: 'Locked preference',
  },
}

export const RTL: Story = {
  args: {
    label: 'أرسل إشعاراً عند الجاهزية',
    description: 'إرسال رسالة نصية عند وصول الطلب إلى حالة جاهز.',
  },
  parameters: {
    direction: 'rtl',
  },
}
