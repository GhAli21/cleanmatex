import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const startClose = jest.fn();
const finalizeClose = jest.fn();
const fetchCatalogs = jest.fn();
const fetchSiblings = jest.fn();

jest.mock('@features/cash-drawers/api/cash-drawer-api', () => ({
  startCashDrawerClose: (...a: unknown[]) => startClose(...a),
  finalizeCashDrawerClose: (...a: unknown[]) => finalizeClose(...a),
  fetchCashDrawerCatalogs: () => fetchCatalogs(),
  fetchCashDrawersWithCurrentSession: (...a: unknown[]) => fetchSiblings(...a),
  fetchCurrencyDenominations: jest.fn().mockResolvedValue([]),
}));
jest.mock('@lib/hooks/use-csrf-token', () => ({ useCSRFToken: () => ({ token: 'csrf' }) }));
jest.mock('@lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({
    decimalPlaces: 3,
    formatMoneyWithCode: (n: number, c?: string) => `${n.toFixed(3)} ${c ?? ''}`.trim(),
  }),
}));
jest.mock('@ui/feedback', () => ({
  cmxMessage: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
    t.has = () => false;
    return t;
  },
}));

import { cmxMessage } from '@ui/feedback';
import { CashDrawerCloseWizard } from '@features/cash-drawers/ui/cash-drawer-close-wizard';

const CATALOGS = {
  drawerTypes: [
    { code: 'SAFE', name: 'Safe', name2: null, isMobile: false, canReceiveDisposition: true, displayOrder: 1 },
    { code: 'TEMPORARY', name: 'Temporary', name2: null, isMobile: false, canReceiveDisposition: false, displayOrder: 2 },
  ],
  trxTypes: [],
  dispositions: [
    { code: 'LEFT_IN_DRAWER', name: 'Left in drawer', name2: null, cashMoveMode: 'NONE', destDrawerTypeCode: null, requiresNotes: false, requiresKeptAmount: false, isSelectable: true, displayOrder: 1 },
    { code: 'MOVED_TO_SAFE', name: 'Moved to safe', name2: null, cashMoveMode: 'ALL', destDrawerTypeCode: 'SAFE', requiresNotes: false, requiresKeptAmount: false, isSelectable: true, displayOrder: 2 },
    { code: 'LEGACY', name: 'Legacy', name2: null, cashMoveMode: 'NONE', destDrawerTypeCode: null, requiresNotes: false, requiresKeptAmount: false, isSelectable: false, displayOrder: 9 },
  ],
  postCloseStatuses: [],
  countTypes: [],
};

const RESULT = {
  sessionId: 's1',
  currencyBalances: [
    { currencyCode: 'OMR', closingExpected: '25.0000', closingCounted: '25.0000', closingVariance: '0.0000', varianceReasonRequired: false },
  ],
};

function mount(onFinalized = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CashDrawerCloseWizard drawerId="d1" sessionId="s1" branchId="b1" open onOpenChange={jest.fn()} onFinalized={onFinalized} />
    </QueryClientProvider>,
  );
  return onFinalized;
}

