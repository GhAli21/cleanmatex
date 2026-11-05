/**
 * Print CSS for order labels and piece tags (HFC P4, T4.3). Plain CSS (no Tailwind) because the label
 * prints from its own iframe. One label per page; the page is the label stock size from settings.
 */
import type { OrderLabelSize, PieceTagSize } from '@/lib/services/labels/label-types'

export type LabelTemplate = 'order-label' | 'piece-tag'

/** CSS `@page` size per stock. Roll stock has a fixed cut length so each label is its own page. */
export const ORDER_LABEL_PAGE: Record<OrderLabelSize, { size: string; width: string; height: string }> = {
  '4x6in': { size: '4in 6in', width: '4in', height: '6in' },
  A6: { size: 'A6', width: '105mm', height: '148mm' },
  '80mm': { size: '80mm 120mm', width: '80mm', height: '120mm' },
  '58mm': { size: '58mm 90mm', width: '58mm', height: '90mm' },
}

export const PIECE_TAG_PAGE: Record<PieceTagSize, { size: string; width: string; height: string }> = {
  '58x30mm': { size: '58mm 30mm', width: '58mm', height: '30mm' },
  '50x25mm': { size: '50mm 25mm', width: '50mm', height: '25mm' },
  '80x40mm': { size: '80mm 40mm', width: '80mm', height: '40mm' },
}

export function labelPageCss(template: LabelTemplate, size: OrderLabelSize | PieceTagSize): string {
  const page =
    template === 'order-label'
      ? ORDER_LABEL_PAGE[size as OrderLabelSize] ?? ORDER_LABEL_PAGE['4x6in']
      : PIECE_TAG_PAGE[size as PieceTagSize] ?? PIECE_TAG_PAGE['58x30mm']
  const small = template === 'piece-tag' || size === '58mm'
  return `
@page { size: ${page.size}; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; color: #000; }
body { font-family: Arial, 'Segoe UI', Tahoma, sans-serif; font-size: ${small ? '9pt' : '11pt'}; line-height: 1.25; }
.cmx-label { width: ${page.width}; height: ${page.height}; padding: ${small ? '1.5mm' : '4mm'}; overflow: hidden;
  display: flex; flex-direction: column; gap: ${small ? '0.8mm' : '2.5mm'}; page-break-after: always; break-after: page; }
.cmx-label:last-child { page-break-after: auto; break-after: auto; }
.cmx-code { font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; letter-spacing: 0.02em; }
.cmx-order-no { font-size: ${small ? '11pt' : '20pt'}; text-align: center; }
.cmx-bars { display: flex; justify-content: center; }
.cmx-bars svg { max-width: 100%; height: auto; }
.cmx-row { display: flex; justify-content: space-between; gap: 2mm; }
.cmx-muted { color: #333; }
.cmx-strong { font-weight: 700; }
.cmx-qr { display: flex; justify-content: center; }
.cmx-tag { flex-direction: row; align-items: center; }
.cmx-tag-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.6mm; }
.cmx-tag-qr svg { width: ${page.height === '25mm' ? '20mm' : '24mm'}; height: auto; }
.cmx-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media screen { .cmx-label { border: 1px dashed #999; margin: 4px; } }
`
}
