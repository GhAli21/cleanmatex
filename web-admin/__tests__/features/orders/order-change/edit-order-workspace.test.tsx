import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OrderChangeContext } from '@/lib/types/order-change';
import { mapChangeContextToEditBaseline } from '@features/orders/order-change/edit-order-view-model';
import { EditOrderWorkspace } from '@features/orders/order-change/edit-order-workspace';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('next-intl', () => {
  const translate = (key: string, values?: Record<string, unknown>) => (
    values ? `${key}:${JSON.stringify(values)}` : key
  );
  return { useTranslations: () => translate };
});

jest.mock('@/lib/hooks/use-csrf-token', () => ({
  getCSRFHeader: (token: string | null) => (token ? { 'X-CSRF-Token': token } : {}),
}));

jest.mock('@/lib/utils/csrf-token', () => ({
  getCSRFToken: async () => 'csrf-test',
}));

const message = { info: jest.fn(), error: jest.fn() };
jest.mock('@ui/feedback', () => ({
  cmxMessage: { info: (...args: unknown[]) => message.info(...args), error: (...args: unknown[]) => message.error(...args) },
  CmxSummaryMessage: ({ title, items }: { title: string; items?: string[] }) => <div>{title}{(items ?? []).join(' ')}</div>,
}));

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '66666666-6666-4666-8666-666666666666';

function context(overrides: Partial<OrderChangeContext> = {}): OrderChangeContext {
  return {
    orderId: ORDER_ID,
    orderNo: '1001',
    committedAt: '2026-10-14T00:00:00.000Z',
    editStateVersion: 1,
    wfStateVersion: 1,
    workflow: { currentStatus: 'READY', profileId: null, profileVersionId: null },
    editAccess: { status: 'OPEN', reasonCode: null, reasonText: null, blockedUntil: null },
    permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
    configuration: {
      featureEnabled: false,
      newItemPricePolicy: null,
      existingDiscountPolicy: null,
      reasonPolicy: null,
      deferredReason: 'deferred',
    },
    order: {
      customer: { id: 'customer-1' },
      customerSnapshot: { name: 'Ada', mobile: '050', email: 'ada@example.com' },
      branchId: 'branch-1',
      currencyCode: 'AED',
      priority: 'normal',
      serviceSpeed: 'STANDARD',
      readyBy: null,
      notes: 'original',
      customerNotes: null,
    },
    items: [
      item(ITEM_A, 1),
      item(ITEM_B, 2),
    ],
    pieces: [],
    preferences: [],
    financial: {
      totalAmount: '10.0000',
      netCollectedAmount: '10.0000',
      outstandingAmount: '0.0000',
      overpaidAmount: '0.0000',
    },
    capabilitySummary: { status: 'DEFERRED', reasonCode: 'CAPABILITY_POLICY_PENDING' },
    ...overrides,
  };
}

function item(id: string, quantity: number): OrderChangeContext['items'][number] {
  return {
    id,
    orderId: ORDER_ID,
    productId: PRODUCT,
    productName: 'Shirt',
    productName2: null,
    serviceCategoryCode: null,
    quantity,
    pricePerUnit: '5.0000',
    totalPrice: '5.0000',
    priceOverride: null,
    preferenceCharge: '0.0000',
    packingPreferenceCode: null,
    active: true,
  };
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('mapChangeContextToEditBaseline', () => {
  it('keeps same-product lines separate and allows an order with no items', () => {
    const loaded = mapChangeContextToEditBaseline(context());
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.baseline.lines.map((line) => line.identity.kind === 'persisted' ? line.identity.id : '')).toEqual([ITEM_A, ITEM_B]);
    expect(loaded.baseline.lines.every((line) => line.productId === PRODUCT)).toBe(true);

    const empty = mapChangeContextToEditBaseline(context({ items: [] }));
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.baseline.lines).toEqual([]);
  });
});

describe('EditOrderWorkspace', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    message.info.mockReset();
    message.error.mockReset();
    fetchMock.mockReset();
    const installed = fetchMock as unknown as typeof fetch;
    global.fetch = installed;
    window.fetch = installed;
  });

  function mockContext(next: OrderChangeContext = context()) {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/change-context')) return json({ ok: true, data: next });
      if (String(url).endsWith('/changes/preview')) {
        return json({
          ok: true,
          data: {
            status: 'DENIED',
            originalTotal: '10.0000',
            projectedTotal: '10.0000',
            decisions: [{ operationCode: 'CHANGE_ORDER_NOTES', decision: 'DENY', reasonCode: 'CAPABILITY_POLICY_DENIED' }],
          },
        });
      }
      return json({ ok: false }, 500);
    });
  }

  it('reviews a notes change without calling apply and then disables a denied field', async () => {
    mockContext();
    render(<EditOrderWorkspace orderId={ORDER_ID} />);
    const notes = await screen.findByLabelText('internalNotes');
    fireEvent.change(notes, { target: { value: 'updated' } });
    expect(screen.getByText(/workspace\.dirtyCount:\{"count":1\}/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'workspace.review' }));
    await waitFor(() => expect(screen.getByText(/workspace.deniedReason/)).toBeInTheDocument());
    expect(screen.getByLabelText('internalNotes')).toBeDisabled();

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.endsWith('/changes/preview'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/changes'))).toBe(false);
    const previewCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/changes/preview'));
    expect(previewCall?.[1]?.headers['X-CSRF-Token']).toBe('csrf-test');
  });

  it('discards unsaved notes and reports a blocked order without opening fields', async () => {
    mockContext(context({
      editAccess: { status: 'BLOCKED', reasonCode: 'ORDER_LOCKED', reasonText: 'Locked by finance', blockedUntil: null },
    }));
    const { unmount } = render(<EditOrderWorkspace orderId={ORDER_ID} />);
    const blockedNotes = await screen.findByLabelText('internalNotes');
    expect(blockedNotes).toBeDisabled();
    expect(screen.getByRole('button', { name: 'workspace.review' })).toBeDisabled();
    unmount();

    mockContext();
    render(<EditOrderWorkspace orderId={ORDER_ID} />);
    const notes = await screen.findByLabelText('internalNotes');
    fireEvent.change(notes, { target: { value: 'updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'workspace.discardChanges' }));
    expect(screen.getByLabelText('internalNotes')).toHaveValue('original');
    expect(message.info).toHaveBeenCalledWith('workspace.discarded');
  });

  it('shows repeated products and an empty item list without offering item edits', async () => {
    mockContext();
    const { unmount } = render(<EditOrderWorkspace orderId={ORDER_ID} />);
    expect(await screen.findAllByText('Shirt')).toHaveLength(2);
    expect(screen.getByText('workspace.commercialUnavailable')).toBeInTheDocument();
    unmount();

    mockContext(context({ items: [] }));
    render(<EditOrderWorkspace orderId={ORDER_ID} />);
    expect(await screen.findByText('workspace.emptyItems')).toBeInTheDocument();
  });
});
