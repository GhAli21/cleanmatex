'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { CmxSummaryMessage } from '@ui/feedback';
import { SpeedRulesApiError, resolveSpeedRuleApi } from '../api/speed-rules-api';
import { SpeedRuleProductField, SpeedRuleScopeText, useSpeedRuleValueText, type PickedProduct } from './speed-rule-parts';

type Option = { value: string; label: string };

/**
 * "Which rule applies?": runs the calculator's own selection for one product (or
 * category), branch and date, and lists every rule that matched, the winner first.
 * @param props - the menu options and how to name a category and branch
 * @returns the panel
 */
export function SpeedRuleResolverPanel({ speedOptions, branchOptions, categoryOptions, categoryLabel, branchLabel }: {
  speedOptions: Option[];
  branchOptions: Option[];
  categoryOptions: Option[];
  categoryLabel: (code: string) => string;
  branchLabel: (id: string) => string;
}) {
  const t = useTranslations('catalog.speedPricing');
  const valueText = useSpeedRuleValueText();
  const [speedChoice, setSpeedChoice] = useState('');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [categoryCode, setCategoryCode] = useState('');
  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const serviceSpeed = speedChoice || speedOptions[0]?.value || '';

  const resolve = useMutation({
    mutationFn: () => resolveSpeedRuleApi({
      serviceSpeed,
      productId: product?.id,
      serviceCategoryCode: product ? undefined : categoryCode || undefined,
      branchId: branchId || undefined,
      date,
    }),
  });
  const result = resolve.data;
  const errorCode = resolve.error instanceof SpeedRulesApiError ? resolve.error.code : 'INTERNAL_ERROR';

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('resolver.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <CmxSelect label={t('fields.speed')} options={speedOptions} value={serviceSpeed} onChange={(e) => setSpeedChoice(e.target.value)} />
          <SpeedRuleProductField label={t('fields.product')} value={product} onChange={setProduct} />
          <CmxSelect
            label={t('fields.category')}
            options={[{ value: '', label: t('scope.anyCategory') }, ...categoryOptions]}
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            disabled={!!product}
            helpText={product ? t('resolver.categoryFromProduct') : undefined}
          />
          <CmxSelect
            label={t('fields.branch')}
            options={[{ value: '', label: t('scope.anyBranch') }, ...branchOptions]}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
          <CmxInput label={t('resolver.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <CmxButton type="button" onClick={() => resolve.mutate()} loading={resolve.isPending} disabled={!serviceSpeed || !date}>
          {t('resolver.check')}
        </CmxButton>

        {resolve.isError ? (
          <CmxSummaryMessage type="error" title={t('errors.title')} items={[t.has(`errors.${errorCode}`) ? t(`errors.${errorCode}` as never) : t('errors.INTERNAL_ERROR')]} />
        ) : null}

        {result ? (
          <div className="space-y-2" aria-live="polite">
            {result.winner ? null : <CmxSummaryMessage type="info" title={t('resolver.noRuleTitle')} items={[t('resolver.noRule')]} />}
            {result.matched.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3 text-sm">
                <SpeedRuleScopeText rule={rule} categoryLabel={categoryLabel} branchLabel={branchLabel} />
                <div className="flex items-center gap-2">
                  <span>{valueText(rule)}</span>
                  <Badge variant={rule.id === result.winner?.id ? 'success' : 'outline'}>
                    {rule.id === result.winner?.id ? t('resolver.applies') : t('resolver.overridden')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CmxCardContent>
    </CmxCard>
  );
}
