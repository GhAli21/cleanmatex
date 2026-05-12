'use client';

/**
 * Gift Card Transaction Log Screen
 *
 * Tenant-wide view of all gift card transactions with pagination and filters.
 * Filters: gift_card_code search, transaction type (multi-select pills), date range.
 * Columns: date, gift_card_code (monospace/LTR), card name, type badge, amount (signed),
 *          balance before, balance after, order ref, idempotency key (truncated),
 *          notes, processed_by.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Receipt } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { CmxSummaryMessage } from '@ui/feedback';
import { useGiftCardTransactionLog } from '../hooks/use-gift-cards';
import type { GiftCardTransactionLogRow } from '@/lib/types/payment';
import type { GiftCardTxnType } from '@/lib/constants/gift-card';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All selectable transaction types in the filter row */
const TX_TYPES: GiftCardTxnType[] = [
  'REDEEM',
  'REFUND',
  'VOID',
  'ADJUSTMENT',
  'SALE',
  'ISSUE',
];

const TX_TYPE_BADGE: Record<
  GiftCardTxnType,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  REDEEM:       'default',
  REFUND:       'secondary',
  VOID:         'destructive',
  ADJUSTMENT:   'outline',
  SALE:         'default',
  ISSUE:        'outline',
  ACTIVATE:     'outline',
  EXPIRE:       'destructive',
  BONUS_ADD:    'secondary',
  BONUS_REDEEM: 'secondary',
};

/** Returns a signed, coloured amount string for each transaction type. */
function formatSignedAmount(row: GiftCardTransactionLogRow): {
  text: string;
  className: string;
} {
  const formatted = row.amount.toFixed(3);
  const isDebit =
    row.transaction_type === 'REDEEM' ||
    row.transaction_type === 'VOID' ||
    row.transaction_type === 'EXPIRE';
  if (isDebit) {
    return { text: `−${formatted}`, className: 'text-destructive font-medium tabular-nums' };
  }
  return { text: `+${formatted}`, className: 'text-green-600 font-medium tabular-nums' };
}

/** Truncate a long string in the middle for display. */
function truncateMid(value: string, maxLen = 20): string {
  if (value.length <= maxLen) return value;
  const half = Math.floor(maxLen / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GiftCardTransactionLogScreen() {
  const t = useTranslations('marketing.giftCards');
  const tLog = useTranslations('marketing.giftCards.transactionLog');
  const tCommon = useTranslations('common');

  // --- filter state ---
  const [cardCode, setCardCode] = useState('');
  const [transactionType, setTransactionType] = useState<GiftCardTxnType | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { rows, total, isLoading, error } = useGiftCardTransactionLog({
    page,
    pageSize: PAGE_SIZE,
    cardNumber: cardCode || undefined,
    transactionType,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleTypeToggle = useCallback((type: GiftCardTxnType) => {
    setTransactionType((prev) => (prev === type ? undefined : type));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setCardCode('');
    setTransactionType(undefined);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(cardCode || transactionType || dateFrom || dateTo);

  const columns = [
    {
      key: 'transaction_date',
      header: tLog('fields.transactionDate'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="tabular-nums text-sm">
          {new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(row.transaction_date))}
        </span>
      ),
    },
    {
      key: 'gift_card_code',
      header: t('fields.giftCardCode'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="font-mono text-sm" dir="ltr">
          {row.gift_card_code}
        </span>
      ),
    },
    {
      key: 'card_name',
      header: t('fields.cardName'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="max-w-[160px] truncate block">{row.card_name}</span>
      ),
    },
    {
      key: 'transaction_type',
      header: tLog('fields.type'),
      render: (row: GiftCardTransactionLogRow) => (
        <Badge variant={TX_TYPE_BADGE[row.transaction_type]}>
          {tLog(`transactionType.${row.transaction_type}`)}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: t('fields.amount'),
      render: (row: GiftCardTransactionLogRow) => {
        const { text, className } = formatSignedAmount(row);
        return <span className={className}>{text}</span>;
      },
    },
    {
      key: 'balance_before',
      header: tLog('fields.balanceBefore'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="tabular-nums text-muted-foreground">{row.balance_before.toFixed(3)}</span>
      ),
    },
    {
      key: 'balance_after',
      header: tLog('fields.balanceAfter'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="tabular-nums font-medium">{row.balance_after.toFixed(3)}</span>
      ),
    },
    {
      key: 'order_id',
      header: tLog('fields.orderNo'),
      render: (row: GiftCardTransactionLogRow) =>
        row.order_id ? (
          <span className="font-mono text-xs text-muted-foreground">
            {row.order_id.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'idempotency_key',
      header: tLog('fields.idempotencyKey'),
      render: (row: GiftCardTransactionLogRow) =>
        row.idempotency_key ? (
          <span
            className="font-mono text-xs text-muted-foreground"
            title={row.idempotency_key}
          >
            {truncateMid(row.idempotency_key)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'notes',
      header: t('fields.notes'),
      render: (row: GiftCardTransactionLogRow) =>
        row.notes ? (
          <span className="max-w-[200px] truncate block text-sm">{row.notes}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'processed_by',
      header: tLog('fields.processedBy'),
      render: (row: GiftCardTransactionLogRow) => (
        <span className="text-sm text-muted-foreground">{row.processed_by ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Filters ---- */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap items-center">
          {/* Gift card code search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <CmxInput
              className="ps-8"
              placeholder={tLog('filterByCard')}
              value={cardCode}
              onChange={(e) => {
                setCardCode(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Date from */}
          <CmxInput
            type="date"
            className="w-auto"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label={tLog('fields.dateFrom')}
          />

          {/* Date to */}
          <CmxInput
            type="date"
            className="w-auto"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label={tLog('fields.dateTo')}
          />

          {/* Clear filters */}
          {hasActiveFilters && (
            <CmxButton variant="ghost" size="sm" onClick={handleClearFilters}>
              {tCommon('clearFilters')}
            </CmxButton>
          )}
        </div>

        {/* Transaction type filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {TX_TYPES.map((type) => (
            <CmxButton
              key={type}
              variant={transactionType === type ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleTypeToggle(type)}
            >
              {tLog(`transactionType.${type}`)}
            </CmxButton>
          ))}
        </div>
      </div>

      {/* ---- Error ---- */}
      {error && <CmxSummaryMessage type="error" title={tLog('errors.loadFailed')} items={[]} />}

      {/* ---- Table ---- */}
      <CmxDataTable
        isLoading={isLoading}
        columns={columns}
        data={rows}
        totalCount={total}
        currentPage={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyStateTitle={tLog('noTransactions')}
        emptyStateDescription={tLog('noTransactionsDesc')}
        emptyStateIcon={<Receipt className="h-8 w-8 text-muted-foreground" />}
        enableZebraStriping
      />
    </div>
  );
}
