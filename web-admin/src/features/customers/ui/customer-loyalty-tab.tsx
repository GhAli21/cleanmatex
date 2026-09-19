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
import { Badge } from '@ui/primitives/badge';
import { Alert, AlertDescription } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  getCustomerLoyaltyDetail,
  type CustomerLoyaltyDetail,
} from '@/app/actions/customers/loyalty-actions';

interface Props {
  customerId: string;
}

const TXN_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  EARN: 'success',
  BONUS: 'success',
  REDEEM: 'info',
  ADJUST: 'secondary',
  EXPIRE: 'destructive',
};

/**
 *
 * @param root0
 * @param root0.customerId
 */
export function CustomerLoyaltyTab({ customerId }: Props) {
  const t = useTranslations('customers.loyaltyPanel');
  const locale = useLocale();
  const isRTL = useRTL();

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
      <h3 className={`text-lg font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('title')}
      </h3>

      {!account ? (
        <div className="rounded-lg bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-500">{t('noAccount')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('pointsBalance')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-3xl font-bold text-gray-900">{account.pointsBalance.toLocaleString()}</p>
              </CmxCardContent>
            </CmxCard>
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('lifetimeEarned')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-3xl font-bold text-gray-900">{account.lifetimeEarned.toLocaleString()}</p>
              </CmxCardContent>
            </CmxCard>
            <CmxCard>
              <CmxCardHeader className="pb-2">
                <CmxCardTitle className="text-base">{t('currentTier')}</CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <p className="text-lg font-semibold text-gray-900">
                  {detail?.tier ? (locale === 'ar' ? detail.tier.tierName2 ?? detail.tier.tierName : detail.tier.tierName) : t('noTier')}
                </p>
              </CmxCardContent>
            </CmxCard>
          </div>

          {(expirySummary?.expiredUnappliedPoints ?? 0) > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('expiredUnapplied', { points: expirySummary?.expiredUnappliedPoints ?? 0 })}
              </AlertDescription>
            </Alert>
          )}

          {expirySummary?.nextExpiry && (
            <Alert variant="warning">
              <AlertDescription>
                {expirySummary.expiringWithin30Days > expirySummary.nextExpiry.points
                  ? t('expiryWarningMultiple', { points: expirySummary.expiringWithin30Days })
                  : t('expiryWarning', {
                      points: expirySummary.nextExpiry.points,
                      date: formatDate(expirySummary.nextExpiry.expiresAt),
                    })}
              </AlertDescription>
            </Alert>
          )}

          <CmxCard>
            <CmxCardHeader className="pb-2">
              <CmxCardTitle className="text-base">{t('historyTitle')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="mb-2 text-gray-500">{t('noTransactions')}</p>
                  <p className="text-sm text-gray-400">{t('noTransactionsHint')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t('columns.date')}</th>
                        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t('columns.type')}</th>
                        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.points')}</th>
                        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-left' : 'text-right'}`}>{t('columns.balanceAfter')}</th>
                        <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t('columns.reference')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transactions.map((row) => (
                        <tr key={row.id}>
                          <td className={`px-4 py-3 text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {formatDateTime(row.createdAt)}
                          </td>
                          <td className={`px-4 py-3 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                            <Badge variant={TXN_BADGE_VARIANT[row.txnType] ?? 'secondary'}>
                              {txnTypeLabel(row.txnType)}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium tabular-nums ${row.points >= 0 ? 'text-green-700' : 'text-red-600'} ${isRTL ? 'text-left' : 'text-right'}`}>
                            {row.points >= 0 ? '+' : ''}{row.points.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 text-sm tabular-nums text-gray-700 ${isRTL ? 'text-left' : 'text-right'}`}>
                            {row.pointsAfter.toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
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
