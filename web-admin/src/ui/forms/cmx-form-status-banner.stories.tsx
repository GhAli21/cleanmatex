import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxFormStatusBanner } from '@ui/forms'

const meta = {
  title: 'Forms/CmxFormStatusBanner',
  component: CmxFormStatusBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Please review this form',
    items: ['A required field is missing.', 'One value needs to be corrected.'],
  },
} satisfies Meta<typeof CmxFormStatusBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: {
    type: 'success',
    title: 'Product saved',
    items: ['Your changes were saved successfully.'],
  },
}

export const Warning: Story = {
  args: {
    type: 'warning',
  },
}

export const Error: Story = {
  args: {
    type: 'error',
  },
}

export const RTL: Story = {
  args: {
    type: 'info',
    title: 'مراجعة الحقول',
    items: ['يرجى التحقق من الحقول المظللة قبل الحفظ.'],
  },
  parameters: {
    direction: 'rtl',
  },
}
