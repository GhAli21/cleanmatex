'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, Label } from '@ui/primitives';
import { CmxListOfValuesDialog } from '@ui/forms';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { PRICE_BASIS, SPEED_PRICE_TYPES } from '@/lib/constants/commercial';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { SpeedRuleView } from '@/lib/services/catalog/speed-rules.service';
import { fetchSpeedRuleProducts, type SpeedRuleProductOption } from '../api/speed-rules-api';

/** A chosen product: its id and the name the field shows. */
export interface PickedProduct {
  id: string;
  label: string;
}

const productLabel = (p: SpeedRuleProductOption, locale: string) =>
  (locale === 'ar' ? p.product_name2 || p.product_name : p.product_name || p.product_name2) ?? p.product_code;

/**
 * A field that opens the product list, searched on the server.
 * @param props - label, the chosen product, change handler, and an inline error
 * @returns the field and its picker
 */
export function SpeedRuleProductField({ label, value, onChange, error }: {
  label: string;
  value: PickedProduct | null;
  onChange: (product: PickedProduct | null) => void;
  error?: string;
}) {
  const t = useTranslations('catalog.speedPricing.productPicker');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const products = useQuery({
    queryKey: ['speed-rules', 'products', tenantId, search],
    queryFn: ({ signal }) => fetchSpeedRuleProducts(search, signal),
    // Prevent the query before the tenant is confirmed, and until the picker opens.
    enabled: open && !!tenantId,
  });

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <CmxButton type="button" variant="outline" className="w-full justify-start truncate" onClick={() => setOpen(true)}>
        {value?.label ?? t('choose')}
      </CmxButton>
      {error ? <p className="text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">{error}</p> : null}
      <CmxListOfValuesDialog
        open={open}
        onOpenChange={setOpen}
        options={products.data ?? []}
        selectedId={value?.id ?? null}
        onSearchChange={setSearch}
        onApply={(id) => {
          const picked = products.data?.find((p) => p.id === id);
          onChange(id && picked ? { id, label: productLabel(picked, locale) } : id ? value : null);
        }}
        getOptionId={(p) => p.id}
        getOptionLabel={(p) => productLabel(p, locale)}
        getOptionDescription={(p) => p.product_code}
        isLoading={products.isLoading}
        labels={{
          title: t('title'),
          searchLabel: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          loadingLabel: t('loading'),
          emptyLabel: t('empty'),
          clearLabel: t('clear'),
          cancelLabel: t('cancel'),
          applyLabel: t('apply'),
          optionsLabel: t('options'),
        }}
      />
    </div>
  );
}

/**
 * The rule's value in words: "Sell price 3.500 OMR", "+30%" or "+0.500 OMR per unit".
 * @returns a formatter for a rule's value
 */
export function useSpeedRuleValueText() {
  const t = useTranslations('catalog.speedPricing.valueText');
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const money = (amount: string | null) =>
    formatMoneyAmountWithCode(Number(amount ?? 0), { currencyCode, decimalPlaces, locale: locale === 'ar' ? 'ar' : 'en' });

  return (rule: SpeedRuleView) => {
    if (rule.speedPriceType === SPEED_PRICE_TYPES.SELL_PRICE) return t('sellPrice', { amount: money(rule.defaultSpeedSellPrice) });
    if (rule.speedPriceType === SPEED_PRICE_TYPES.MULTIPLIER) {
      const percent = new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', { style: 'percent', maximumFractionDigits: 2 });
      return t('multiplier', { percent: percent.format(Number(rule.multiplierSpeed ?? 0)) });
    }
    return rule.priceBasis === PRICE_BASIS.PER_LINE
      ? t('fixedPerLine', { amount: money(rule.speedExtraAmount) })
      : t('fixedPerUnit', { amount: money(rule.speedExtraAmount) });
  };
}

/**
 * What a rule covers, in words: the product or category, and the branch.
 * @param props - the rule and how to name its category and branch
 * @returns the scope text
 */
export function SpeedRuleScopeText({ rule, categoryLabel, branchLabel }: {
  rule: SpeedRuleView;
  categoryLabel: (code: string) => string;
  branchLabel: (id: string) => string;
}) {
  const t = useTranslations('catalog.speedPricing');
  const locale = useLocale();
  const product = (locale === 'ar' ? rule.productName2 || rule.productName : rule.productName || rule.productName2) ?? rule.productId;
  const main = rule.productId ? product : rule.serviceCategoryCode ? categoryLabel(rule.serviceCategoryCode) : t('scope.allProducts');
  return (
    <div className="space-y-0.5">
      <div className="font-medium">{main}</div>
      <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {t(`level.${rule.level}`)} · {rule.branchId ? branchLabel(rule.branchId) : t('scope.allBranches')}
      </div>
    </div>
  );
}
