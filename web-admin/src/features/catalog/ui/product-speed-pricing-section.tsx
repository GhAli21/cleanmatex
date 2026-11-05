'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, CmxButton, CmxCard, CmxCardContent, CmxCardDescription, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { useAuth } from '@/lib/auth/auth-context';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { SpeedRuleView } from '@/lib/services/catalog/speed-rules.service';
import { fetchSpeedRules, resolveSpeedRuleApi } from '../api/speed-rules-api';
import { useSpeedRuleLookups } from '../hooks/use-speed-rule-lookups';
import { useSpeedRuleValueText } from './speed-rule-parts';
import { SpeedRuleEditorDialog } from './speed-rule-editor-dialog';

/** A product rarely has more rules than this; the Speed Pricing screen lists them all. */
const PRODUCT_RULES_PAGE_SIZE = 50;

/**
 * The Speed pricing section of the product form (Line-Level P7-04, PLAN §11.1): the
 * price of this product at each speed and the rule behind it, and the product's own
 * rules with add and edit in place. It saves separately from the product form, so it
 * sits outside that form. Hidden without `pricing:read`.
 * @param props - the product's id and display name
 * @returns the section, or nothing without permission
 */
export function ProductSpeedPricingSection({ productId, productLabel }: { productId: string; productLabel: string }) {
  const t = useTranslations('catalog.speedPricing');
  const tProduct = useTranslations('catalog.speedPricing.product');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const { speedOptions, branchOptions, categoryOptions, speedLabel, branchLabel } = useSpeedRuleLookups();
  const valueText = useSpeedRuleValueText();
  const canRead = useHasPermissionCode(PRICING_PERMISSIONS.READ);
  const canCreate = useHasPermissionCode(PRICING_PERMISSIONS.CREATE);
  const canUpdate = useHasPermissionCode(PRICING_PERMISSIONS.UPDATE);
  const [editor, setEditor] = useState<{ rule?: SpeedRuleView } | null>(null);

  // Prevent the queries before the tenant is confirmed.
  const enabled = canRead && !!tenantId;
  const rules = useQuery({
    queryKey: ['speed-rules', 'list', tenantId, { productId }, 1, PRODUCT_RULES_PAGE_SIZE],
    queryFn: ({ signal }) => fetchSpeedRules({ productId }, 1, PRODUCT_RULES_PAGE_SIZE, signal),
    enabled,
  });
  const resolved = useQueries({
    queries: speedOptions.map((speed) => ({
      queryKey: ['speed-rules', 'resolve', tenantId, productId, speed.value],
      queryFn: () => resolveSpeedRuleApi({ serviceSpeed: speed.value, productId }),
      enabled,
    })),
  });

  if (!canRead) return null;

  const money = (amount: string) =>
    formatMoneyAmountWithCode(Number(amount), { currencyCode, decimalPlaces, locale: locale === 'ar' ? 'ar' : 'en' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['speed-rules'] });
  const failed = rules.isError || resolved.some((r) => r.isError);

  return (
    <CmxCard className="mt-5">
      <CmxCardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CmxCardTitle>{tProduct('title')}</CmxCardTitle>
            <CmxCardDescription>{tProduct('description')}</CmxCardDescription>
          </div>
          {canCreate ? (
            <CmxButton type="button" variant="outline" onClick={() => setEditor({})}>{t('addRule')}</CmxButton>
          ) : null}
        </div>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        {failed ? <p role="alert" className="text-sm text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">{t('errors.INTERNAL_ERROR')}</p> : null}

        <ul className="divide-y divide-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
          {speedOptions.map((speed, index) => {
            const answer = resolved[index]?.data;
            const linePremium = answer?.price && Number(answer.price.linePremium) > 0 ? answer.price.linePremium : null;
            return (
              <li key={speed.value} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{speed.label}</span>
                {!answer ? (
                  <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{resolved[index]?.isLoading ? tCommon('loading') : '—'}</span>
                ) : answer.winner && answer.price ? (
                  <span>
                    {money(answer.price.unitPrice)}
                    {linePremium ? ` ${tProduct('plusPerLine', { amount: money(linePremium) })}` : ''}
                    <span className="ms-2 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {tProduct('ruleSource', { level: t(`level.${answer.winner.level}`) })}
                    </span>
                  </span>
                ) : (
                  <span className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tProduct('noRule')}</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">{tProduct('rulesTitle')}</h4>
          {rules.isLoading ? <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tCommon('loading')}</p> : null}
          {rules.data?.rows.length === 0 ? <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tProduct('empty')}</p> : null}
          {rules.data?.rows.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-3 text-sm">
              <div className="space-y-0.5">
                <div className="font-medium">{speedLabel(rule.serviceSpeed)} · {valueText(rule)}</div>
                <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  {rule.branchId ? branchLabel(rule.branchId) : t('scope.allBranches')} · {rule.effectiveFrom} – {rule.effectiveTo ?? t('openEnded')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rule.isActive ? 'success' : 'secondary'}>{rule.isActive ? tCommon('active') : tCommon('inactive')}</Badge>
                {canUpdate ? (
                  <CmxButton type="button" variant="ghost" size="sm" onClick={() => setEditor({ rule })}>{tCommon('edit')}</CmxButton>
                ) : null}
              </div>
            </div>
          ))}
          <Link href="/dashboard/catalog/speed-pricing" className="inline-block text-sm text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:underline">
            {tProduct('openAll')}
          </Link>
        </div>
      </CmxCardContent>

      {editor ? (
        <SpeedRuleEditorDialog
          key={editor.rule?.id ?? 'create'}
          mode={editor.rule ? 'edit' : 'create'}
          rule={editor.rule}
          fixedProduct={{ id: productId, label: productLabel }}
          speedOptions={speedOptions}
          branchOptions={branchOptions}
          categoryOptions={categoryOptions}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void refresh();
          }}
        />
      ) : null}
    </CmxCard>
  );
}
