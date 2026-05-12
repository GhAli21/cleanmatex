'use client';

/**
 * Gift Cards Liability Report
 *
 * Tenant-wide outstanding gift card liability view.
 * Shows KPI summary cards at top, then a filterable, server-side paginated
 * table of all gift cards with remaining balance.
 *
 * Filters: status (multi via buttons), issue type, date range (issued_date).
 * Export: noted as V2 feature — not implemented here.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Hash, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { CmxSummaryMessage } from '@ui/feedback';
import {
  getGiftCardLiabilitySummaryAction,
  listGiftCardLiabilityAction,
} from '@/app/actions/marketing/gift-card-actions';
import {
  GIFT_CARD_STATUS,
  GIFT_CARD_ISSUE_TYPE,
  type GiftCardStatus,
  type GiftCardIssueType,
} from '@/lib/constants/gift-card';
import type { GiftCard } from '@/lib/types/payment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiabilitySummary {
  totalOutstanding: number;
  totalActiveCards: number;
  totalRedeemedMtd: number;
  totalIssuedMtd: number;
  totalExpiredBalance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Statuses selectable in the filter pill row */
const FILTERABLE_STATUSES: GiftCardStatus[] = [
  GIFT_CARD_STATUS.ACTIVE,
  GIFT_CARD_STATUS.PARTIALLY_REDEEMED,
  GIFT_CARD_STATUS.GENERATED,
];

const ISSUE_TYPES: GiftCardIssueType[] = [
  GIFT_CARD_ISSUE_TYPE.SOLD,
  GIFT_CARD_ISSUE_TYPE.PROMOTIONAL,
  GIFT_CARD_ISSUE_TYPE.CORPORATE,
  GIFT_CARD_ISSUE_TYPE.GOODWILL,
  GIFT_CARD_ISSUE_TYPE.MIGRATION,
  GIFT_CARD_ISSUE_TYPE.REPLACEMENT,
];

/**
 * Determine CSS classes for the expiry date cell.
 * - < 7 days remaining: red
 * - < 30 days remaining: amber
 * - Otherwise: default muted
 */
