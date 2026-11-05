/**
 * HFC P3b T3.9b: codes on the station and report screens, and the pieces-panel filter by piece code or tag.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

const push = jest.fn();
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string | number>) =>
    `${ns}.${key}${values ? `:${Object.values(values).join(',')}` : ''}`,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard/reports',
  useSearchParams: () => new URLSearchParams(''),
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
jest.mock('@/lib/hooks/useBilingual', () => ({ useBilingual: () => (en: string | null) => en ?? '' }));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ formatMoneyWithCode: (n: number) => `OMR ${n}`, decimalPlaces: 3 }),
}));
jest.mock('@ui/feedback', () => ({
  ...jest.requireActual('@ui/feedback'),
  useMessage: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}));
jest.mock('@/src/features/orders/ui/pieces/IntakePieceCard', () => ({
  IntakePieceCard: ({ piece }: { piece: { id: string; piece_code: string } }) => (
    <div data-testid={`card-${piece.id}`}>{piece.piece_code}</div>
  ),
}));
jest.mock('@/src/features/orders/ui/piece-preferences-editor-dialog', () => ({
  PiecePreferencesEditorDialog: () => null,
}));

import { matchesPieceCodeFilter, PIECE_FILTER_MIN_PIECES } from '@/src/features/orders/lib/piece-highlight';
import { PieceList } from '@/src/features/orders/ui/PieceList';
import OrdersReportTable from '@/src/features/reports/ui/orders-report-table-rprt';
import PaymentsReportTable from '@/src/features/reports/ui/payments-report-table-rprt';
import type { OrderItemPiece } from '@/types/order';
import type { OrderRow, PaymentRow } from '@/lib/types/report-types';

const ORDER = 'ORD-20261031-0007';

function piece(seq: number, over: Partial<OrderItemPiece> = {}): OrderItemPiece {
  return {
    id: `p-${seq}`,
    order_item_id: 'line-2',
    piece_seq: seq,
    piece_code: `${ORDER}-2-${seq}`,
    barcode: null,
    ...over,
  } as OrderItemPiece;
}

beforeEach(() => push.mockReset());

describe('matchesPieceCodeFilter', () => {
  it('matches part of the piece code or the live tag, in any letter case', () => {
    expect(matchesPieceCodeFilter(piece(3), '')).toBe(true);
    expect(matchesPieceCodeFilter(piece(3), `${ORDER.toLowerCase()}-2-3`)).toBe(true);
    expect(matchesPieceCodeFilter(piece(3), '2-3')).toBe(true);
    expect(matchesPieceCodeFilter(piece(3, { barcode: 'HT-0042' }), ' ht-0042 ')).toBe(true);
    expect(matchesPieceCodeFilter(piece(3), 'HT-0042')).toBe(false);
  });
  it('ignores a released tag and reads Arabic-Indic digits', () => {
    expect(
      matchesPieceCodeFilter(piece(3, { barcode: 'HT-0042', tag_released_at: '2026-10-31T00:00:00Z' }), 'HT-0042'),
    ).toBe(false);
    expect(matchesPieceCodeFilter(piece(3, { barcode: 'HT-0042' }), 'HT-٠٠٤٢')).toBe(true);
  });
});

describe('PieceList filter by code or tag', () => {
  const many = Array.from({ length: PIECE_FILTER_MIN_PIECES + 2 }, (_, i) =>
    piece(i + 1, i === 4 ? { barcode: 'HT-0042' } : {}),
  );

  it('is hidden on short lists', () => {
    render(<PieceList pieces={many.slice(0, PIECE_FILTER_MIN_PIECES - 1)} />);
    expect(screen.queryByLabelText('codes.filterPieces')).not.toBeInTheDocument();
  });

  it('keeps only the matching pieces, shows the count and an empty message', () => {
    render(<PieceList pieces={many} />);
    const input = screen.getByLabelText('codes.filterPieces');
    expect(input).toHaveAttribute('dir', 'ltr');

    fireEvent.change(input, { target: { value: 'ht-0042' } });
    expect(screen.getByTestId('card-p-5')).toBeInTheDocument();
    expect(screen.queryByTestId('card-p-1')).not.toBeInTheDocument();
    expect(screen.getByText(`codes.filterCount:1,${many.length}`)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: `${ORDER}-2-7` } });
    expect(screen.getByTestId('card-p-7')).toBeInTheDocument();
    expect(screen.queryByTestId('card-p-5')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'NOPE' } });
    expect(screen.getByText('codes.filterNoMatch')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getAllByTestId(/^card-/)).toHaveLength(many.length);
  });

  it('can be turned off', () => {
    render(<PieceList pieces={many} enableCodeFilter={false} />);
    expect(screen.queryByLabelText('codes.filterPieces')).not.toBeInTheDocument();
  });
});

describe('report tables show the order number as a code chip', () => {
  const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };

  it('orders report: chip copies without opening the row; the row still opens the order', async () => {
    const rows = [
      { id: 'o-7', orderNo: ORDER, customerName: 'A', status: 'processing', totalItems: 1, total: 1, paymentStatus: 'paid', createdAt: '2026-10-31T08:00:00Z' },
    ] as OrderRow[];
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(
      <OrdersReportTable orders={rows} pagination={pagination} currencyCode="OMR" basePath="/dashboard/reports/orders" />,
    );
    const chip = container.querySelector('[data-code-kind="order"]') as HTMLElement;
    expect(chip).toHaveTextContent(ORDER);
    expect(chip.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
    await act(async () => {
      fireEvent.click(chip);
    });
    expect(writeText).toHaveBeenCalledWith(ORDER);
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(chip.closest('tr') as HTMLElement);
    expect(push).toHaveBeenCalledWith('/dashboard/orders/o-7');
  });

  it('payments report: chip when there is an order, dash when there is none', () => {
    const rows = [
      { id: 'pay-1', orderNo: ORDER, amount: 1, methodCode: 'CASH', status: 'COMPLETED', paidAt: '2026-10-31T08:00:00Z', currencyCode: 'OMR' },
      { id: 'pay-2', amount: 2, methodCode: 'CASH', status: 'COMPLETED', paidAt: '2026-10-31T08:00:00Z', currencyCode: 'OMR' },
    ] as PaymentRow[];
    const { container } = render(
      <PaymentsReportTable payments={rows} pagination={pagination} basePath="/dashboard/reports/payments" />,
    );
    expect(container.querySelectorAll('[data-code-kind="order"]')).toHaveLength(1);
  });
});
