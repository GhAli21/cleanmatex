/**
 * Storybook: CmxScanInput (HFC P3b). Scan or type a code and press Enter; try the RTL story with Arabic text.
 */
import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxScanInput, type CmxScanStatus } from '@ui/forms/cmx-scan-input'

const meta = {
  title: 'Forms/CmxScanInput',
  component: CmxScanInput,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { label: 'Scan a code', placeholder: 'ORD-20261031-0001-1-1 or a tag', submitLabel: 'Scan', onScan: () => undefined },
} satisfies Meta<typeof CmxScanInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

function WithResultDemo(args: React.ComponentProps<typeof CmxScanInput>) {
  const [status, setStatus] = React.useState<CmxScanStatus | null>(null)
  return (
    <CmxScanInput
      {...args}
      status={status}
      onScan={(v) => setStatus(v.startsWith('ORD-') ? { tone: 'success', message: `Found ${v}` } : { tone: 'error', message: `No match for ${v}` })}
    />
  )
}

export const WithResult: Story = { render: (args) => <WithResultDemo {...args} /> }

export const Busy: Story = { args: { busy: true } }

export const Rtl: Story = {
  args: { label: 'امسح الرمز', placeholder: 'رمز القطعة أو البطاقة', submitLabel: 'مسح', hint: 'امسح أو اكتب ثم اضغط Enter' },
  decorators: [(S) => (<div dir="rtl"><S /></div>)],
}
