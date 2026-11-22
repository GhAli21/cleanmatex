import type { Meta, StoryObj } from '@storybook/nextjs'
import { useState } from 'react'
import { CmxPhoneInput } from './cmx-phone-input'

const meta: Meta<typeof CmxPhoneInput> = {
  title: 'Forms/CmxPhoneInput',
  component: CmxPhoneInput,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CmxPhoneInput>

function InteractiveDemo({
  initial = '',
  defaultCountry = 'OM' as const,
}: {
  initial?: string
  defaultCountry?: 'OM' | 'SA'
}) {
  const [value, setValue] = useState(initial)
  return (
    <div className="max-w-md space-y-2 p-4">
      <CmxPhoneInput
        value={value}
        onChange={(e164) => setValue(e164)}
        defaultCountry={defaultCountry}
      />
    </div>
  )
}

export const DefaultOman: Story = {
  render: () => <InteractiveDemo defaultCountry="OM" />,
}

export const PrefilledSaudi: Story = {
  render: () => <InteractiveDemo initial="+966501234567" defaultCountry="SA" />,
}