async function reachDispositionStep() {
  fireEvent.click(await screen.findByRole('switch'));
  fireEvent.change(await screen.findByLabelText('billing.cashDrawers.wizard.countedAmount'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
  return (await screen.findByLabelText('billing.cashDrawers.wizard.disposition')) as HTMLSelectElement;
}

const optionOf = (select: HTMLSelectElement, value: string) => Array.from(select.options).find((o) => o.value === value);

describe('CashDrawerCloseWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchCatalogs.mockResolvedValue(CATALOGS);
    startClose.mockResolvedValue(RESULT);
    finalizeClose.mockResolvedValue({ sessionId: 's1', status: 'CLOSED', varianceApprovalPending: false, dispositionTrxId: null });
  });

  it('sends the typed count on the first step, then shows the revealed result on the second', async () => {
    fetchSiblings.mockResolvedValue([]);
    mount();
    await reachDispositionStep();
    expect(startClose).toHaveBeenCalledWith(
      expect.objectContaining({
        drawerId: 'd1',
        sessionId: 's1',
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 25, denominations: undefined },
      }),
    );
    expect(screen.getByText('billing.cashDrawers.expectedCash')).toBeInTheDocument();
  });

  it('refuses a missing count amount inline without calling the server', async () => {
    mount();
    fireEvent.click(await screen.findByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
    expect(startClose).not.toHaveBeenCalled();
    expect(cmxMessage.error).toHaveBeenCalledWith('billing.cashDrawers.wizard.countedAmountRequired');
  });

  it('disables a cash-moving disposition, and says why, when the branch has no drawer that can receive the cash', async () => {
    fetchSiblings.mockResolvedValue([]);
    mount();
    const select = await reachDispositionStep();
    await waitFor(() => expect(optionOf(select, 'MOVED_TO_SAFE')).toBeDisabled());
    expect(optionOf(select, 'MOVED_TO_SAFE')?.textContent).toContain('billing.cashDrawers.wizard.noEligibleDestinationShort');
    expect(screen.getByText('billing.cashDrawers.wizard.unavailableDispositionsHint')).toBeInTheDocument();
    // The no-move option stays available, and a system-only code is never offered.
    expect(optionOf(select, 'LEFT_IN_DRAWER')).toBeEnabled();
    expect(optionOf(select, 'LEGACY')).toBeUndefined();
  });

  it('offers the move once an eligible safe exists, and only that safe as the destination', async () => {
    fetchSiblings.mockResolvedValue([
      { id: 'safe1', is_active: true, currency_code: 'OMR', drawer_type: 'SAFE', drawer_name: 'Main safe', drawer_code: 'SAFE-1' },
      { id: 'till2', is_active: true, currency_code: 'OMR', drawer_type: 'TEMPORARY', drawer_name: 'Till 2', drawer_code: 'T-2' },
      { id: 'safe9', is_active: false, currency_code: 'OMR', drawer_type: 'SAFE', drawer_name: 'Old safe', drawer_code: 'SAFE-9' },
    ]);
    mount();
    const select = await reachDispositionStep();
    await waitFor(() => expect(optionOf(select, 'MOVED_TO_SAFE')).toBeEnabled());
    fireEvent.change(select, { target: { value: 'MOVED_TO_SAFE' } });
    const dest = (await screen.findByLabelText('billing.cashDrawers.wizard.destinationDrawer')) as HTMLSelectElement;
    const labels = Array.from(dest.options).map((o) => o.textContent ?? '');
    expect(labels.some((l) => l.includes('Main safe'))).toBe(true);
    expect(labels.some((l) => l.includes('Till 2'))).toBe(false);
    expect(labels.some((l) => l.includes('Old safe'))).toBe(false);
  });

  it('finalizes with the chosen disposition and reports the result', async () => {
    fetchSiblings.mockResolvedValue([]);
    const onFinalized = mount();
    const select = await reachDispositionStep();
    fireEvent.change(select, { target: { value: 'LEFT_IN_DRAWER' } });
    fireEvent.click(screen.getByRole('button', { name: 'billing.cashDrawers.confirmClose' }));
    await waitFor(() => expect(finalizeClose).toHaveBeenCalled());
    expect(finalizeClose).toHaveBeenCalledWith(
      expect.objectContaining({
        dispositions: [
          { currencyCode: 'OMR', dispositionCode: 'LEFT_IN_DRAWER', dispositionNotes: undefined, destDrawerId: undefined, keptAmount: undefined },
        ],
      }),
    );
    await waitFor(() => expect(onFinalized).toHaveBeenCalled());
  });

  it('keeps the user on the result step and explains when no disposition is chosen', async () => {
    fetchSiblings.mockResolvedValue([]);
    mount();
    await reachDispositionStep();
    fireEvent.click(screen.getByRole('button', { name: 'billing.cashDrawers.confirmClose' }));
    expect(finalizeClose).not.toHaveBeenCalled();
    expect(cmxMessage.error).toHaveBeenCalledWith('billing.cashDrawers.wizard.dispositionRequired');
  });

  it('is operable with native, labelled controls only (keyboard and screen-reader friendly)', async () => {
    fetchSiblings.mockResolvedValue([]);
    mount();
    const select = await reachDispositionStep();
    expect(select.tagName).toBe('SELECT');
    for (const name of ['common.back', 'billing.cashDrawers.confirmClose']) {
      const button = screen.getByRole('button', { name });
      expect(button.tagName).toBe('BUTTON');
      expect(button).not.toBeDisabled();
    }
  });
});
