import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxSwitch } from '@ui/primitives'

const meta = {
  title: 'Primitives/CmxSwitch',
  component: CmxSwitch,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    label: 'Enable notifications',
    description: 'Send alerts when order status changes.',
  },
  render: (args) => {
    const [checked, setChecked] = useState(Boolean(args.checked))

    return (
      <div className="w-[360px] rounded-lg bg-white p-6 shadow-sm">
        <CmxSwitch
          {...args}
          checked={checked}
          onCheckedChange={setChecked}
        />
      </div>
    )
  },
} satisfies Meta<typeof CmxSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: {
    checked: true,
  },
}

export const Sizes: Story = {
  render: () => {
    const [sm, setSm] = useState(true)
    const [md, setMd] = useState(true)
    const [lg, setLg] = useState(true)

    return (
      <div className="flex w-[360px] flex-col gap-4 rounded-lg bg-white p-6 shadow-sm">
        <CmxSwitch size="sm" label="Small" checked={sm} onCheckedChange={setSm} />
        <CmxSwitch size="md" label="Medium (default)" checked={md} onCheckedChange={setMd} />
        <CmxSwitch size="lg" label="Large" checked={lg} onCheckedChange={setLg} />
      </div>
    )
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    checked: true,
  },
}
