/**
 * Storybook: CmxCodeSearchInput (HFC P3b). A full order number or piece code is sent as an exact code on Enter.
 */
import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxCodeSearchInput, type CodeSearchSubmit } from '@ui/forms/cmx-code-search-input'

const meta = {
  title: 'Forms/CmxCodeSearchInput',
  component: CmxCodeSearchInput,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { value: '', onChange: () => undefined, onSubmit: () => undefined, 'aria-label': 'Search orders', placeholder: 'Order number, customer, phone' },
} satisfies Meta<typeof CmxCodeSearchInput>

export default meta
type Story = StoryObj<typeof meta>

function InteractiveDemo(args: React.ComponentProps<typeof CmxCodeSearchInput>) {
  const [value, setValue] = React.useState('')
  const [last, setLast] = React.useState<CodeSearchSubmit | null>(null)
  return (
    <div className="space-y-2">
      <CmxCodeSearchInput {...args} value={value} onChange={setValue} onSubmit={setLast} />
      <pre className="text-xs">{last ? JSON.stringify(last) : 'Press Enter'}</pre>
    </div>
  )
}

export const Interactive: Story = { render: (args) => <InteractiveDemo {...args} /> }
