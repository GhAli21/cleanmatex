'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import type { MoneyPosition } from '@/lib/services/reports/finance-money-position.service';

/**
 * Money-position glance row for the financial reports hub: today's canonical
 * collections (by method), orders + AR outstanding, stored-value liability,
 * and open drawer sessions. Read-only; every figure comes from
 * `/api/v1/finance/reports/money-position` over the canonical ledgers.
 */
export function MoneyPositionCardsRprt() {
  const t = useTranslations('reports.moneyPosition');
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = isRTL ? 'ar' : 'en';
  const [data, setData] = useState<MoneyPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fmt = useCallback(
    (n: number) =>
      formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale }),
    [currencyCode, decimalPlaces, moneyLocale],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/finance/reports/money-position', {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body.data as MoneyPosition);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="status">
        {t('loadError')}
      </p>
    );
  }

  const cards: Array<{ key: string; label: string; value: string; hint?: string }> = data
    ? [
        {
          key: 'today',
          label: t('todayCollections'),
          value: fmt(data.todayCollections.total),
          hint:
            data.todayCollections.byMethod.length > 0
              ? data.todayCollections.byMethod
                  .slice(0, 3)
                  .map((m) => `${m.methodName}: ${fmt(m.amount)}`)
                  .join(' · ')
              : t('noCollectionsYet'),
        },
        {
          key: 'ordersOutstanding',
          label: t('ordersOutstanding'),
          value: fmt(data.ordersOutstanding),
        },
        { key: 'arOutstanding', label: t('arOutstanding'), value: fmt(data.arOutstanding) },
        {
          key: 'storedValue',
          label: t('storedValueLiability'),
          value: fmt(data.storedValueLiability),
          hint: t('storedValueHint'),
        },
        {
          key: 'drawers',
          label: t('openDrawerSessions'),
          value: String(data.openDrawerSessions),
        },
      ]
    : [];

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
      aria-busy={data === null}
    >
      {data === null
        ? Array.from({ length: 5 }).map((_, i) => (
            <CmxCard key={i}>
              <CmxCardContent>
                <div className="h-14 animate-pulse rounded bg-muted" />
              </CmxCardContent>
            </CmxCard>
          ))
        : cards.map((card) => (
            <CmxCard key={card.key}>
              <CmxCardHeader>
                <CmxCardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <div className="text-2xl font-bold tabular-nums">{card.value}</div>
                {card.hint && (
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={card.hint}>
                    {card.hint}
                  </p>
                )}
              </CmxCardContent>
            </CmxCard>
          ))}
    </div>
  );
}
