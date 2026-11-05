'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { TenantSettings } from './TenantSettings';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';

interface PricingModes {
  tax_pricing_mode: TaxPricingMode;
  extra_price_pricing_mode: ExtraPricePricingMode;
}

/**
 *
 */
export function TenantSettingsScreen() {
  const t = useTranslations('settings');
  const [modes, setModes] = React.useState<PricingModes | null>(null);
  const [loading, setLoading] = React.useState(true);

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
      setModes({
        tax_pricing_mode: tenant.tax_pricing_mode ?? TAX_PRICING_MODES.TAX_EXCLUSIVE,
        extra_price_pricing_mode: tenant.extra_price_pricing_mode ?? EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE,
      });
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  const taxLabel = (mode: TaxPricingMode) => mode === TAX_PRICING_MODES.TAX_INCLUSIVE
    ? `${t('pricingMode.taxInclusive')} — ${t('pricingMode.taxInclusiveDesc')}`
    : `${t('pricingMode.taxExclusive')} — ${t('pricingMode.taxExclusiveDesc')}`;
  const extraLabel = (mode: ExtraPricePricingMode) => mode === EXTRA_PRICE_PRICING_MODES.SEPARATE_CHARGE
    ? `${t('pricingMode.separateCharge')} — ${t('pricingMode.separateChargeDesc')}`
    : `${t('pricingMode.includedInItemPrice')} — ${t('pricingMode.includedInItemPriceDesc')}`;

  return (
    <div className="space-y-6">
      {/* Finance & Pricing: read-only here; HQ is the only writer (L18, Line-Level P7-05). */}
      <CmxCard>
        <CmxCardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[rgb(var(--cmx-muted-foreground-rgb))]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold">{t('tenantSettings.pricingSection')}</h2>
              <p className="mt-0.5 text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('tenantSettings.pricingDescription')}</p>
            </div>
          </div>
        </CmxCardHeader>
        <CmxCardContent>
          {loading || !modes ? (
            <div className="py-8 text-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('loading')}</div>
          ) : (
            <dl className="space-y-5">
              <div className="space-y-1">
                <dt className="text-sm font-medium">{t('pricingMode.taxPricingMode')}</dt>
                <dd className="text-sm">{taxLabel(modes.tax_pricing_mode)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm font-medium">{t('pricingMode.extraPricePricingMode')}</dt>
                <dd className="text-sm">{extraLabel(modes.extra_price_pricing_mode)}</dd>
              </div>
              <p className="border-t pt-4 text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('pricingMode.managedByPlatform')}</p>
            </dl>
          )}
        </CmxCardContent>
      </CmxCard>

      {/* Full catalog settings */}
      <TenantSettings />
    </div>
  );
}
