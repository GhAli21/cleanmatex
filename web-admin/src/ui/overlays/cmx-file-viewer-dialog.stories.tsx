/**
 * Storybook: CmxFileViewerDialog — image (zoom, arrows), non-previewable file, RTL navigation.
 */
import { useState } from 'react'
import type { Decorator, Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en/common.json'
import ar from '../../../messages/ar/common.json'
import { CmxButton } from '@ui/primitives/cmx-button'
import type { CmxFileItem } from '@ui/data-display/cmx-file-gallery'
import { CmxFileViewerDialog } from '@ui/overlays/cmx-file-viewer-dialog'

const swatch = (fill: string, text: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="64" text-anchor="middle" fill="white">${text}</text></svg>`)}`

const ITEMS: CmxFileItem[] = [
  { id: '1', name: 'before.jpg', mimeType: 'image/jpeg', url: swatch('#2563eb', 'Before'), previewMode: 'IMAGE', label: 'Before processing', notes: 'Collar stain, customer informed.' },
  { id: '2', name: 'after.jpg', mimeType: 'image/jpeg', url: swatch('#16a34a', 'After'), previewMode: 'IMAGE', label: 'After processing' },
  { id: '3', name: 'price-list.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: '#', previewMode: 'DOWNLOAD', label: 'Other' },
]

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

function Demo({ start }: { start: number }) {
  const [index, setIndex] = useState<number | null>(start)
  return (
    <>
      <CmxButton onClick={() => setIndex(start)}>Open viewer</CmxButton>
      <CmxFileViewerDialog items={ITEMS} index={index} onIndexChange={setIndex} />
    </>
  )
}

const meta = {
  title: 'Overlays/CmxFileViewerDialog',
  component: CmxFileViewerDialog,
  tags: ['autodocs'],
  decorators: [withIntl],
  parameters: { layout: 'centered' },
  args: { items: ITEMS, index: 0, onIndexChange: () => undefined },
} satisfies Meta<typeof CmxFileViewerDialog>

export default meta
type Story = StoryObj<typeof meta>

// Arrow keys move between files; + / - zoom; click the image to toggle 2x.
export const Image: Story = { render: () => <Demo start={0} /> }
export const NoPreview: Story = { render: () => <Demo start={2} /> }
// RTL variant — verifies Arabic layout direction and mirrored arrow navigation
export const Arabic: Story = { render: () => <Demo start={0} />, parameters: { rtl: true } }
