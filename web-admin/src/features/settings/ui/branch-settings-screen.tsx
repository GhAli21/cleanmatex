'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { GitBranch } from 'lucide-react';
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxSelect } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { BranchSettings } from './BranchSettings';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';
import { PendingDepositDrawerEnsureButton } from '@features/cash-drawers/ui/pending-deposit-drawer-ensure-button';
import { BranchBusinessDayCard } from './branch-business-day-card';

interface BranchOption {
  id: string;
  name: string;
  name2: string | null;
  is_main: boolean | null;
}

interface BranchPricingModes {
  tax_pricing_mode: string | null;
  extra_price_pricing_mode: string | null;
}


/**
 *
 */
export function BranchSettingsScreen() {
  const t = useTranslations('settings');
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState('');
  const [modes, setModes] = React.useState<BranchPricingModes>({
    tax_pricing_mode: null,
    extra_price_pricing_mode: null,
  });
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [modesLoading, setModesLoading] = React.useState(false);

  React.useEffect(() => {
    void loadBranches();
  }, []);

  React.useEffect(() => {
    if (selectedBranchId) {
      void loadBranchModes(selectedBranchId);
    } else {
      const empty = { tax_pricing_mode: null, extra_price_pricing_mode: null };
      setModes(empty);
    }
  }, [selectedBranchId]);

  async function loadBranches() {
    setInitialLoading(true);
    try {
      const res = await fetch('/api/v1/branches');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load branches');
      const list: BranchOption[] = json.data || [];
      setBranches(list);
      const main = list.find((b) => b.is_main) ?? list[0];
      if (main) setSelectedBranchId(main.id);
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setInitialLoading(false);
    }
  }

  async function loadBranchModes(branchId: string) {
    setModesLoading(true);
    try {
      const res = await fetch(`/api/v1/branches/${branchId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load branch');
      const branch = json.data;
      const next: BranchPricingModes = {
        tax_pricing_mode: branch.tax_pricing_mode ?? null,
        extra_price_pricing_mode: branch.extra_price_pricing_mode ?? null,
      };
      setModes(next);
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : 'Failed to load branch settings');
    } finally {
      setModesLoading(false);
    }
  }

  const currentBranch = branches.find((b) => b.id === selectedBranchId) ?? null;

  return (
    <div className="space-y-6">
      {/* Branch selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {t('branchSettings.title')}
          </h2>
          <p className="text-sm text-gray-500">{t('branchSettings.description')}</p>
        </div>
        {!initialLoading && (
          <CmxSelect
            value={selectedBranchId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedBranchId(e.target.value)
            }
            className="min-w-[220px]"
            options={[
              { value: '', label: t('branchSettings.selectBranch') },
              ...branches.map((b) => ({
                value: b.id,
                label: `${b.name2 ?? b.name}${b.is_main ? ' ★' : ''}`,
              })),
            ]}
          />
        )}
      </div>

      {initialLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">{t('loading')}</div>
      ) : !selectedBranchId ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {t('branchSettings.selectBranch')}
        </div>
      ) : (
        <>
          {/* CLF §4B.2a-B — self-hides once the branch's system PENDING_DEPOSIT drawer exists */}
          <div className="flex justify-end">
            <PendingDepositDrawerEnsureButton branchId={selectedBranchId} />
          </div>

          {/* B2 — branch timezone: the business day belongs to the branch */}
          <BranchBusinessDayCard branchId={selectedBranchId} />

          <div className="flex justify-end">
            <CmxButton asChild variant="outline" size="sm">
              <Link href={`/dashboard/settings/calendar?tab=branches&branch=${selectedBranchId}`}>{t('calendar.branch.openCalendar')}</Link>
            </CmxButton>
          </div>

          {/* Pricing mode overrides */}
          <CmxCard>
            <CmxCardHeader>
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-gray-500" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {t('branchSettings.pricingSection')}
                    {currentBranch && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        — {currentBranch.name2 ?? currentBranch.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {t('branchSettings.pricingDescription')}
                  </p>
                </div>
              </div>
            </CmxCardHeader>
            <CmxCardContent>
              {modesLoading ? (
                <div className="py-8 text-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('loading')}</div>
              ) : (
                // Read-only here; HQ is the only writer of the branch overrides (L18, Line-Level P7-05).
                <dl className="space-y-5">
                  <div className="space-y-1">
                    <dt className="text-sm font-medium">{t('pricingMode.taxPricingMode')}</dt>
                    <dd className="text-sm">
                      {modes.tax_pricing_mode === null ? t('pricingMode.inheritFromOrganization')
                        : modes.tax_pricing_mode === TAX_PRICING_MODES.TAX_INCLUSIVE
                          ? `${t('pricingMode.taxInclusive')} — ${t('pricingMode.taxInclusiveDesc')}`
                          : `${t('pricingMode.taxExclusive')} — ${t('pricingMode.taxExclusiveDesc')}`}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-sm font-medium">{t('pricingMode.extraPricePricingMode')}</dt>
                    <dd className="text-sm">
                      {modes.extra_price_pricing_mode === null ? t('pricingMode.inheritFromOrganization')
                        : modes.extra_price_pricing_mode === EXTRA_PRICE_PRICING_MODES.SEPARATE_CHARGE
                          ? `${t('pricingMode.separateCharge')} — ${t('pricingMode.separateChargeDesc')}`
                          : `${t('pricingMode.includedInItemPrice')} — ${t('pricingMode.includedInItemPriceDesc')}`}
                    </dd>
                  </div>
                  <p className="border-t pt-4 text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('pricingMode.managedByPlatform')}</p>
                </dl>
              )}
            </CmxCardContent>
          </CmxCard>

          {/* Full catalog settings for the selected branch */}
          <BranchSettings externalBranchId={selectedBranchId} />
        </>
      )}
    </div>
  );
}
