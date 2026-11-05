/**
 * HFC P4: printed order label and piece tags. Codes are LTR, the CODE128 and staff QR are real SVGs,
 * customer name and piece QR follow the settings, Arabic labels are RTL with Arabic item names,
 * and order text is never injected as markup.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { CmxBarcode, CmxLabelRenderer, labelPageCss, type CmxLabelTexts } from '@ui/print';
import { DEFAULT_LABEL_SETTINGS, type OrderLabelData, type PieceTagData } from '@/lib/services/labels/label-types';

const texts: CmxLabelTexts = {
  order: 'Order',
  readyBy: 'Ready by',
  tbd: 'TBD',
  items: 'Items',
  pieces: 'Pieces',
  customer: 'Customer',
  tag: 'Tag',
  orderBarcode: 'Order barcode',
  pieceBarcode: 'Piece barcode',
  staffQr: 'Staff QR',
  pieceOf: (s, n) => `Piece ${s} of ${n}`,
  formatDate: (iso) => `D(${iso})`,
};

const order: OrderLabelData = {
  orderId: 'o1',
  orderNo: 'ORD-260101-0001',
  staffQr: 'CMX1:ORD:ORD-260101-0001',
  barcodeValue: 'ORD-260101-0001',
  branchName: 'Main',
  branchName2: 'الرئيسي',
  readyBy: '2026-01-02T10:00:00+04:00',
  itemCount: 2,
  pieceCount: 3,
  customerShort: 'Ahmed B.',
};

const piece = (over: Partial<PieceTagData> = {}): PieceTagData => ({
  pieceId: 'p1',
  pieceCode: 'ORD-260101-0001-1-2',
  barcodeValue: 'ORD-260101-0001-1-2',
  staffQr: 'CMX1:PEC:ORD-260101-0001-1-2',
  orderNo: 'ORD-260101-0001',
  itemSrno: 'ORD-260101-0001-1',
  itemName: 'Suit',
  itemName2: 'بدلة',
  pieceSeq: 2,
  pieceTotal: 3,
  externalTag: 'HS-778',
  ...over,
});

describe('CmxLabelRenderer order-label', () => {
  it('prints order no, CODE128, staff QR, ready-by, counts and the short customer name', () => {
    const { container } = render(
      <CmxLabelRenderer template="order-label" order={order} settings={DEFAULT_LABEL_SETTINGS} texts={texts} locale="en" />,
    );
    expect(screen.getByText('ORD-260101-0001').closest('bdi')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('img', { name: 'Order barcode ORD-260101-0001' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Staff QR ORD-260101-0001' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByText('D(2026-01-02T10:00:00+04:00)')).toBeInTheDocument();
    expect(screen.getByText('Ahmed B.')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(container.querySelector('[data-template="order-label"]')).toHaveAttribute('dir', 'ltr');
    expect(container.textContent).not.toMatch(/\+968|1234 5678/);
  });

  it('hides the customer when the setting is off, shows TBD with no ready-by, and is RTL in Arabic', () => {
    const { container } = render(
      <CmxLabelRenderer
        template="order-label"
        order={{ ...order, readyBy: null }}
        settings={{ ...DEFAULT_LABEL_SETTINGS, showCustomerName: false }}
        texts={texts}
        locale="ar"
      />,
    );
    expect(screen.queryByText('Ahmed B.')).toBeNull();
    expect(screen.getByText('TBD')).toBeInTheDocument();
    expect(screen.getByText('الرئيسي')).toBeInTheDocument();
    expect(container.querySelector('[data-template="order-label"]')).toHaveAttribute('dir', 'rtl');
  });

  it('never turns order text into markup', () => {
    const { container } = render(
      <CmxLabelRenderer
        template="order-label"
        order={{ ...order, customerShort: '<img src=x onerror=alert(1)>', branchName: '<b>x</b>' }}
        settings={DEFAULT_LABEL_SETTINGS}
        texts={texts}
        locale="en"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});

describe('CmxLabelRenderer piece-tag', () => {
  it('prints one tag per piece with code, CODE128, piece x of n, item name and live tag; QR only when on', () => {
    const { container, rerender } = render(
      <CmxLabelRenderer
        template="piece-tag"
        order={order}
        pieces={[piece(), piece({ pieceId: 'p2', pieceCode: 'ORD-260101-0001-2-1', barcodeValue: 'ORD-260101-0001-2-1', pieceSeq: 1, pieceTotal: 1, externalTag: null })]}
        settings={DEFAULT_LABEL_SETTINGS}
        texts={texts}
        locale="en"
      />,
    );
    expect(container.querySelectorAll('[data-template="piece-tag"]')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Piece barcode ORD-260101-0001-1-2' })).toBeInTheDocument();
    expect(screen.getByText('Piece 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('HS-778')).toBeInTheDocument();
    expect(screen.queryAllByText(/^Tag/)).toHaveLength(1);
    expect(container.querySelector('[data-barcode="qr"]')).toBeNull();

    rerender(
      <CmxLabelRenderer template="piece-tag" order={order} pieces={[piece()]} settings={{ ...DEFAULT_LABEL_SETTINGS, pieceTagQr: true }} texts={texts} locale="ar" />,
    );
    expect(screen.getByRole('img', { name: 'Staff QR ORD-260101-0001-1-2' })).toBeInTheDocument();
    expect(screen.getByText('بدلة')).toBeInTheDocument();
  });
});

describe('CmxLabelRenderer copies and order QR (label printing config, 0685)', () => {
  it('prints the order label N times and hides its staff QR when orderLabelQr is off', () => {
    const { container } = render(
      <CmxLabelRenderer
        template="order-label"
        order={order}
        settings={{ ...DEFAULT_LABEL_SETTINGS, orderLabelCopies: 3, orderLabelQr: false }}
        texts={texts}
        locale="en"
      />,
    );
    expect(container.querySelectorAll('[data-template="order-label"]')).toHaveLength(3);
    expect(container.querySelector('[data-barcode="qr"]')).toBeNull();
  });

  it('prints each piece tag N times, collated, and treats a bad copies value as 1', () => {
    const p2 = piece({ pieceId: 'p2', pieceCode: 'ORD-260101-0001-2-1', barcodeValue: 'ORD-260101-0001-2-1' });
    const { container, rerender } = render(
      <CmxLabelRenderer template="piece-tag" order={order} pieces={[piece(), p2]} settings={{ ...DEFAULT_LABEL_SETTINGS, pieceTagCopies: 2 }} texts={texts} locale="en" />,
    );
    const codes = Array.from(container.querySelectorAll('[data-template="piece-tag"] .cmx-code')).map((n) => n.textContent);
    expect(codes.filter((c) => c?.startsWith('ORD-'))).toEqual([
      'ORD-260101-0001-1-2', 'ORD-260101-0001-1-2', 'ORD-260101-0001-2-1', 'ORD-260101-0001-2-1',
    ]);
    rerender(
      <CmxLabelRenderer template="piece-tag" order={order} pieces={[piece()]} settings={{ ...DEFAULT_LABEL_SETTINGS, pieceTagCopies: 99 }} texts={texts} locale="en" />,
    );
    expect(container.querySelectorAll('[data-template="piece-tag"]')).toHaveLength(1);
  });
});

describe('CmxBarcode and print CSS', () => {
  it('falls back to the plain code when the value cannot be encoded', () => {
    const { container } = render(<CmxBarcode kind="code128" value="طلب" label="x" />);
    expect(container.querySelector('[data-barcode-fallback]')).toHaveTextContent('طلب');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('sizes the page from the setting', () => {
    expect(labelPageCss('order-label', '4x6in')).toContain('size: 4in 6in');
    expect(labelPageCss('order-label', 'A6')).toContain('size: A6');
    expect(labelPageCss('order-label', '80mm')).toContain('size: 80mm 120mm');
    expect(labelPageCss('piece-tag', '50x25mm')).toContain('size: 50mm 25mm');
    expect(labelPageCss('piece-tag', 'bogus' as never)).toContain('size: 58mm 30mm');
  });
});