function expiryDateClasses(isoDate: string | undefined): string {
  if (!isoDate) return 'text-muted-foreground';
  const daysLeft = Math.ceil(
    (new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft < 7) return 'text-destructive font-semibold';
  if (daysLeft < 30) return 'text-amber-600 font-medium';
  return 'text-muted-foreground';
}

/** Format an ISO date string for display (date portion only). */
function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// KPI Card sub-component
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

function KpiCard({ label, value, icon, highlight = false }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border p-5 flex flex-col gap-2 ${
        highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <span className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GiftCardsLiabilityRprt() {
  const t = useTranslations('marketing.giftCards');
  const tRpt = useTranslations('marketing.giftCards.reports');
  const tCommon = useTranslations('common');

  // --- summary state ---
  const [summary, setSummary] = useState<LiabilitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // --- filter state ---
  const [selectedStatus, setSelectedStatus] = useState<GiftCardStatus | undefined>(undefined);
  const [selectedIssueType, setSelectedIssueType] = useState<GiftCardIssueType | undefined>(
    undefined
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // --- table state ---
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [total, setTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch summary KPIs once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setSummaryLoading(true);
    getGiftCardLiabilitySummaryAction().then((result) => {
      if (result.success === false) {
        setSummaryError(result.error);
      } else {
        setSummary(result.data);
        setSummaryError(null);
      }
      setSummaryLoading(false);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch table data on filter/page change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setTableLoading(true);

    listGiftCardLiabilityAction({
      page,
      pageSize: PAGE_SIZE,
      status: selectedStatus,
      issueType: selectedIssueType,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }).then((result) => {
      if (cancelled) return;
      if (result.success === false) {
        setTableError(result.error);
      } else {
        setCards(result.data);
        setTotal(result.total);
        setTableError(null);
      }
      setTableLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [page, selectedStatus, selectedIssueType, dateFrom, dateTo]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleStatusToggle = useCallback((status: GiftCardStatus) => {
    setSelectedStatus((prev) => (prev === status ? undefined : status));
    setPage(1);
  }, []);

  const handleIssueTypeToggle = useCallback((issueType: GiftCardIssueType) => {
    setSelectedIssueType((prev) => (prev === issueType ? undefined : issueType));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedStatus(undefined);
    setSelectedIssueType(undefined);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(selectedStatus || selectedIssueType || dateFrom || dateTo);

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns = [
    {
      key: 'gift_card_code',
      header: t('fields.giftCardCode'),
      render: (row: GiftCard) => (
        <span className="font-mono text-sm ltr" dir="ltr">
          {row.gift_card_code}
        </span>
      ),
    },
    {
      key: 'card_name',
      header: t('fields.cardName'),
      render: (row: GiftCard) => (
        <span className="max-w-[160px] truncate block">{row.card_name}</span>
      ),
    },
    {
      key: 'issue_type',
      header: t('fields.issueType'),
      render: (row: GiftCard) =>
        row.issue_type ? (
          <Badge variant="outline">
            {t(`issueTypes.${row.issue_type}`)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      render: (row: GiftCard) => (
        <Badge
          variant={
            row.status === 'ACTIVE'
              ? 'default'
              : row.status === 'PARTIALLY_REDEEMED'
              ? 'secondary'
              : 'outline'
          }
        >
          {t(`statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'original_amount',
      header: t('fields.originalAmount'),
      render: (row: GiftCard) => (
        <span className="tabular-nums text-sm">{row.original_amount.toFixed(3)}</span>
      ),
    },
    {
      key: 'available_amount',
      header: t('fields.availableBalance'),
      render: (row: GiftCard) => (
        <span className="tabular-nums font-semibold text-primary">
          {row.available_amount.toFixed(3)}
        </span>
      ),
    },
    {
      key: 'redeemed_amount',
      header: t('fields.redeemedAmount'),
      render: (row: GiftCard) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.redeemed_amount.toFixed(3)}
        </span>
      ),
    },
    {
      key: 'currency_code',
      header: t('fields.currency'),
      render: (row: GiftCard) => (
        <span className="text-sm uppercase">{row.currency_code}</span>
      ),
    },
    {
      key: 'expiry_date',
      header: t('fields.expiryDate'),
      render: (row: GiftCard) => (
        <span className={`text-sm tabular-nums ${expiryDateClasses(row.expiry_date)}`}>
          {fmtDate(row.expiry_date)}
        </span>
      ),
    },
    {
      key: 'issued_to_customer_name',
      header: t('fields.issuedTo'),
      render: (row: GiftCard) => (
        <span className="text-sm text-muted-foreground">
          {row.issued_to_customer_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: tCommon('date'),
      render: (row: GiftCard) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {fmtDate(row.created_at)}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const fmtCurrency = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Page header ---- */}
      <div>
        <h2 className="text-xl font-semibold">{tRpt('liabilityTitle')}</h2>
        <p className="text-sm text-muted-foreground">{tRpt('liabilitySubtitle')}</p>
      </div>

      {/* ---- Summary KPI cards ---- */}
      {summaryError ? (
        <CmxSummaryMessage type="error" title={summaryError} items={[]} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <KpiCard
            label={tRpt('totalOutstanding')}
            value={summaryLoading ? '…' : fmtCurrency(summary?.totalOutstanding ?? 0)}
            icon={<CreditCard className="h-5 w-5" />}
            highlight
          />
          <KpiCard
            label={tRpt('activeCards')}
            value={summaryLoading ? '…' : String(summary?.totalActiveCards ?? 0)}
            icon={<Hash className="h-5 w-5" />}
          />
          <KpiCard
            label={tRpt('redeemedMtd')}
            value={summaryLoading ? '…' : fmtCurrency(summary?.totalRedeemedMtd ?? 0)}
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <KpiCard
            label={tRpt('issuedMtd')}
            value={summaryLoading ? '…' : fmtCurrency(summary?.totalIssuedMtd ?? 0)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <KpiCard
            label={tRpt('expiredBalance')}
            value={summaryLoading ? '…' : fmtCurrency(summary?.totalExpiredBalance ?? 0)}
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>
      )}

      {/* ---- Filters ---- */}
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        {/* Date range + clear */}
        <div className="flex flex-wrap gap-2 items-center">
          <CmxInput
            type="date"
            className="w-auto"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label={tCommon('dateFrom')}
          />
          <CmxInput
            type="date"
            className="w-auto"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label={tCommon('dateTo')}
          />
          {hasActiveFilters && (
            <CmxButton variant="ghost" size="sm" onClick={handleClearFilters}>
              {tCommon('clearFilters')}
            </CmxButton>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERABLE_STATUSES.map((status) => (
            <CmxButton
              key={status}
              variant={selectedStatus === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleStatusToggle(status)}
            >
              {t(`statuses.${status}`)}
            </CmxButton>
          ))}
        </div>

        {/* Issue type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {ISSUE_TYPES.map((issueType) => (
            <CmxButton
              key={issueType}
              variant={selectedIssueType === issueType ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleIssueTypeToggle(issueType)}
            >
              {t(`issueTypes.${issueType}`)}
            </CmxButton>
          ))}
        </div>
      </div>

      {/* ---- Table error ---- */}
      {tableError && <CmxSummaryMessage type="error" title={tableError} items={[]} />}

      {/* ---- Export note ---- */}
      <p className="text-xs text-muted-foreground">{tRpt('exportComingSoon')}</p>

      {/* ---- Table ---- */}
      <CmxDataTable
        isLoading={tableLoading}
        columns={columns}
        data={cards}
        totalCount={total}
        currentPage={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyStateTitle={tRpt('noCardsFound')}
        emptyStateDescription={tRpt('liabilitySubtitle')}
        emptyStateIcon={<CreditCard className="h-8 w-8 text-muted-foreground" />}
        enableZebraStriping
      />
    </div>
  );
}
