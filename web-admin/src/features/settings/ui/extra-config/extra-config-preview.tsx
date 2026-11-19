'use client';

/**
 * Live GCC Formatting & Ergonomics Preview Card.
 * Reflects unsaved draft edits immediately so admins see exact digits, dates,
 * `<bdi>` phone/code isolation, currency code toggle, and POS target sizing
 * before committing changes.
 *
 * @module features/settings/ui/extra-config/extra-config-preview
 */

import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Eye, Hash, Phone, Rows3, Touchpad } from 'lucide-react';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { CmxStatusBadge } from '@ui/feedback';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmount, formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { formatDate } from '@/lib/utils/rtl';
import {
  EXTRA_CONFIG_KEYS,
  NUMBER_GROUPING_LOCALES,
  NUMBER_SCRIPTS,
  POS_STEPPER_MIN_TARGETS,
  TABLE_DENSITY_OVERRIDES,
  type NumberGroupingLocale,
  type NumberScript,
} from '@/lib/constants/tenant-extra-config';

interface ExtraConfigPreviewProps {
  draftValues: Record<string, string>;
}

/**
 * Side/top preview showing live number, date, BiDi, currency-table, and POS ergonomics output.
 */
export function ExtraConfigPreview({ draftValues }: ExtraConfigPreviewProps) {
  const t = useTranslations('settings.extraConfig.preview');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const { currencyCode, decimalPlaces } = useTenantCurrency();

  const sampleCurrency = currencyCode || 'OMR';
  const sampleDecimals = decimalPlaces ?? 3;

  const numberScript = (
    draftValues[EXTRA_CONFIG_KEYS.NUMBER_SCRIPT] === NUMBER_SCRIPTS.ARAB
      ? NUMBER_SCRIPTS.ARAB
      : NUMBER_SCRIPTS.LATN
  ) as NumberScript;

  const dateDigits = (
    draftValues[EXTRA_CONFIG_KEYS.DATE_DIGITS] === NUMBER_SCRIPTS.ARAB
      ? NUMBER_SCRIPTS.ARAB
      : NUMBER_SCRIPTS.LATN
  ) as NumberScript;

  const groupingLocale = (
    draftValues[EXTRA_CONFIG_KEYS.NUMBER_GROUPING_LOCALE] === NUMBER_GROUPING_LOCALES.AR_LATN
      ? NUMBER_GROUPING_LOCALES.AR_LATN
      : draftValues[EXTRA_CONFIG_KEYS.NUMBER_GROUPING_LOCALE] === NUMBER_GROUPING_LOCALES.AR_NATIVE
        ? NUMBER_GROUPING_LOCALES.AR_NATIVE
        : NUMBER_GROUPING_LOCALES.EN_US
  ) as NumberGroupingLocale;

  const showCurrencyInTables =
    draftValues[EXTRA_CONFIG_KEYS.SHOW_CURRENCY_CODE_IN_TABLES] !== 'FALSE';
  const bdiEnabled = draftValues[EXTRA_CONFIG_KEYS.BDI_ISOLATION_ENABLED] !== 'FALSE';
  const pageSize = draftValues[EXTRA_CONFIG_KEYS.DEFAULT_TABLE_PAGE_SIZE] || '10';
  const density =
    draftValues[EXTRA_CONFIG_KEYS.TABLE_DENSITY_OVERRIDE] || TABLE_DENSITY_OVERRIDES.INHERIT;
  const posTarget =
    draftValues[EXTRA_CONFIG_KEYS.POS_STEPPER_MIN_TARGET] || POS_STEPPER_MIN_TARGETS.ADAPTIVE;

  const formattedAmount = showCurrencyInTables
    ? formatMoneyAmountWithCode(1234.5, {
        currencyCode: sampleCurrency,
        decimalPlaces: sampleDecimals,
        locale,
        numberScript,
        groupingLocale,
      })
    : formatMoneyAmount(1234.5, {
        currencyCode: '',
        decimalPlaces: sampleDecimals,
        locale,
        numberScript,
        groupingLocale,
      });

  const sampleDate = formatDate(new Date('2026-11-19T14:30:00Z'), undefined, locale, dateDigits);
  const samplePhone = '+968 9123 4567';
  const sampleOrderNo = 'ORD-2026-0042';

  return (
    <CmxCard className="border-primary/25 bg-card">
      <CmxCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary-text" aria-hidden />
            <CmxCardTitle className="text-base">{t('title')}</CmxCardTitle>
          </div>
          <CmxStatusBadge size="sm" tone="info" label={t('liveBadge')} />
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </CmxCardHeader>
      <CmxCardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Hash className="h-3.5 w-3.5" aria-hidden />
            <span>{t('moneySample')}</span>
          </div>
          <p className="mt-1.5 text-base font-semibold tabular-nums text-foreground">
            {bdiEnabled ? <bdi dir="ltr">{formattedAmount}</bdi> : formattedAmount}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            <span>{t('dateSample')}</span>
          </div>
          <p className="mt-1.5 text-sm font-medium tabular-nums text-foreground">{sampleDate}</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            <span>{t('codeAndPhoneSample')}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono text-foreground">
            <span>{bdiEnabled ? <bdi dir="ltr">{samplePhone}</bdi> : samplePhone}</span>
            <span className="text-muted-foreground">·</span>
            <span>{bdiEnabled ? <bdi dir="ltr">{sampleOrderNo}</bdi> : sampleOrderNo}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Rows3 className="h-3.5 w-3.5" aria-hidden />
            <span>{t('layoutSample')}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-foreground">
            <span className="font-medium tabular-nums">{t('rowsLabel', { count: pageSize })}</span>
            <span className="text-muted-foreground">·</span>
            <span>{density}</span>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1">
              <Touchpad className="h-3 w-3" aria-hidden />
              {posTarget === POS_STEPPER_MIN_TARGETS.ALWAYS_TOUCH_44 ? '44px' : '32/44px'}
            </span>
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
