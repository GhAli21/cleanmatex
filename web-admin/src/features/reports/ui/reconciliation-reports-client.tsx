'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { CmxTabsPanel } from '@ui/navigation';
import { cmxMessage } from '@ui/feedback';
import { RECONCILIATION_REPORT_KEYS } from '@/lib/constants/reconciliation-reports';
import type {
  ExcessLiabilityReport,
  B2bStatementReconReport,
  OverpaymentDispositionReconReport,
  CashDrawerReconReport,
} from '@/lib/types/reconciliation-report';
import { ReconciliationExcessLiabilityRprt } from './reconciliation-excess-liability-rprt';
import { ReconciliationB2bStatementsRprt } from './reconciliation-b2b-statements-rprt';
import { ReconciliationOverpaymentDispositionRprt } from './reconciliation-overpayment-disposition-rprt';
import { ReconciliationCashDrawerRprt } from './reconciliation-cash-drawer-rprt';

const BASE = '/api/v1/finance/reports/reconciliation';

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * D-09 — reconciliation reports client. Tabbed orchestrator: each tab lazily
 * fetches its endpoint on first view, and the Apply button re-runs the active
 * tab with the current date window. Mirrors `financial-reports-client` (no data
 * effects — fetches are triggered by user events only).
 */
export function ReconciliationReportsClient() {
  const t = useTranslations('reports.reconciliation');

  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [activeTab, setActiveTab] = useState<string>(RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY);

  const [excess, setExcess] = useState<ExcessLiabilityReport | null>(null);
  const [b2b, setB2b] = useState<B2bStatementReconReport | null>(null);
  const [overpay, setOverpay] = useState<OverpaymentDispositionReconReport | null>(null);
  const [cash, setCash] = useState<CashDrawerReconReport | null>(null);

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const fetchTab = useCallback(
    async (tabId: string, nextFrom: string, nextTo: string) => {
      setLoading((prev) => ({ ...prev, [tabId]: true }));
      try {
        const range = `from=${nextFrom}&to=${nextTo}`;
        switch (tabId) {
          case RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY: {
            const res = await fetch(`${BASE}/excess-liability`, { credentials: 'include' });
            const json = await res.json();
            if (json.success) setExcess(json.data);
            else cmxMessage.error(json.error ?? t('loadError'));
            break;
          }
          case RECONCILIATION_REPORT_KEYS.B2B_STATEMENTS: {
            const res = await fetch(`${BASE}/b2b-statements?${range}`, { credentials: 'include' });
            const json = await res.json();
            if (json.success) setB2b(json.data);
            else cmxMessage.error(json.error ?? t('loadError'));
            break;
          }
          case RECONCILIATION_REPORT_KEYS.OVERPAYMENT_DISPOSITION: {
            const res = await fetch(`${BASE}/overpayment-disposition?${range}`, { credentials: 'include' });
            const json = await res.json();
            if (json.success) setOverpay(json.data);
            else cmxMessage.error(json.error ?? t('loadError'));
            break;
          }
          case RECONCILIATION_REPORT_KEYS.CASH_DRAWER: {
            const res = await fetch(`${BASE}/cash-drawer?${range}`, { credentials: 'include' });
            const json = await res.json();
            if (json.success) setCash(json.data);
            else cmxMessage.error(json.error ?? t('loadError'));
            break;
          }
        }
      } catch {
        cmxMessage.error(t('loadError'));
      } finally {
        setLoading((prev) => ({ ...prev, [tabId]: false }));
      }
    },
    [t],
  );

  const handleApply = () => {
    void fetchTab(activeTab, from, to);
  };

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    const alreadyLoaded =
      (id === RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY && excess) ||
      (id === RECONCILIATION_REPORT_KEYS.B2B_STATEMENTS && b2b) ||
      (id === RECONCILIATION_REPORT_KEYS.OVERPAYMENT_DISPOSITION && overpay) ||
      (id === RECONCILIATION_REPORT_KEYS.CASH_DRAWER && cash);
    if (!alreadyLoaded) void fetchTab(id, from, to);
  };

  const range = `from=${from}&to=${to}`;

  const filterBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium shrink-0">{t('periodFrom')}</label>
        <input
          type="date"
          aria-label={t('periodFrom')}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium shrink-0">{t('periodTo')}</label>
        <input
          type="date"
          aria-label={t('periodTo')}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <CmxButton onClick={handleApply}>{t('apply')}</CmxButton>
    </div>
  );

  const tabs = [
    {
      id: RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY,
      label: t('tabExcess'),
      content: (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('excessSnapshotNote')}</p>
            <CmxButton onClick={() => void fetchTab(RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY, from, to)}>
              {excess ? t('refresh') : t('load')}
            </CmxButton>
          </div>
          <ReconciliationExcessLiabilityRprt
            data={excess}
            loading={!!loading[RECONCILIATION_REPORT_KEYS.EXCESS_LIABILITY]}
            csvHref={`${BASE}/excess-liability?format=csv`}
          />
        </div>
      ),
    },
    {
      id: RECONCILIATION_REPORT_KEYS.B2B_STATEMENTS,
      label: t('tabB2b'),
      content: (
        <div>
          {filterBar}
          <ReconciliationB2bStatementsRprt
            data={b2b}
            loading={!!loading[RECONCILIATION_REPORT_KEYS.B2B_STATEMENTS]}
            csvHref={`${BASE}/b2b-statements?${range}&format=csv`}
          />
        </div>
      ),
    },
    {
      id: RECONCILIATION_REPORT_KEYS.OVERPAYMENT_DISPOSITION,
      label: t('tabOverpayment'),
      content: (
        <div>
          {filterBar}
          <ReconciliationOverpaymentDispositionRprt
            data={overpay}
            loading={!!loading[RECONCILIATION_REPORT_KEYS.OVERPAYMENT_DISPOSITION]}
            csvHref={`${BASE}/overpayment-disposition?${range}&format=csv`}
          />
        </div>
      ),
    },
    {
      id: RECONCILIATION_REPORT_KEYS.CASH_DRAWER,
      label: t('tabCashDrawer'),
      content: (
        <div>
          {filterBar}
          <ReconciliationCashDrawerRprt
            data={cash}
            loading={!!loading[RECONCILIATION_REPORT_KEYS.CASH_DRAWER]}
            csvHref={`${BASE}/cash-drawer?${range}&format=csv`}
          />
        </div>
      ),
    },
  ];

  return <CmxTabsPanel tabs={tabs} onChange={handleTabChange} />;
}
