"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

interface PricePreviewProps {
  orderId: string;
  /** Increment to refetch preview after item/piece/preference changes */
  refreshNonce?: number;
}

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.refreshNonce
 */
export function PricePreview({ orderId, refreshNonce = 0 }: PricePreviewProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('workflow');
  const { formatMoneyWithCode } = useTenantCurrency();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ subtotal: number; tax: number; total: number; total_items: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/preparation/${orderId}/preview`);
        const json = await res.json();
        if (mounted && json.success) setData(json.data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId, refreshNonce]);

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 text-sm text-muted-foreground">
        {tCommon('loading')}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4" role="region" aria-label={t('preparation.pricePreview.regionAria')}>
      <div className="flex justify-between text-sm">
        <span>{t('preparation.pricePreview.items')}</span>
        <span>{data.total_items}</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span>{t('preparation.pricePreview.subtotal')}</span>
        <span>{formatMoneyWithCode(data.subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span>{t('preparation.pricePreview.tax')}</span>
        <span>{formatMoneyWithCode(data.tax)}</span>
      </div>
      <div className="flex justify-between text-sm mt-2 font-semibold">
        <span>{t('preparation.pricePreview.total')}</span>
        <span>{formatMoneyWithCode(data.total)}</span>
      </div>
    </div>
  );
}


