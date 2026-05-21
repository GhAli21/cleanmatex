import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxFieldShell } from '@ui/forms'
import { CmxInput } from '@ui/primitives'

const meta = {
  title: 'Forms/CmxFieldShell',
  component: CmxFieldShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <div className="w-[340px]">
      <CmxFieldShell {...args}>
        <CmxInput value="Blue Orchid" onChange={() => undefined} />
      </CmxFieldShell>
    </div>
  ),
} satisfies Meta<typeof CmxFieldShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    id: 'field-shell-default',
    label: 'Brand accent',
    description: 'Shown across navigation, forms, and selected states.',
    hint: 'Use a high-contrast color.',
  },
}

export const WithError: Story = {
  args: {
    id: 'field-shell-error',
    label: 'Primary email',
    error: 'Please enter a valid work email address.',
  },
}

export const RTL: Story = {
  args: {
    id: 'field-shell-rtl',
    label: 'لون العلامة',
    description: 'يظهر في عناصر الواجهة الأساسية.',
    hint: 'اختر لوناً واضحاً وسهل القراءة.',
  },
  parameters: {
    direction: 'rtl',
  },
}
