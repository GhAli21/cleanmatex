/**
 * Storybook: CmxLabelRenderer (HFC P4). Order label and piece tags at each stock size, EN and AR.
 * The print CSS is injected so the preview matches the printed page size.
 */
import type { Meta, StoryObj } from '@storybook/nextjs'
import { CmxLabelRenderer, type CmxLabelTexts } from '@ui/print/cmx-label-renderer'
import { labelPageCss } from '@ui/print/label-print-css'
import { DEFAULT_LABEL_SETTINGS, type OrderLabelData, type PieceTagData } from '@/lib/services/labels/label-types'

const en: CmxLabelTexts = {
  order: 'Order', readyBy: 'Ready by', tbd: 'To be confirmed', items: 'Items', pieces: 'Pieces', customer: 'Customer',
  tag: 'Tag', orderBarcode: 'Order barcode', pieceBarcode: 'Piece barcode', staffQr: 'Staff QR code',
  pieceOf: (s, n) => `Piece ${s} of ${n}`,
  formatDate: (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
}
const ar: CmxLabelTexts = {
  ...en, order: 'الطلب', readyBy: 'جاهز في', tbd: 'سيتم تأكيده', items: 'الأصناف', pieces: 'القطع', customer: 'العميل', tag: 'البطاقة',
  pieceOf: (s, n) => `القطعة ${s} من ${n}`,
  formatDate: (iso) => new Date(iso).toLocaleString('ar-OM', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
}
const order: OrderLabelData = {
  orderId: 'o1', orderNo: 'ORD-20261031-0001', staffQr: 'CMX1:ORD:ORD-20261031-0001', barcodeValue: 'ORD-20261031-0001',
  branchName: 'Al Khuwair', branchName2: 'الخوير', readyBy: '2026-11-02T18:00:00+04:00', itemCount: 3, pieceCount: 5, customerShort: 'Ahmed B.',
}
const pieces: PieceTagData[] = [1, 2].map((seq) => ({
  pieceId: `p${seq}`, pieceCode: `ORD-20261031-0001-1-${seq}`, barcodeValue: `ORD-20261031-0001-1-${seq}`,
  staffQr: `CMX1:PEC:ORD-20261031-0001-1-${seq}`, orderNo: order.orderNo, itemSrno: 'ORD-20261031-0001-1',
  itemName: 'Suit 2 pcs', itemName2: 'بدلة قطعتين', pieceSeq: seq, pieceTotal: 2, externalTag: seq === 1 ? 'HS-778' : null,
}))

const meta = {
  title: 'Print/CmxLabelRenderer',
  component: CmxLabelRenderer,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { template: 'order-label', order, pieces, settings: DEFAULT_LABEL_SETTINGS, texts: en, locale: 'en' },
  render: (args) => (
    <div>
      <style>{labelPageCss(args.template, args.template === 'order-label' ? args.settings.orderLabelSize : args.settings.pieceTagSize)}</style>
      <CmxLabelRenderer {...args} />
    </div>
  ),
} satisfies Meta<typeof CmxLabelRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const OrderLabel4x6: Story = {}
export const OrderLabel58mm: Story = { args: { settings: { ...DEFAULT_LABEL_SETTINGS, orderLabelSize: '58mm' } } }
export const OrderLabelArabic: Story = { args: { texts: ar, locale: 'ar' } }
export const OrderLabelNoCustomer: Story = { args: { settings: { ...DEFAULT_LABEL_SETTINGS, showCustomerName: false } } }
export const PieceTags: Story = { args: { template: 'piece-tag' } }
export const PieceTagsWithQr: Story = { args: { template: 'piece-tag', settings: { ...DEFAULT_LABEL_SETTINGS, pieceTagQr: true, pieceTagSize: '80x40mm' } } }
export const PieceTagsArabic: Story = { args: { template: 'piece-tag', texts: ar, locale: 'ar' } }
