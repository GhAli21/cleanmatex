'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertCircle, WalletCards } from 'lucide-react';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxTextarea } from '@ui/primitives/cmx-textarea';
import { Badge } from '@ui/primitives/badge';
import { CmxStatusBadge } from '@ui/feedback';
import {
  buildCashDrawerClosePreview,
  fetchCashDrawerSessionCloseSummary,
} from '@features/cash-drawers/api/cash-drawer-api';

interface PosSessionDrawerCloseSummaryProps {
  open: boolean;
  drawerId: string | null | undefined;
  drawerName: string | null | undefined;
  drawerSessionId: string | null | undefined;
  drawerSessionNo: string | null | undefined;
  drawerStatus: string | null | undefined;
  canViewCashDrawer: boolean;
  countedCash: string;
  notes: string;
  onCountedCashChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

export function PosSessionDrawerCloseSummary({
  open,
  drawerId,
  drawerName,
  drawerSessionId,
  drawerSessionNo,
  drawerStatus,
  canViewCashDrawer,
  countedCash,
  notes,
  onCountedCashChange,
  onNotesChange,
}: PosSessionDrawerCloseSummaryProps) {
  const t = useTranslations('posSessions');

  const summaryQuery = useQuery({
    queryKey: ['cash-drawers', drawerId ?? 'none', 'sessions', drawerSessionId ?? 'none', 'close-summary'],
    enabled: open && canViewCashDrawer && !!drawerId && !!drawerSessionId,
    queryFn: () => fetchCashDrawerSessionCloseSummary(drawerId!, drawerSessionId!),
  });

  const preview = summaryQuery.data ? buildCashDrawerClosePreview(summaryQuery.data, countedCash) : null;
  const currencyCode = preview?.currencyCode ?? summaryQuery.data?.session.currency_code ?? '';
  const countedValue = preview?.countedCash == null ? t('drawerClose.notCountedYet') : formatMoney(preview.countedCash, currencyCode);
  const variance = preview?.variance ?? null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {t('drawerCloseDescription')}
      </p>

      <div className="rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              <WalletCards className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{drawerName ?? t('hub.drawerNotLinked')}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="outline">{drawerSessionNo ?? drawerSessionId ?? t('none')}</Badge>
              {drawerStatus ? <CmxStatusBadge label={drawerStatus} variant={drawerStatus === 'OPEN' ? 'success' : 'outline'} size="sm" /> : null}
              {currencyCode ? <Badge variant="secondary">{currencyCode}</Badge> : null}
            </div>
          </div>
          {summaryQuery.data?.session.opened_at ? (
            <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('openedAt')}: {formatDateTime(summaryQuery.data.session.opened_at)}
            </div>
          ) : null}
        </div>
      </div>

      {!canViewCashDrawer ? (
        <InlineNotice>{t('hub.drawerRestricted')}</InlineNotice>
      ) : summaryQuery.isLoading ? (
        <InlineNotice>{t('drawerClose.summaryLoading')}</InlineNotice>
      ) : summaryQuery.isError ? (
        <InlineNotice tone="warning">{t('drawerClose.summaryUnavailable')}</InlineNotice>
      ) : preview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <CloseMetric label={t('drawerClose.openingFloat')} value={formatMoney(preview.openingFloat, currencyCode)} />
            <CloseMetric label={t('drawerClose.cashCollected')} value={formatMoney(preview.cashCollected, currencyCode)} />
            <CloseMetric label={t('drawerClose.expectedCash')} value={formatMoney(preview.expectedCash, currencyCode)} strong />
            <CloseMetric label={t('drawerClose.countedCashPreview')} value={countedValue} strong />
            <CloseMetric label={t('drawerClose.paymentRows')} value={String(preview.paymentCount)} />
            <CloseMetric label={t('drawerClose.movementRows')} value={String(preview.movementCount)} />
          </div>

          <div className="rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('drawerClose.movementContext')}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <CompactMetric label={t('drawerClose.cashInMovements')} value={formatMoney(preview.movementCashIn, currencyCode)} />
              <CompactMetric label={t('drawerClose.cashOutMovements')} value={formatMoney(preview.movementCashOut, currencyCode)} />
              <CompactMetric label={t('drawerClose.netMovements')} value={formatSignedMoney(preview.movementNet, currencyCode)} />
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('drawerClose.movementContextHelp')}
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('drawerClose.expectedCashHelp')}
            </p>
          </div>

          {variance != null ? (
            <div className={varianceNoticeClass(variance)}>
              <span className="font-semibold">{t('drawerClose.variance')}:</span>{' '}
              {formatSignedMoney(variance, currencyCode)}
            </div>
          ) : null}
        </>
      ) : null}

      <CmxInput
        label={t('countedCash')}
        type="number"
        min="0"
        step="0.001"
        value={countedCash}
        onChange={(event) => onCountedCashChange(event.target.value)}
      />
      <CmxTextarea
        value={notes}
        placeholder={variance != null && Math.abs(variance) >= 0.01 ? t('drawerClose.notesVariancePlaceholder') : t('notes')}
        onChange={(event) => onNotesChange(event.target.value)}
      />
    </div>
  );
}

function CloseMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className={strong ? 'mt-1 text-base font-bold' : 'mt-1 text-sm font-semibold'}>{value}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function InlineNotice({ children, tone = 'info' }: { children: string; tone?: 'info' | 'warning' }) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-sky-200 bg-sky-50 text-sky-950';

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${toneClass}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function varianceNoticeClass(variance: number): string {
  if (Math.abs(variance) < 0.01) {
    return 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950';
  }
  return 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950';
}

function formatMoney(amount: number, currencyCode: string | null | undefined): string {
  return `${amount.toFixed(3)} ${currencyCode ?? ''}`.trim();
}

function formatSignedMoney(amount: number, currencyCode: string | null | undefined): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatMoney(amount, currencyCode)}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
