import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PosSessionOrderBanner } from '@features/pos-sessions/ui/pos-session-order-banner';
import { POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import type { PosSessionRow } from '@/lib/types/pos-session';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === 'banner.paused') return `Paused ${values?.sessionNo}`;
    if (key === 'banner.branchConflict') return 'Branch conflict';
    if (key === 'banner.manage') return 'Manage sessions';
    return key;
  },
}));

jest.mock('@ui/primitives', () => ({
  CmxButton: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button type="button" {...props}>{children}</button>
  ),
}));

jest.mock('@features/pos-sessions/api/pos-session-api', () => ({
  fetchMyActivePosSession: jest.fn(),
  posSessionActiveQueryKey: (branchId: string | null, includeContext: boolean) => [
    'pos-sessions',
    'my-active',
    branchId ?? 'none',
    includeContext ? 'context' : 'basic',
  ],
}));

const { fetchMyActivePosSession } = jest.requireMock('@features/pos-sessions/api/pos-session-api') as {
  fetchMyActivePosSession: jest.Mock;
};

const branchId = '11111111-1111-4111-8111-111111111111';

function session(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    tenant_org_id: '33333333-3333-4333-8333-333333333333',
    branch_id: branchId,
    user_id: '44444444-4444-4444-8444-444444444444',
    terminal_id: null,
    cash_drawer_id: null,
    cash_drawer_session_id: null,
    session_no: 'POS-20260708-ABC12345',
    business_date: '2026-07-08',
    business_timezone: 'Asia/Muscat',
    status: POS_SESSION_STATUS.OPEN,
    opened_at: '2026-07-08T06:00:00.000Z',
    opened_by: '44444444-4444-4444-8444-444444444444',
    paused_at: null,
    paused_by: null,
    pause_reason: null,
    closed_at: null,
    closed_by: null,
    close_reason: null,
    force_closed_at: null,
    force_closed_by: null,
    force_close_reason: null,
    metadata: {},
    is_active: true,
    rec_status: 1,
    rec_order: 0,
    rec_notes: null,
    created_at: '2026-07-08T06:00:00.000Z',
    created_by: '44444444-4444-4444-8444-444444444444',
    created_info: null,
    updated_at: null,
    updated_by: null,
    updated_info: null,
    ...overrides,
  };
}

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PosSessionOrderBanner branchId={branchId} />
    </QueryClientProvider>
  );
}

describe('PosSessionOrderBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render a healthy OPEN banner', async () => {
    fetchMyActivePosSession.mockResolvedValueOnce({ type: 'ACTIVE', session: session() });

    const { container } = renderBanner();

    await waitFor(() => expect(fetchMyActivePosSession).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('renders a paused warning banner', async () => {
    fetchMyActivePosSession.mockResolvedValueOnce({
      type: 'ACTIVE',
      session: session({ status: POS_SESSION_STATUS.PAUSED }),
    });

    renderBanner();

    expect(await screen.findByText('Paused POS-20260708-ABC12345')).toBeTruthy();
    expect(screen.getByText('Manage sessions')).toBeTruthy();
  });

  it('renders a branch-conflict banner', async () => {
    fetchMyActivePosSession.mockResolvedValueOnce({
      type: 'BRANCH_CONFLICT',
      requestedBranchId: branchId,
      activeBranchId: '55555555-5555-4555-8555-555555555555',
      activeSession: session(),
    });

    renderBanner();

    expect(await screen.findByText('Branch conflict')).toBeTruthy();
  });
});
