import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxPhoneDisplay } from './cmx-phone-display'

const meta: Meta<typeof CmxPhoneDisplay> = {
  title: 'Data Display/CmxPhoneDisplay',
  component: CmxPhoneDisplay,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CmxPhoneDisplay>

export const Default: Story = {
  args: {
    value: '+96896662624',
  },
}

export const WithActions: Story = {
  args: {
    value: '+966501234567',
    copyable: true,
    telLink: true,
    whatsappLink: true,
  },
}

export const EmptyFallback: Story = {
  args: {
    value: null,
    fallback: 'No phone',
  },
}
