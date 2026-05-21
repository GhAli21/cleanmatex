import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxHexColorField } from '@ui/forms'

function HexFieldStory({
  initialValue = '#2563EB',
  rtl = false,
}: {
  initialValue?: string
  rtl?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="w-[360px]" dir={rtl ? 'rtl' : 'ltr'}>
      <CmxHexColorField
        label={rtl ? 'لون العلامة' : 'Brand color'}
        helperText={rtl ? 'يستخدم في العناصر الرئيسية وتحديد الحقول.' : 'Used for focus, actions, and selected states.'}
        clearLabel={rtl ? 'مسح' : 'Clear'}
        pickerAriaLabel={rtl ? 'اختيار لون' : 'Pick a color'}
        presetAriaLabel={rtl ? 'لون جاهز' : 'Preset color'}
        value={value}
        onChange={setValue}
        invalidMessage={rtl ? 'قيمة اللون غير صالحة.' : 'Please enter a valid hex color.'}
        presets={['#2563EB', '#0F766E', '#D97706', '#DC2626']}
      />
    </div>
  )
}

const meta = {
  title: 'Forms/CmxHexColorField',
  component: CmxHexColorField,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  render: () => <HexFieldStory />,
} satisfies Meta<typeof CmxHexColorField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Invalid: Story = {
  render: () => <HexFieldStory initialValue="#25G" />,
}

export const RTL: Story = {
  render: () => <HexFieldStory rtl />,
  parameters: {
    direction: 'rtl',
  },
}
