/**
 * HFC P3b T3.10: global scan dialog, link-tag dialog, flag gate, shortcut and page-wide wedge.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

const push = jest.fn();
const showSuccess = jest.fn();
let flags: Record<string, boolean> | undefined = { human_codes_scan_labels: true };

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? `:${Object.values(values).join(',')}` : ''}`,
}));
jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ currentTenant: { tenant_id: 't-1' }, isTenantContextReady: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ currencyCode: 'OMR', decimalPlaces: 3 }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@ui/feedback', () => ({
  ...jest.requireActual('@ui/feedback'),
  useMessage: () => ({ showSuccess, showError: jest.fn() }),
}));
jest.mock('@/lib/hooks/use-feature-flags', () => ({ useFeatureFlagsQuery: () => ({ data: flags }) }));
jest.mock('@/lib/hooks/use-csrf-token', () => ({
  useCSRFToken: () => ({ token: 'csrf-1', loading: false }),
  getCSRFHeader: (token: string | null) => (token ? { 'X-CSRF-Token': token } : {}),
}));

import { GlobalScanTrigger, isScanShortcut } from '@/src/features/scan/ui/global-scan-trigger';
import { GlobalScanDialog } from '@/src/features/scan/ui/global-scan-dialog';
import { LinkTagDialog } from '@/src/features/scan/ui/link-tag-dialog';
import { scanResultHref } from '@/src/features/scan/api/scan-api';

expect.extend(toHaveNoViolations);

const pieceResult = {
  kind: 'PIECE',
  matchedBy: 'EXTERNAL_TAG',
  code: 'ORD-20261031-0001-1-2',
  context: 'any',
  order: { id: 'o-1', orderNo: 'ORD-20261031-0001', status: 'processing', branchId: null },
  item: { id: 'i-1', srno: 'ORD-20261031-0001-1', name: 'Shirt' },
  piece: {
    id: 'p-1',
    itemId: 'i-1',
    pieceSeq: 2,
    pieceCode: 'ORD-20261031-0001-1-2',
    externalTag: 'A123',
    status: null,
    removed: false,
  },
};

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
}

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  showSuccess.mockReset();
  flags = { human_codes_scan_labels: true };
  global.fetch = fetchMock as unknown as typeof fetch;
});

function scan(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('scanResultHref / isScanShortcut', () => {
  it('opens the order, with ?piece= for a piece', () => {
    expect(scanResultHref({ order: pieceResult.order })).toBe('/dashboard/orders/o-1');
    expect(scanResultHref(pieceResult as never)).toBe('/dashboard/orders/o-1?piece=p-1');
  });
  it('matches Ctrl/Cmd+Shift+F by physical key only', () => {
    const base = { code: 'KeyF', shiftKey: true, altKey: false, ctrlKey: true, metaKey: false };
    expect(isScanShortcut(base)).toBe(true);
    expect(isScanShortcut({ ...base, ctrlKey: false, metaKey: true })).toBe(true);
    expect(isScanShortcut({ ...base, shiftKey: false })).toBe(false);
    expect(isScanShortcut({ ...base, code: 'KeyG' })).toBe(false);
  });
});

describe('GlobalScanTrigger', () => {
  it('renders nothing while the flag is off or loading', () => {
    flags = { human_codes_scan_labels: false };
    const { container, rerender } = render(<GlobalScanTrigger />);
    expect(container).toBeEmptyDOMElement();
    flags = undefined;
    rerender(<GlobalScanTrigger />);
    expect(container).toBeEmptyDOMElement();
  });
  it('opens on the button', async () => {
    render(<GlobalScanTrigger />);
    fireEvent.click(screen.getByTestId('global-scan-trigger'));
    expect(await screen.findByTestId('global-scan-dialog')).toBeInTheDocument();
  });
  it('opens on the shortcut', async () => {
    render(<GlobalScanTrigger />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'F', ctrlKey: true, shiftKey: true }));
    });
    expect(await screen.findByTestId('global-scan-dialog')).toBeInTheDocument();
  });
  it('a page-wide scanner burst opens the dialog and looks the code up', async () => {
    fetchMock.mockReturnValue(reply(200, { success: true, data: pieceResult }));
    render(<GlobalScanTrigger />);
    act(() => {
      for (const ch of 'A123') {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: /\d/.test(ch) ? `Digit${ch}` : `Key${ch}`, key: ch }));
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ raw: 'A123', context: 'any' });
  });
});

describe('GlobalScanDialog', () => {
  it('shows the codes found and opens the piece', async () => {
    fetchMock.mockReturnValue(reply(200, { success: true, data: pieceResult }));
    const onOpenChange = jest.fn();
    render(<GlobalScanDialog open onOpenChange={onOpenChange} />);
    scan(screen.getByLabelText('scan.dialog.inputLabel'), 'a123');
    expect(await screen.findByText('scan.result.matchedByTag')).toBeInTheDocument();
    expect(screen.getAllByText('ORD-20261031-0001-1-2').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('scan.dialog.openPiece'));
    expect(push).toHaveBeenCalledWith('/dashboard/orders/o-1?piece=p-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('shows EN/AR text for the error code, and a rate-limit message on 429', async () => {
    fetchMock.mockReturnValueOnce(reply(404, { success: false, code: 'SCAN_NOT_FOUND' }));
    render(<GlobalScanDialog open onOpenChange={jest.fn()} />);
    const input = screen.getByLabelText('scan.dialog.inputLabel');
    scan(input, 'ORD-20261031-0009');
    expect(await screen.findByText('scan.errors.SCAN_NOT_FOUND')).toBeInTheDocument();
    fetchMock.mockReturnValueOnce(reply(429, { error: 'Too many' }));
    scan(input, 'ORD-20261031-0010');
    expect(await screen.findByText('scan.errors.rateLimited')).toBeInTheDocument();
  });
  it('hides Link a tag for a removed piece', async () => {
    fetchMock.mockReturnValue(
      reply(200, { success: true, data: { ...pieceResult, piece: { ...pieceResult.piece, removed: true } } }),
    );
    render(<GlobalScanDialog open onOpenChange={jest.fn()} initialCode="ORD-20261031-0001-1-2" />);
    expect(await screen.findByText('scan.result.removed')).toBeInTheDocument();
    expect(screen.queryByText('scan.dialog.changeTag')).not.toBeInTheDocument();
  });
  it('has no axe violations in the scan content', async () => {
    const { baseElement } = render(<GlobalScanDialog open onOpenChange={jest.fn()} />);
    // A-44: CmxDialog is named by its CmxDialogTitle, so the full rule set runs (aria-dialog-name included).
    expect(await axe(baseElement)).toHaveNoViolations();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)).toHaveTextContent('scan.dialog.title');
  });
});

describe('LinkTagDialog', () => {
  it('PUTs the tag with the CSRF header and reports success', async () => {
    fetchMock.mockReturnValue(
      reply(200, { success: true, data: { pieceId: 'p-1', pieceCode: 'ORD-20261031-0001-1-2', externalTag: 'B77' } }),
    );
    const onSaved = jest.fn();
    render(
      <LinkTagDialog open onOpenChange={jest.fn()} pieceId="p-1" pieceCode="ORD-20261031-0001-1-2" currentTag={null} onSaved={onSaved} />,
    );
    scan(screen.getByLabelText('scan.linkTag.inputLabel'), 'B77');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/orders/pieces/p-1/external-tag');
    expect(init.method).toBe('PUT');
    expect(init.headers['X-CSRF-Token']).toBe('csrf-1');
    expect(showSuccess).toHaveBeenCalledWith('scan.linkTag.linked:B77,ORD-20261031-0001-1-2');
  });
  it('maps closed-order and in-use errors to translated text', async () => {
    fetchMock.mockReturnValueOnce(reply(409, { success: false, code: 'PIECE_TAG_ORDER_CLOSED' }));
    render(<LinkTagDialog open onOpenChange={jest.fn()} pieceId="p-1" pieceCode="X" currentTag="A1" />);
    const input = screen.getByLabelText('scan.linkTag.inputLabel');
    scan(input, 'B77');
    expect(await screen.findByText('scan.linkTag.errors.PIECE_TAG_ORDER_CLOSED')).toBeInTheDocument();
    fetchMock.mockReturnValueOnce(
      reply(409, { success: false, code: 'PIECE_TAG_IN_USE', tag: 'B78', heldByPieceCode: 'ORD-20261031-0002-1-1' }),
    );
    scan(input, 'B78');
    expect(
      await screen.findByText('processing.modal.error.tagInUseBy:B78,ORD-20261031-0002-1-1'),
    ).toBeInTheDocument();
  });
  it('removes the current tag with DELETE', async () => {
    fetchMock.mockReturnValue(reply(200, { success: true, data: { pieceId: 'p-1', pieceCode: 'X', externalTag: null } }));
    render(<LinkTagDialog open onOpenChange={jest.fn()} pieceId="p-1" pieceCode="X" currentTag="A1" />);
    fireEvent.click(screen.getByText('scan.linkTag.remove'));
    await waitFor(() => expect(fetchMock.mock.calls[0][1].method).toBe('DELETE'));
    await waitFor(() => expect(showSuccess).toHaveBeenCalledWith('scan.linkTag.removedOk:X'));
  });
});
