'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Tenant Currency & FX screen (Tenant_Currency_FX plan 01 §7.2): progressive
 * disclosure between a compact single-currency view and the full
 * Currencies/Rates/Import/Converter/Settings tab set.
 */
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Coins } from 'lucide-react';
import { CmxTabsPanel } from '@ui/navigation';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';
import { useFeature } from '@/lib/hooks/use-feature-flags';
import { getCurrencyPortfolio } from '@/app/actions/fx/currency-actions';
import { getRates } from '@/app/actions/fx/rate-actions';
import { CurrenciesTab } from './currencies-tab';
import { RatesTab } from './rates-tab';
import { ImportTab } from './import-tab';
import { ConverterTab } from './converter-tab';
import { SettingsTab } from './settings-tab';
import { CurrencyFormDialog } from './currency-form-dialog';
import type { CurrencyPortfolioRow, FxRateRow } from '@/lib/types/currency-fx';

export function CurrencyFxScreen() {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const [, startTransition] = useTransition();
  const multiCurrencyAllowed = useFeature('multi_currency_fx');

  const [currencies, setCurrencies] = useState<CurrencyPortfolioRow[]>([]);
  const [rates, setRates] = useState<FxRateRow[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadCurrencies = () => {
    setCurrenciesLoading(true);
    startTransition(async () => {
      const result = await getCurrencyPortfolio();
      setCurrenciesLoading(false);
      if (result.success && result.data) setCurrencies(result.data);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  const loadRates = () => {
    setRatesLoading(true);
    startTransition(async () => {
      const result = await getRates();
      setRatesLoading(false);
      if (result.success && result.data) setRates(result.data.rows);
      else if (!result.success) cmxMessage.error(result.error ?? tCommon('error'));
    });
  };

  useEffect(() => {
    loadCurrencies();
    loadRates();
  }, []);

  const base = currencies.find((c) => c.isBaseCurrency);
  const isMultiCurrency = currencies.filter((c) => c.isActive).length > 1;

  if (currenciesLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>
      </div>
    );
  }

  if (!isMultiCurrency) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <CmxCard className="max-w-xl">
          <CmxCardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('compact.baseCurrencyLabel')}</span>
              <span className="font-mono text-lg font-semibold">{base?.currencyCode ?? '—'}</span>
            </div>
            <Badge variant={base?.baseLockedAt ? 'secondary' : 'outline'}>
              {base?.baseLockedAt ? t('compact.locked') : t('compact.notLocked')}
            </Badge>
            <div className="border-t pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{t('compact.multiCurrencyLabel')}</span>
                <Badge variant="outline">{t('compact.off')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('compact.description')}</p>
              {multiCurrencyAllowed ? (
                <CmxButton className="mt-3" onClick={() => setShowAddDialog(true)}>
                  {t('compact.enableCta')}
                </CmxButton>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{t('compact.flagUnavailable')}</p>
              )}
            </div>
          </CmxCardContent>
        </CmxCard>
        <CurrencyFormDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => { setShowAddDialog(false); loadCurrencies(); }}
        />
      </div>
    );
  }

  const tabs = [
    {
      id: 'currencies',
      label: t('tabs.currencies'),
      content: <CurrenciesTab currencies={currencies} isLoading={currenciesLoading} onRefresh={loadCurrencies} />,
    },
    {
      id: 'rates',
      label: t('tabs.rates'),
      content: <RatesTab rates={rates} isLoading={ratesLoading} onRefresh={loadRates} />,
    },
    {
      id: 'import',
      label: t('tabs.import'),
      content: <ImportTab onImported={loadRates} />,
    },
    {
      id: 'converter',
      label: t('tabs.converter'),
      content: <ConverterTab />,
    },
    {
      id: 'settings',
      label: t('tabs.settings'),
      content: <SettingsTab />,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Coins className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>
      <CmxTabsPanel tabs={tabs} />
    </div>
  );
}
