/**
 * CmxLabelRenderer - printed order labels and piece tags (HFC P4, T4.3).
 *
 * Templates:
 * - order-label: order no (large) + CODE128 of the order no + branch, ready-by, item/piece counts, the short
 *   customer name (settings.showCustomerName) and the staff QR (CMX1:ORD, settings.orderLabelQr).
 * - piece-tag: piece code + CODE128 of the piece code, "piece 2 of 3", item name, external tag,
 *   and the staff QR (CMX1:PEC) only when settings.pieceTagQr is on.
 * - Copies: the order label prints settings.orderLabelCopies times; each piece tag prints
 *   settings.pieceTagCopies times, collated (piece 1 x N, then piece 2 x N). Settings come from
 *   the label printing config (migration 0685), resolved for the order's branch.
 *
 * Pure (no hooks or context) so it renders into the print iframe; all text comes in `texts`.
 * Codes print in `<bdi dir="ltr">` so they stay left to right on Arabic labels. No phone numbers or
 * customer QR are printed here (the digital receipt keeps the customer tracking QR).
 */
import * as React from 'react'
import type { LabelSettings, OrderLabelData, PieceTagData } from '@/lib/services/labels/label-types'
import { CmxBarcode } from './cmx-barcode'
import type { LabelTemplate } from './label-print-css'

export interface CmxLabelTexts {
  order: string
  readyBy: string
  tbd: string
  items: string
  pieces: string
  customer: string
  tag: string
  orderBarcode: string
  pieceBarcode: string
  staffQr: string
  /** "Piece 2 of 3" in the label language. */
  pieceOf: (seq: number, total: number) => string
  /** Ready-by date in the label language; null input never reaches it. */
  formatDate: (iso: string) => string
}

export interface CmxLabelRendererProps {
  template: LabelTemplate
  order: OrderLabelData
  pieces?: PieceTagData[]
  settings: LabelSettings
  texts: CmxLabelTexts
  /** 'ar' prints item names in Arabic (falls back to English) and lays out right to left. */
  locale: 'en' | 'ar'
}

const Code = ({ children, className = '' }: { children: string; className?: string }) => (
  <bdi dir="ltr" className={`cmx-code ${className}`}>
    {children}
  </bdi>
)

export function CmxOrderLabel({ order, settings, texts, locale }: Omit<CmxLabelRendererProps, 'template' | 'pieces'>) {
  const small = settings.orderLabelSize === '58mm'
  const branch = (locale === 'ar' ? order.branchName2 || order.branchName : order.branchName || order.branchName2) ?? ''
  return (
    <section className="cmx-label" data-template="order-label" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {branch ? <div className="cmx-strong cmx-ellipsis">{branch}</div> : null}
      <div className="cmx-muted">{texts.order}</div>
      <div className="cmx-order-no">
        <Code>{order.orderNo}</Code>
      </div>
      <div className="cmx-bars">
        <CmxBarcode
          kind="code128"
          value={order.barcodeValue}
          label={`${texts.orderBarcode} ${order.orderNo}`}
          moduleWidth={small ? 1 : 2}
          height={small ? 36 : 56}
        />
      </div>
      <div className="cmx-row">
        <span className="cmx-strong">{texts.readyBy}</span>
        <span>{order.readyBy ? texts.formatDate(order.readyBy) : texts.tbd}</span>
      </div>
      <div className="cmx-row">
        <span>
          {texts.items}: {order.itemCount}
        </span>
        <span>
          {texts.pieces}: {order.pieceCount}
        </span>
      </div>
      {settings.showCustomerName && order.customerShort ? (
        <div className="cmx-row">
          <span className="cmx-muted">{texts.customer}</span>
          <span className="cmx-ellipsis">{order.customerShort}</span>
        </div>
      ) : null}
      {settings.orderLabelQr ? (
        <div className="cmx-qr">
          <CmxBarcode kind="qr" value={order.staffQr} label={`${texts.staffQr} ${order.orderNo}`} size={small ? 72 : 112} />
        </div>
      ) : null}
    </section>
  )
}

export function CmxPieceTag({
  piece,
  settings,
  texts,
  locale,
}: {
  piece: PieceTagData
  settings: LabelSettings
  texts: CmxLabelTexts
  locale: 'en' | 'ar'
}) {
  const tiny = settings.pieceTagSize === '50x25mm'
  const itemName = (locale === 'ar' ? piece.itemName2 || piece.itemName : piece.itemName || piece.itemName2) ?? ''
  return (
    <section className="cmx-label cmx-tag" data-template="piece-tag" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="cmx-tag-main">
        <div className="cmx-strong cmx-ellipsis">
          <Code>{piece.pieceCode}</Code>
        </div>
        <div className="cmx-bars">
          <CmxBarcode
            kind="code128"
            value={piece.barcodeValue}
            label={`${texts.pieceBarcode} ${piece.pieceCode}`}
            moduleWidth={1}
            height={tiny ? 22 : 30}
          />
        </div>
        <div className="cmx-row">
          <span className="cmx-ellipsis">{itemName}</span>
          <span className="cmx-strong">{texts.pieceOf(piece.pieceSeq, piece.pieceTotal)}</span>
        </div>
        {piece.externalTag ? (
          <div className="cmx-muted cmx-ellipsis">
            {texts.tag}: <Code>{piece.externalTag}</Code>
          </div>
        ) : null}
      </div>
      {settings.pieceTagQr ? (
        <div className="cmx-tag-qr">
          <CmxBarcode kind="qr" value={piece.staffQr} label={`${texts.staffQr} ${piece.pieceCode}`} size={tiny ? 64 : 80} />
        </div>
      ) : null}
    </section>
  )
}

/** Copies from settings, kept within 1-10 (a bad value prints one copy). */
export function labelCopies(value: number | undefined): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10 ? value : 1
}

const copyIndexes = (n: number) => Array.from({ length: labelCopies(n) }, (_, i) => i)

/** The order label, or the tags of the pieces (in the order given), each copy on its own page. */
export function CmxLabelRenderer({ template, order, pieces = [], settings, texts, locale }: CmxLabelRendererProps) {
  if (template === 'order-label') {
    return (
      <>
        {copyIndexes(settings.orderLabelCopies).map((i) => (
          <CmxOrderLabel key={`order-${i}`} order={order} settings={settings} texts={texts} locale={locale} />
        ))}
      </>
    )
  }
  const tagCopies = copyIndexes(settings.pieceTagCopies)
  return (
    <>
      {pieces.flatMap((p) =>
        tagCopies.map((i) => (
          <CmxPieceTag key={`${p.pieceId}-${i}`} piece={p} settings={settings} texts={texts} locale={locale} />
        )),
      )}
    </>
  )
}
