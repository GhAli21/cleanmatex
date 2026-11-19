/**
 * Storybook: CmxFileDropZone — default, image-only with size limit, single file, disabled, RTL.
 * Uses the real `common` messages; the toolbar Direction switches EN (ltr) / AR (rtl).
 */
import type { Decorator, Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en/common.json'
import ar from '../../../messages/ar/common.json'
import { CmxFileDropZone } from '@ui/forms/cmx-file-drop-zone'

const withIntl: Decorator = (Story, ctx) => {
  const rtl = ctx.globals.direction === 'rtl' || ctx.parameters.rtl
  return (
    <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} timeZone="Asia/Muscat" messages={{ common: rtl ? ar : en }}>
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ width: 420 }}>
        <Story />
      </div>
    </NextIntlClientProvider>
  )
}

const meta = {
  title: 'Forms/CmxFileDropZone',
  component: CmxFileDropZone,
  tags: ['autodocs'],
  decorators: [withIntl],
  parameters: { layout: 'centered' },
  args: {
    onFiles: (files: File[]) => console.info('accepted', files.map((f) => f.name)),
    onReject: (file: File, reason: string) => console.info('rejected', file.name, reason),
  },
} satisfies Meta<typeof CmxFileDropZone>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
// Only JPEG/PNG/WebP up to 5 MB — other files reach onReject.
export const ImagesOnly: Story = {
  args: { acceptMimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxSizeBytes: 5 * 1048576, hint: 'JPEG, PNG or WebP · up to 5 MB' },
}
export const SingleFile: Story = { args: { multiple: false } }
// Slim one-row bar, as used inside the File Util panel.
export const Compact: Story = { args: { compact: true } }
export const Disabled: Story = { args: { disabled: true } }
// RTL variant — verifies Arabic layout direction
export const Arabic: Story = { parameters: { rtl: true } }
