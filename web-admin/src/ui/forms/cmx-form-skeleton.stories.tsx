import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxFormSkeleton } from '@ui/forms'

const meta = {
  title: 'Forms/CmxFormSkeleton',
  component: CmxFormSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CmxFormSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    sections: 2,
    fieldsPerSection: 4,
  },
}

export const StickyActions: Story = {
  args: {
    sections: 3,
    fieldsPerSection: 3,
    stickyActions: true,
  },
}
