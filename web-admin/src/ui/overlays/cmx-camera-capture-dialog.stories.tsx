/**
 * Storybook: CmxCameraCaptureDialog — needs a camera and browser permission; without one it
 * shows the "camera not available" state. RTL variant included.
 */
import { useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en/common.json'
import ar from '../../../messages/ar/common.json'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCameraCaptureDialog } from '@ui/overlays/cmx-camera-capture-dialog'

const withIntl: Decorator = (Story, ctx) => {
  const rtl = ctx.globals.direction === 'rtl' || ctx.parameters.rtl
  return (
    <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} timeZone="Asia/Muscat" messages={{ common: rtl ? ar : en }}>
      <div dir={rtl ? 'rtl' : 'ltr'}>
        <Story />
      </div>
    </NextIntlClientProvider>
  )
}

function Demo() {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <CmxButton onClick={() => setOpen(true)}>Take a photo</CmxButton>
      {last && <p className="text-sm">{last}</p>}
      <CmxCameraCaptureDialog open={open} onOpenChange={setOpen} onCapture={(f) => setLast(`${f.name} · ${Math.round(f.size / 1024)} KB`)} />
    </div>
  )
}

const meta = {
  title: 'Overlays/CmxCameraCaptureDialog',
  component: CmxCameraCaptureDialog,
  tags: ['autodocs'],
  decorators: [withIntl],
  parameters: { layout: 'centered' },
  args: { open: false, onOpenChange: () => undefined, onCapture: () => undefined },
} satisfies Meta<typeof CmxCameraCaptureDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { render: () => <Demo /> }
// RTL variant — verifies Arabic layout direction
export const Arabic: Story = { render: () => <Demo />, parameters: { rtl: true } }
