/**
 * Storybook: CmxFileGallery — mixed files, loading, empty, read-only, RTL.
 * Images are inline SVG data URLs so the story needs no network.
 */
import type { Decorator, Meta, StoryObj } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../../messages/en/common.json'
import ar from '../../../messages/ar/common.json'
import { CmxFileGallery, type CmxFileItem } from '@ui/data-display/cmx-file-gallery'

const swatch = (fill: string, text: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="28" text-anchor="middle" fill="white">${text}</text></svg>`)}`

const ITEMS: CmxFileItem[] = [
  { id: '1', name: 'shirt-front.jpg', mimeType: 'image/jpeg', url: swatch('#2563eb', 'Before'), previewMode: 'IMAGE', label: 'Before processing', meta: 'Intake · New order', notes: 'Collar stain' },
  { id: '2', name: 'shirt-after.jpg', mimeType: 'image/jpeg', url: swatch('#16a34a', 'After'), previewMode: 'IMAGE', label: 'Delivery proof', meta: 'Out for delivery · Delivery', notes: 'Locked: proof of delivery (no edit/delete)', locked: true },
  { id: '3', name: 'care-instructions.pdf', mimeType: 'application/pdf', url: '#', previewMode: 'PDF', label: 'Customer document' },
  { id: '4', name: 'sleeve-tear.mp4', mimeType: 'video/mp4', url: '#', previewMode: 'VIDEO', label: 'Item video', notes: 'Tear on left sleeve' },
  { id: '6', name: 'long-note.jpg', mimeType: 'image/jpeg', url: swatch('#9333ea', 'Note'), previewMode: 'IMAGE', label: 'Quality check', meta: 'Quality check · Order issue', notes: 'A long note that wraps over two lines and is then cut with an ellipsis so tiles stay the same height', sizeBytes: 2457600 },
  { id: '5', name: 'price-list.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url: '#', previewMode: 'DOWNLOAD', label: 'Other' },
]

const withIntl: Decorator = (Story, ctx) => {
  const rtl = ctx.globals.direction === 'rtl' || ctx.parameters.rtl
  return (
    <NextIntlClientProvider locale={rtl ? 'ar' : 'en'} timeZone="Asia/Muscat" messages={{ common: rtl ? ar : en }}>
      <div dir={rtl ? 'rtl' : 'ltr'} style={{ width: 720 }}>
        <Story />
      </div>
    </NextIntlClientProvider>
  )
}

const meta = {
  title: 'DataDisplay/CmxFileGallery',
  component: CmxFileGallery,
  tags: ['autodocs'],
  decorators: [withIntl],
  parameters: { layout: 'centered' },
  args: {
    items: ITEMS,
    onOpen: (i: number) => console.info('open', i),
    onEdit: (item: CmxFileItem) => console.info('edit', item.id),
    onDelete: (item: CmxFileItem) => console.info('delete', item.id),
  },
} satisfies Meta<typeof CmxFileGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Mixed: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Empty: Story = { args: { items: [] } }
export const ReadOnly: Story = { args: { readOnly: true } }
// RTL variant — verifies Arabic layout direction
export const Arabic: Story = { parameters: { rtl: true } }
