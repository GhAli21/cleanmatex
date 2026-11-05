'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { OrderFinancialView } from '@/lib/types/order-fin-view';
import { CmxMoneyText, type CmxMoneyTextProps } from '@ui/data-display';

type MoneyOptions = Pick<CmxMoneyTextProps, 'sign' | 'tone' | 'struck' | 'size' | 'className' | 'hideCode'>;

/**
 * Money renderer bound to the view's own currency (BF-18: the order currency,
 * never the tenant default) and the viewer's locale.
 * @param view - the view whose currency formats every amount
 * @returns `money(amount, options)` → a `CmxMoneyText` element
 */
export function useFinMoney(view: Pick<OrderFinancialView, 'currency'>) {
  const locale = useLocale();
  const t = useTranslations('orders.finView');
  const { code, decimalPlaces } = view.currency;
  return useCallback(
    (amount: number | null | undefined, options: MoneyOptions = {}) => (
      <CmxMoneyText
        amount={amount ?? null}
        currencyCode={code}
        decimalPlaces={decimalPlaces}
        locale={locale === 'ar' ? 'ar' : 'en'}
        signLabels={{ plus: t('sign.plus'), minus: t('sign.minus') }}
        unknownCurrencyLabel={t('banners.currencyUnknown')}
        {...options}
      />
    ),
    [code, decimalPlaces, locale, t],
  );
}
