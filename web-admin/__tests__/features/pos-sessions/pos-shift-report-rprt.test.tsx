import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => false }));
jest.mock('@/lib/hooks/useLocale', () => ({ useLocale: () => 'en' }));
jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({
    formatMoneyWithCode: (amount: string, code: string | null) => `${amount} ${code ?? ''}`.trim(),
  }),
}));

import { PosShiftReportRprt } from '@features/pos-sessions/ui/pos-shift-report-rprt';
import type { PosShiftReportSnapshot } from '@/lib/types/pos-shift-report';

const snapshot = (over: Partial<PosShiftReportSnapshot> = {}): PosShiftReportSnapshot => ({
  version: 1,
  kind: 'Z',
  generatedAt: '2026-10-03T20:00:00.000Z',
  session: {
    id: 's1',
    sessionNo: 'POS-20261003-ABC',
    businessDate: '2026-10-03',
    businessTimezone: 'Asia/Muscat',
    status: 'CLOSED',
    branchId: 'b1',
    branchName: 'Main',
    operatorUserId: 'u1',
    operatorName: 'Sara',
    openedAt: '2026-10-03T06:00:00.000Z',
    closedAt: '2026-10-03T18:00:00.000Z',
    autoCloseReason: null,
  },
  payments: {
    totals: [{ currencyCode: 'OMR', amount: '25.5000', count: 2 }],
    byMethod: [
      { groupCode: 'CASH', status: 'COMPLETED', currencyCode: 'OMR', amount: '10.0000', count: 1 },
      { groupCode: 'CARD', status: 'COMPLETED', currencyCode: 'OMR', amount: '15.5000', count: 1 },
    ],
  },
  refunds: { totals: [], byMethod: [] },
  voucherLines: { totals: [], byRole: [] },
  cash: {
    byCurrency: [{ currencyCode: 'OMR', cashIn: '10.0000', cashOut: '2.5000', net: '7.5000', lineCount: 2 }],
    changeRounding: [{ currencyCode: 'OMR', net: '-0.0030', lineCount: 1 }],
  },
  drawer: {
    sessionId: 'd1',
    sessionNo: 'CDS-1',
    drawerName: 'Counter 1',
    status: 'CLOSED',
    openedAt: '2026-10-03T06:00:00.000Z',
    closedAt: '2026-10-03T18:00:00.000Z',
    variancePending: false,
    varianceApproved: false,
    varianceRejected: false,
    balances: [
      {
        currencyCode: 'OMR',
        openingExpected: '0.0000',
        openingCounted: '0.0000',
        finIn: '10.0000',
        finOut: '2.5000',
        trxIn: '0.0000',
        trxOut: '0.0000',
        closingExpected: '7.5000',
        closingCounted: '7.5000',
        closingVariance: '0.0000',
      },
    ],
  },
  ...over,
});

const zMeta = (hashVerified: boolean) => ({
  reportNo: 'Z-POS-20261003-ABC',
  generatedAt: '2026-10-03T18:00:01.000Z',
  snapshotHash: 'a'.repeat(64),
  hashVerified,
});

describe('PosShiftReportRprt', () => {
  it('prints a Z-report with its number, tender breakdown, cash handled and drawer figures', () => {
    render(<PosShiftReportRprt snapshot={snapshot()} zReport={zMeta(true)} />);
    expect(screen.getByText('posShiftReport.zTitle')).toBeInTheDocument();
    expect(screen.getByText('Z-POS-20261003-ABC')).toBeInTheDocument();
    expect(screen.getByText('CASH')).toBeInTheDocument();
    expect(screen.getByText('CARD')).toBeInTheDocument();
    expect(screen.getAllByText('7.5000 OMR', { selector: 'td' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('posShiftReport.changeRounding')).toBeInTheDocument();
    expect(screen.getByText('posShiftReport.varianceWithinThreshold')).toBeInTheDocument();
    expect(screen.getByText('posShiftReport.hashVerified')).toBeInTheDocument();
  });

  it('warns loudly when the stored report no longer matches its fingerprint', () => {
    render(<PosShiftReportRprt snapshot={snapshot()} zReport={zMeta(false)} />);
    expect(screen.getByText('posShiftReport.hashMismatch')).toBeInTheDocument();
    expect(screen.queryByText('posShiftReport.hashVerified')).toBeNull();
  });

  it('labels a live X-report as not final and shows no hash', () => {
    render(
      <PosShiftReportRprt
        snapshot={snapshot({ kind: 'X', session: { ...snapshot().session, status: 'OPEN', closedAt: null } })}
      />,
    );
    expect(screen.getByText('posShiftReport.xTitle')).toBeInTheDocument();
    expect(screen.getByText('posShiftReport.liveNote')).toBeInTheDocument();
    expect(screen.queryByText(/SHA-256/)).toBeNull();
  });

  it('says which variance decision applies to the drawer', () => {
    const base = snapshot();
    const withDrawer = (patch: Partial<NonNullable<PosShiftReportSnapshot['drawer']>>) =>
      snapshot({ drawer: { ...base.drawer!, ...patch } });

    const { rerender } = render(<PosShiftReportRprt snapshot={withDrawer({ variancePending: true })} />);
    expect(screen.getByText('posShiftReport.variancePending')).toBeInTheDocument();
    rerender(<PosShiftReportRprt snapshot={withDrawer({ varianceRejected: true })} />);
    expect(screen.getByText('posShiftReport.varianceRejected')).toBeInTheDocument();
    rerender(<PosShiftReportRprt snapshot={withDrawer({ varianceApproved: true })} />);
    expect(screen.getByText('posShiftReport.varianceApproved')).toBeInTheDocument();
  });

  it('shows the empty message when the shift had no sales and no drawer', () => {
    render(
      <PosShiftReportRprt
        snapshot={snapshot({
          payments: { totals: [], byMethod: [] },
          cash: { byCurrency: [], changeRounding: [] },
          drawer: null,
        })}
      />,
    );
    expect(screen.getAllByText('posShiftReport.none').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('posShiftReport.drawerSession')).toBeNull();
  });

  it('notes a system close at rollover', () => {
    render(
      <PosShiftReportRprt
        snapshot={snapshot({ session: { ...snapshot().session, status: 'FORCE_CLOSED', autoCloseReason: 'ROLLOVER' } })}
      />,
    );
    expect(screen.getByText('posShiftReport.autoClosedRollover')).toBeInTheDocument();
  });
});
