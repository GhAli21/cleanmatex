/**
 * HFC P3b T3.9: codes on screens. Order-number fast path helper, `?piece=` highlight, piece/line chips
 * and the orders search box that opens a scanned code.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = jest.fn();
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? `:${Object.values(values).join(',')}` : ''}`,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard/orders',
  useSearchParams: () => new URLSearchParams('status=processing'),
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
jest.mock('@/src/features/orders/ui/OrderPiecesManager', () => ({
  OrderPiecesManager: ({ itemId, highlightPiece }: { itemId: string; highlightPiece?: string | null }) => (
    <div data-testid={`pieces-${itemId}`}>{highlightPiece ?? 'none'}</div>
  ),
}));

import { orderNoFromCode } from '@/lib/validations/code-format-schemas';
import { isHighlightedPiece, lineCodeOfPieceRef, readPieceParam } from '@/src/features/orders/lib/piece-highlight';
import { PieceList } from '@/src/features/orders/ui/PieceList';
import { PieceBaseCard } from '@/src/features/orders/ui/pieces/PieceBaseCard';
import { OrderItemsList } from '@/src/features/orders/ui/order-items-list';
import { OrderFiltersBar } from '@/src/features/orders/ui/order-filters-bar';
import type { OrderItemPiece } from '@/types/order';

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

describe('orderNoFromCode', () => {
  it('reduces order, line and piece codes to the order number', () => {
    expect(orderNoFromCode(' ord-20261031-0007 ')).toBe(ORDER);
    expect(orderNoFromCode(`${ORDER}-S2`)).toBe(`${ORDER}-S2`);
    expect(orderNoFromCode(`${ORDER}-3`)).toBe(ORDER);
    expect(orderNoFromCode(`${ORDER}-3-12`)).toBe(ORDER);
  });
  it('gives null for free text, tags and partial numbers', () => {
    expect(orderNoFromCode('Ahmed')).toBeNull();
    expect(orderNoFromCode('A123')).toBeNull();
    expect(orderNoFromCode('ORD-2026')).toBeNull();
  });
});

describe('piece-highlight helpers', () => {
  it('matches by id or by piece code in any case', () => {
    expect(isHighlightedPiece(piece(1), 'p-1')).toBe(true);
    expect(isHighlightedPiece(piece(1), `${ORDER.toLowerCase()}-2-1`)).toBe(true);
    expect(isHighlightedPiece(piece(1), 'p-2')).toBe(false);
    expect(isHighlightedPiece(piece(1), null)).toBe(false);
  });
  it('finds the line of a piece code and cleans the param', () => {
    expect(lineCodeOfPieceRef(`${ORDER}-2-1`)).toBe(`${ORDER}-2`);
    expect(lineCodeOfPieceRef('0b5e9c2a-1111-4222-8333-444455556666')).toBeNull();
    expect(readPieceParam('  ')).toBeNull();
    expect(readPieceParam('x'.repeat(200))).toBeNull();
    expect(readPieceParam(` ${ORDER}-2-1\n`)).toBe(`${ORDER}-2-1`);
  });
});

describe('PieceBaseCard', () => {
  it('shows the full piece code and the tag as chips (no shortened id)', () => {
    render(<PieceBaseCard piece={piece(3, { barcode: 'A123' })} />);
    expect(screen.getByText(`${ORDER}-2-3`).closest('[data-code-kind="piece"]')).toBeInTheDocument();
    expect(screen.getByText('A123').closest('[data-code-kind="tag"]')).toBeInTheDocument();
    expect(screen.queryByText(/…/)).not.toBeInTheDocument();
  });
  it('hides a released tag', () => {
    render(<PieceBaseCard piece={piece(3, { barcode: 'A123', tag_released_at: '2026-10-31T08:00:00Z' })} />);
    expect(screen.queryByText('A123')).not.toBeInTheDocument();
  });
});

describe('PieceList ?piece= highlight', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('opens the page holding the piece, highlights it and scrolls to it', () => {
    const pieces = Array.from({ length: 25 }, (_, i) => piece(i + 1));
    const { container } = render(<PieceList pieces={pieces} highlightPiece={`${ORDER}-2-23`} />);
    expect(screen.getByTestId('card-p-23')).toBeInTheDocument();
    expect(screen.queryByTestId('card-p-1')).not.toBeInTheDocument();
    const slot = container.querySelector('[data-highlighted="true"]');
    expect(slot).toHaveAttribute('data-piece-id', 'p-23');
    expect(slot).toHaveAttribute('aria-current', 'true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('highlights nothing without a match', () => {
    const { container } = render(<PieceList pieces={[piece(1)]} highlightPiece="nope" />);
    expect(container.querySelector('[data-highlighted]')).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('OrderItemsList', () => {
  const items = [
    { id: 'line-1', order_item_srno: `${ORDER}-1`, product_name: 'Shirt', quantity: 1, price_per_unit: 1, total_price: 1 },
    { id: 'line-2', order_item_srno: `${ORDER}-2`, product_name: 'Trousers', quantity: 1, price_per_unit: 1, total_price: 1 },
  ];

  it('shows line code chips and opens only the line of a piece code', () => {
    render(
      <OrderItemsList items={items as never} orderId="o-1" tenantId="t-1" highlightPiece={`${ORDER}-2-1`} />,
    );
    expect(screen.getByText(`${ORDER}-1`).closest('[data-code-kind="item"]')).toBeInTheDocument();
    expect(screen.getByTestId('pieces-line-2')).toHaveTextContent(`${ORDER}-2-1`);
    expect(screen.queryByTestId('pieces-line-1')).not.toBeInTheDocument();
  });

  it('opens every line for a piece id', () => {
    render(<OrderItemsList items={items as never} orderId="o-1" tenantId="t-1" highlightPiece="p-9" />);
    expect(screen.getByTestId('pieces-line-1')).toHaveTextContent('p-9');
    expect(screen.getByTestId('pieces-line-2')).toHaveTextContent('p-9');
  });
});

describe('OrderFiltersBar code search', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const reply = (status: number, body: unknown) =>
    Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
  const submit = (value: string) => {
    const input = screen.getByRole('searchbox', { name: 'orders.search' });
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('opens the order of a full code', async () => {
    fetchMock.mockReturnValue(
      reply(200, { success: true, data: { order: { id: 'o-7' }, piece: { id: 'p-1' } } }),
    );
    render(<OrderFiltersBar currentFilters={{}} />);
    submit(`${ORDER}-2-1`);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/orders/o-7?piece=p-1'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ raw: `${ORDER}-2-1`, context: 'any' });
  });

  it('falls back to the list search when the code is not found', async () => {
    fetchMock.mockReturnValue(reply(404, { success: false, code: 'SCAN_NOT_FOUND' }));
    render(<OrderFiltersBar currentFilters={{}} />);
    submit(ORDER);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/dashboard/orders?status=processing&search=${ORDER}&page=1`),
    );
  });

  it('searches free text without a lookup', () => {
    render(<OrderFiltersBar currentFilters={{}} />);
    submit('Ahmed');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/dashboard/orders?status=processing&search=Ahmed&page=1');
  });
});
