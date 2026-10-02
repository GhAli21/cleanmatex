/**
 * Storybook coverage for the scoped setting row (value + source badge + reset).
 *
 * Exercises an inherited value (no reset), an overridden value (reset shown),
 * the disabled reset, a row without a description, and RTL. The editable
 * control is passed as children, so the story uses a plain input — the real
 * screens pass Cmx switches/selects.
 */

import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxScopedSettingField } from '@ui/patterns/cmx-scoped-setting-field'

const meta = {
  title: 'Patterns/CmxScopedSettingField',
  component: CmxScopedSettingField,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CmxScopedSettingField>

export default meta
type Story = StoryObj<typeof meta>

const Control = () => <input type="number" defaultValue={5} className="w-20 rounded border px-2 py-1" aria-label="Value" />

export const Inherited: Story = {
  args: {
    label: 'Cash change rounding increment',
    description: 'Round the change handed back to this many minor units.',
    sourceLabel: 'Inherited from Organization',
    isOverridden: false,
    children: <Control />,
  },
}

export const Overridden: Story = {
  args: {
    label: 'Cash change rounding increment',
    description: 'Round the change handed back to this many minor units.',
    sourceLabel: 'Overridden here',
    isOverridden: true,
    onReset: () => undefined,
    resetLabel: 'Reset to inherited',
    children: <Control />,
  },
}

export const ResetDisabled: Story = {
  args: {
    ...Overridden.args,
    disabled: true,
  },
}

export const WithoutDescription: Story = {
  args: {
    label: 'Blind close',
    sourceLabel: 'Drawer type default',
    isOverridden: false,
    children: <Control />,
  },
}

export const RTL: Story = {
  args: {
    label: 'مضاعف تقريب الباقي النقدي',
    description: 'قرّب الباقي المُسلَّم إلى هذا العدد من الوحدات الصغرى.',
    sourceLabel: 'تم التعديل هنا',
    isOverridden: true,
    onReset: () => undefined,
    resetLabel: 'إعادة إلى القيمة الموروثة',
    children: <Control />,
  },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
}
