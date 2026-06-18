'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ChevronDown } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { TenantSettings } from './TenantSettings';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';
import { useFeature } from '@/src/features/auth/ui/RequireFeature';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';

interface PricingModes {
  tax_pricing_mode: TaxPricingMode;
  extra_price_pricing_mode: ExtraPricePricingMode;
}

/**
 *
 */
export function TenantSettingsScreen() {
  const t = useTranslations('settings');
  const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING);
  const [modes, setModes] = React.useState<PricingModes>({
    tax_pricing_mode: TAX_PRICING_MODES.TAX_EXCLUSIVE,
    extra_price_pricing_mode: EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE,
  });
  const [draft, setDraft] = React.useState<PricingModes>(modes);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/tenants/me');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load tenant');
      const tenant = json.data;
      const next: PricingModes = {
        tax_pricing_mode:
          tenant.tax_pricing_mode ?? TAX_PRICING_MODES.TAX_EXCLUSIVE,
        extra_price_pricing_mode:
          tenant.extra_price_pricing_mode ?? EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE,
      };
      setModes(next);
      setDraft(next);
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/tenants/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_pricing_mode: draft.tax_pricing_mode,
          extra_price_pricing_mode: draft.extra_price_pricing_mode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t('pricingMode.saveFailed'));
      setModes(draft);
      cmxMessage.success(t('pricingMode.saveSuccess'));
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('pricingMode.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    draft.tax_pricing_mode !== modes.tax_pricing_mode ||
    draft.extra_price_pricing_mode !== modes.extra_price_pricing_mode;

  return (
    <div className="space-y-6">
      {/* Finance & Pricing card */}
      <CmxCard>
        <CmxCardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t('tenantSettings.pricingSection')}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {t('tenantSettings.pricingDescription')}
              </p>
            </div>
          </div>
        </CmxCardHeader>
        <CmxCardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">{t('loading')}</div>
          ) : (
            <div className="space-y-5">
              {/* Tax Pricing Mode */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  {t('pricingMode.taxPricingMode')}
                </label>
                <p className="text-xs text-gray-500">{t('pricingMode.taxPricingModeDesc')}</p>
                <div className="relative">
                  <select
                    value={draft.tax_pricing_mode}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        tax_pricing_mode: e.target.value as TaxPricingMode,
                      }))
                    }
                    className="w-full max-w-sm appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={TAX_PRICING_MODES.TAX_EXCLUSIVE}>
                      {t('pricingMode.taxExclusive')} — {t('pricingMode.taxExclusiveDesc')}
                    </option>
                    {(taxInclusiveEnabled || draft.tax_pricing_mode === TAX_PRICING_MODES.TAX_INCLUSIVE) && (
                      <option value={TAX_PRICING_MODES.TAX_INCLUSIVE}>
                        {t('pricingMode.taxInclusive')} — {t('pricingMode.taxInclusiveDesc')}
                      </option>
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 rtl:left-2.5 rtl:right-auto" />
                </div>
              </div>

              {/* Extra Price Pricing Mode */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  {t('pricingMode.extraPricePricingMode')}
                </label>
                <p className="text-xs text-gray-500">{t('pricingMode.extraPricePricingModeDesc')}</p>
                <div className="relative">
                  <select
                    value={draft.extra_price_pricing_mode}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        extra_price_pricing_mode: e.target.value as ExtraPricePricingMode,
                      }))
                    }
                    className="w-full max-w-sm appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rtl:pl-9 rtl:pr-3"
                  >
                    <option value={EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE}>
                      {t('pricingMode.includedInItemPrice')} — {t('pricingMode.includedInItemPriceDesc')}
                    </option>
                    <option value={EXTRA_PRICE_PRICING_MODES.SEPARATE_CHARGE}>
                      {t('pricingMode.separateCharge')} — {t('pricingMode.separateChargeDesc')}
                    </option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 rtl:left-2.5 rtl:right-auto" />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t pt-4">
                <CmxButton
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!isDirty || saving}
                  size="sm"
                >
                  {saving ? t('saving') : t('saveChanges')}
                </CmxButton>
                {isDirty && (
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(modes)}
                  >
                    {t('cancel')}
                  </CmxButton>
                )}
              </div>
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      {/* Full catalog settings */}
      <TenantSettings />
    </div>
  );
}
