import type { Meta, StoryObj } from '@storybook/nextjs'
import { fn } from 'storybook/test'
import { CmxFormActions } from '@ui/forms'

const meta = {
  title: 'Forms/CmxFormActions',
  component: CmxFormActions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  args: {
    primaryLabel: 'Save changes',
    secondaryLabel: 'Cancel',
    onSecondaryClick: fn(),
  },
} satisfies Meta<typeof CmxFormActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StickyDirty: Story = {
  args: {
    sticky: true,
    isDirty: true,
    dirtyLabel: 'Unsaved changes',
  },
}

export const RTL: Story = {
  args: {
    primaryLabel: 'حفظ التغييرات',
    secondaryLabel: 'إلغاء',
    isDirty: true,
    dirtyLabel: 'تغييرات غير محفوظة',
  },
  parameters: {
    direction: 'rtl',
  },
}
