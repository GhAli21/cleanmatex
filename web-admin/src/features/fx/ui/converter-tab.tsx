'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft, Calculator } from 'lucide-react';
import { CmxButton, CmxInput } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { CmxSummaryMessage } from '@ui/feedback';
import { cmxMessage } from '@ui/feedback';
import { convertAmountAction, type ConvertAmountResult } from '@/app/actions/fx/converter-actions';
import { getCurrencyPortfolio } from '@/app/actions/fx/currency-actions';
import { resolveFxErrorMessage } from '../lib/resolve-error-message';

export function ConverterTab() {
  const t = useTranslations('currencyFx');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('currencyFx.errors');
  const [isPending, startTransition] = useTransition();

  const [currencyCodes, setCurrencyCodes] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('1');
  const [result, setResult] = useState<ConvertAmountResult | null>(null);

  useEffect(() => {
    void (async () => {
      const portfolio = await getCurrencyPortfolio();
      if (portfolio.success && portfolio.data) {
        const codes = portfolio.data.map((c) => c.currencyCode);
        setCurrencyCodes(codes);
        if (codes.length >= 2) {
          setFrom(codes.find((c) => !portfolio.data!.find((p) => p.currencyCode === c)?.isBaseCurrency) ?? codes[0]);
          setTo(portfolio.data.find((p) => p.isBaseCurrency)?.currencyCode ?? codes[1]);
        } else if (codes.length === 1) {
          setFrom(codes[0]);
          setTo(codes[0]);
        }
      }
    })();
  }, []);

  const handleConvert = () => {
    if (!from || !to || !amount) return;
    startTransition(async () => {
      const res = await convertAmountAction({ fromCurrency: from, toCurrency: to, amount });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setResult(null);
        cmxMessage.error(resolveFxErrorMessage(tErrors, res.errorCode, res.error ?? tCommon('error')));
      }
    });
  };

  return (
    <CmxCard className="max-w-xl">
      <CmxCardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">{t('converter.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('converter.description')}</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label className="text-sm font-medium">{t('converter.from')}</label>
            <CmxSelectDropdown value={from} onValueChange={setFrom}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {currencyCodes.map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>{code}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
          <ArrowRightLeft className="mb-2 h-4 w-4 text-muted-foreground rtl:rotate-180" />
          <div>
            <label className="text-sm font-medium">{t('converter.to')}</label>
            <CmxSelectDropdown value={to} onValueChange={setTo}>
              <CmxSelectDropdownTrigger><CmxSelectDropdownValue /></CmxSelectDropdownTrigger>
              <CmxSelectDropdownContent>
                {currencyCodes.map((code) => (
                  <CmxSelectDropdownItem key={code} value={code}>{code}</CmxSelectDropdownItem>
                ))}
              </CmxSelectDropdownContent>
            </CmxSelectDropdown>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t('converter.amount')}</label>
          <CmxInput value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
        </div>

        <CmxButton onClick={handleConvert} disabled={isPending || !from || !to}>
          {isPending ? t('converter.converting') : t('converter.convert')}
        </CmxButton>

        {result && (
          <div className="space-y-2 rounded-md border p-4">
            <p className="text-2xl font-semibold font-mono">{result.convertedAmount} {to}</p>
            <p className="text-sm text-muted-foreground">
              {t('converter.rateInfo', { from, rate: result.rate, to })}
              {result.book && ` · ${t(`converter.resolvedFrom.${result.book}` as Parameters<typeof t>[0])}`}
            </p>
            {result.stale && <CmxSummaryMessage type="warning" title={t('converter.staleWarning')} items={[]} />}
          </div>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}
