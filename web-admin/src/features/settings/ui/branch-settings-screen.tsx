'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { GitBranch, ChevronDown, RotateCcw } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxSelect } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { BranchSettings } from './BranchSettings';
import {
  TAX_PRICING_MODES,
  EXTRA_PRICE_PRICING_MODES,
} from '@/lib/constants/order-financial';
import type { TaxPricingMode, ExtraPricePricingMode } from '@/lib/types/order-financial';
import { useFeature } from '@/src/features/auth/ui/RequireFeature';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';

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

const INHERIT_SENTINEL = '__inherit__';

/**
 *
 */
export function BranchSettingsScreen() {
  const t = useTranslations('settings');
  const taxInclusiveEnabled = useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING);
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState('');
  const [modes, setModes] = React.useState<BranchPricingModes>({
    tax_pricing_mode: null,
    extra_price_pricing_mode: null,
  });
  const [draft, setDraft] = React.useState<BranchPricingModes>(modes);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [modesLoading, setModesLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void loadBranches();
  }, []);

  React.useEffect(() => {
    if (selectedBranchId) {
      void loadBranchModes(selectedBranchId);
    } else {
      const empty = { tax_pricing_mode: null, extra_price_pricing_mode: null };
      setModes(empty);
      setDraft(empty);
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
      setDraft(next);
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : 'Failed to load branch settings');
    } finally {
      setModesLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedBranchId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/branches/${selectedBranchId}`, {
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
                <div className="py-8 text-center text-sm text-gray-400">{t('loading')}</div>
              ) : (
                <div className="space-y-5">
                  {/* Tax Pricing Mode */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      {t('pricingMode.taxPricingMode')}
                    </label>
                    <p className="text-xs text-gray-500">
                      {t('pricingMode.taxPricingModeDesc')} —{' '}
                      <span className="italic">{t('pricingMode.inheritNote')}</span>
                    </p>
                    <div className="relative">
                      <select
                        value={draft.tax_pricing_mode ?? INHERIT_SENTINEL}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((d) => ({
                            ...d,
                            tax_pricing_mode: val === INHERIT_SENTINEL ? null : (val as TaxPricingMode),
                          }));
                        }}
                        className="w-full max-w-sm appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rtl:pl-9 rtl:pr-3"
                      >
                        <option value={INHERIT_SENTINEL}>
                          {t('branchSettings.inheritFromTenant')}
                        </option>
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
                    {modes.tax_pricing_mode === null && (
                      <p className="text-xs text-blue-600">{t('branchSettings.inheritedValue')}</p>
                    )}
                  </div>

                  {/* Extra Price Pricing Mode */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      {t('pricingMode.extraPricePricingMode')}
                    </label>
                    <p className="text-xs text-gray-500">
                      {t('pricingMode.extraPricePricingModeDesc')} —{' '}
                      <span className="italic">{t('pricingMode.inheritNote')}</span>
                    </p>
                    <div className="relative">
                      <select
                        value={draft.extra_price_pricing_mode ?? INHERIT_SENTINEL}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((d) => ({
                            ...d,
                            extra_price_pricing_mode:
                              val === INHERIT_SENTINEL ? null : (val as ExtraPricePricingMode),
                          }));
                        }}
                        className="w-full max-w-sm appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rtl:pl-9 rtl:pr-3"
                      >
                        <option value={INHERIT_SENTINEL}>
                          {t('branchSettings.inheritFromTenant')}
                        </option>
                        <option value={EXTRA_PRICE_PRICING_MODES.INCLUDED_IN_ITEM_PRICE}>
                          {t('pricingMode.includedInItemPrice')} —{' '}
                          {t('pricingMode.includedInItemPriceDesc')}
                        </option>
                        <option value={EXTRA_PRICE_PRICING_MODES.SEPARATE_CHARGE}>
                          {t('pricingMode.separateCharge')} —{' '}
                          {t('pricingMode.separateChargeDesc')}
                        </option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 rtl:left-2.5 rtl:right-auto" />
                    </div>
                    {modes.extra_price_pricing_mode === null && (
                      <p className="text-xs text-blue-600">{t('branchSettings.inheritedValue')}</p>
                    )}
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
                        <RotateCcw className="mr-1 h-3.5 w-3.5 rtl:ml-1 rtl:mr-0" />
                        {t('cancel')}
                      </CmxButton>
                    )}
                  </div>
                </div>
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
