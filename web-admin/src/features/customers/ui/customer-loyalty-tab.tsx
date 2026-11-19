'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Customer Loyalty Tab
 *
 * B19 follow-up (2026-09-17) — replaces the hardcoded balance + static
 * "No transactions yet" placeholder previously duplicated in both
 * app/dashboard/customers/[id]/page.tsx and app/dashboard/b2b/customers/[id]/page.tsx
 * with one real, API-backed component: points balance, tier, upcoming-expiry
 * warning (FIFO lot-based), and transaction history.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxSkeleton } from '@ui/primitives';

import { cmxMessage, CmxStatusBadge } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import {
  getCustomerLoyaltyDetail,
  type CustomerLoyaltyDetail,
} from '@/app/actions/customers/loyalty-actions';

interface Props {
  customerId: string;
}

const TXN_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  EARN: 'success',
  BONUS: 'success',
  REDEEM: 'info',
  ADJUST: 'neutral',
  EXPIRE: 'danger',
};

/**
 *
 * @param root0
 * @param root0.customerId
 */
export function CustomerLoyaltyTab({ customerId }: Props) {
  const t = useTranslations('customers.loyaltyPanel');
  const locale = useLocale();

  const [detail, setDetail] = useState<CustomerLoyaltyDetail | null>(null);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getCustomerLoyaltyDetail(customerId);
    if (result.success && result.data) {
      setDetail(result.data);
    } else {
      cmxMessage.error(result.error || t('loadFailed'));
    }
    setLoading(false);
  }, [customerId, t]);

  useEffect(() => { void load(); }, [load]);

  const formatDate = (value: string | Date) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  const txnTypeLabel = (type: string) => {
    const tRaw = t as unknown as (key: string) => string;
    const key = `txnType.${type}`;
    const resolved = tRaw(key);
    return resolved !== key ? resolved : type;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <CmxSkeleton className="h-24" />
          <CmxSkeleton className="h-24" />
          <CmxSkeleton className="h-24" />
        </div>
        <CmxSkeleton className="h-64" />
      </div>
    );
  }

  const account = detail?.account ?? null;
  const transactions = detail?.transactions ?? [];
  const expirySummary = detail?.expirySummary ?? null;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground text-start">
        {t('title')}
      </h3>

      {!account ? (
        <div className="rounded-lg bg-muted py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('noAccount')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('pointsBalance')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-3xl font-bold text-foreground">{account.pointsBalance.toLocaleString()}</p>
              </CmxCardContent>
            </CmxCard>
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('lifetimeEarned')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-3xl font-bold text-foreground">{account.lifetimeEarned.toLocaleString()}</p>
              </CmxCardContent>
            </CmxCard>
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('currentTier')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-lg font-semibold text-foreground">
                  {detail?.tier ? (locale === 'ar' ? detail.tier.tierName2 ?? detail.tier.tierName : detail.tier.tierName) : t('noTier')}
                </p>
              </CmxCardContent>
            </CmxCard>
          </div>

          {(expirySummary?.expiredUnappliedPoints ?? 0) > 0 && (
            <CmxSummaryMessage type="error">
              <div>
                {t('expiredUnapplied', { points: expirySummary?.expiredUnappliedPoints ?? 0 })}
              </div>
            </CmxSummaryMessage>
          )}

          {expirySummary?.nextExpiry && (
            <CmxSummaryMessage type="warning">
              <div>
                {expirySummary.expiringWithin30Days > expirySummary.nextExpiry.points
                  ? t('expiryWarningMultiple', { points: expirySummary.expiringWithin30Days })
                  : t('expiryWarning', {
                      points: expirySummary.nextExpiry.points,
                      date: formatDate(expirySummary.nextExpiry.expiresAt),
                    })}
              </div>
            </CmxSummaryMessage>
          )}

          <CmxCard>
            <CmxCardHeader className="pb-2">
              <CmxCardTitle className="text-base">{t('historyTitle')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="mb-2 text-muted-foreground">{t('noTransactions')}</p>
                  <p className="text-sm text-muted-foreground">{t('noTransactionsHint')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-start">{t('columns.date')}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-start">{t('columns.type')}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-end">{t('columns.points')}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-end">{t('columns.balanceAfter')}</th>
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-start">{t('columns.reference')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3 text-sm text-foreground text-start">
                            {formatDateTime(row.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-start">
                            <CmxStatusBadge size="sm" tone={TXN_BADGE_VARIANT[row.txnType] ?? 'neutral'}>
                              {txnTypeLabel(row.txnType)}
                            </CmxStatusBadge>
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium tabular-nums ${row.points >= 0 ? 'text-success-text' : 'text-danger-text'} text-end`}>
                            {row.points >= 0 ? '+' : ''}{row.points.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums text-foreground text-end">
                            {row.pointsAfter.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground text-start">
                            {row.notes || row.orderId || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CmxCardContent>
          </CmxCard>
        </>
      )}
    </div>
  );
}
