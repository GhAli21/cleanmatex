'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Loyalty Config — Client Component
 *
 * Two sections:
 *  1. Program Settings form — earn/redeem rates, expiry, min redeem, max redeem %.
 *  2. Tiers table — CRUD for loyalty tiers with a create/edit dialog.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { cmxMessage } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import {
  getLoyaltyConfigAction,
  saveLoyaltyConfigAction,
  saveTierAction,
  deleteTierAction,
} from '@/app/actions/marketing/loyalty-actions';

interface TierRow {
  id:              string;
  name:            string;
  name2:           string | null;
  min_points:      number;
  bonus_multiplier: { toNumber: () => number } | number;
  sort_order:      number;
  is_active:       boolean;
}

interface LoyaltyConfig {
  id:                     string;
  earn_rate_per_unit:     { toNumber: () => number } | number;
  redeem_rate_per_point:  { toNumber: () => number } | number;
  min_redeem_points:      number;
  max_redeem_pct_of_order: { toNumber: () => number } | number;
  points_expiry_days:     number | null;
  org_loyalty_tiers_cf:   TierRow[];
}

function toNum(v: { toNumber: () => number } | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'object') return v.toNumber();
  return Number(v);
}

export function LoyaltyConfigClient() {
  const t       = useTranslations('marketing.loyalty');
  const tCommon = useTranslations('common');

  const [config, setConfig]   = useState<LoyaltyConfig | null>(null);
  const [isLoading, setLoad]  = useState(true);

  // Config form
  const [earnRate, setEarnRate]             = useState('1');
  const [redeemRate, setRedeemRate]         = useState('0.01');
  const [minRedeem, setMinRedeem]           = useState('100');
  const [maxPct, setMaxPct]                 = useState('20');
  const [expiryDays, setExpiryDays]         = useState('0');
  const [isSavingConfig, setSavingConfig]   = useState(false);

  // Tier dialog
  const [tierDialog, setTierDialog]         = useState<'create' | 'edit' | null>(null);
  const [editingTier, setEditingTier]       = useState<TierRow | null>(null);
  const [tierName, setTierName]             = useState('');
  const [tierName2, setTierName2]           = useState('');
  const [tierMinPts, setTierMinPts]         = useState('');
  const [tierMultiplier, setTierMultiplier] = useState('1');
  const [tierSort, setTierSort]             = useState('0');
  const [isSavingTier, setSavingTier]       = useState(false);

  const load = useCallback(async () => {
    setLoad(true);
    const result = await getLoyaltyConfigAction();
    if (result.success && result.data) {
      const c = result.data as unknown as LoyaltyConfig;
      setConfig(c);
      setEarnRate(String(toNum(c.earn_rate_per_unit)));
      setRedeemRate(String(toNum(c.redeem_rate_per_point)));
      setMinRedeem(String(c.min_redeem_points));
      setMaxPct(String(toNum(c.max_redeem_pct_of_order)));
      setExpiryDays(String(c.points_expiry_days ?? 0));
    }
    setLoad(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSaveConfig() {
    setSavingConfig(true);
    const result = await saveLoyaltyConfigAction({
      earnRatePerUnit:     parseFloat(earnRate)   || 1,
      redeemRatePerPoint:  parseFloat(redeemRate) || 0.01,
      minRedeemPoints:     parseInt(minRedeem)    || 100,
      maxRedeemPctOfOrder: parseFloat(maxPct)     || 20,
      pointsExpiryDays:    parseInt(expiryDays)   || 0,
    });
    if (result.success) {
      cmxMessage.success(t('config.saved'));
      void load();
    } else {
      cmxMessage.error(result.error);
    }
    setSavingConfig(false);
  }

  function openCreateTier() {
    setEditingTier(null);
    setTierName(''); setTierName2(''); setTierMinPts('');
    setTierMultiplier('1'); setTierSort('0');
    setTierDialog('create');
  }

  function openEditTier(tier: TierRow) {
    setEditingTier(tier);
    setTierName(tier.name);
    setTierName2(tier.name2 ?? '');
    setTierMinPts(String(tier.min_points));
    setTierMultiplier(String(toNum(tier.bonus_multiplier)));
    setTierSort(String(tier.sort_order));
    setTierDialog('edit');
  }

  async function handleSaveTier() {
    if (!tierName.trim()) { cmxMessage.error('Tier name is required'); return; }
    if (!config) { cmxMessage.error('Load config first'); return; }
    setSavingTier(true);

    const result = await saveTierAction({
      id:              editingTier?.id,
      programId:       config.id,
      name:            tierName,
      name2:           tierName2 || undefined,
      minPoints:       parseInt(tierMinPts) || 0,
      bonusMultiplier: parseFloat(tierMultiplier) || 1,
      sortOrder:       parseInt(tierSort) || 0,
    });

    if (result.success) {
      cmxMessage.success(t('tiers.saved'));
      setTierDialog(null);
      void load();
    } else {
      cmxMessage.error(result.error);
    }
    setSavingTier(false);
  }

  async function handleDeleteTier(tierId: string) {
    const result = await deleteTierAction(tierId);
    if (result.success) {
      cmxMessage.success(t('tiers.deleted'));
      void load();
    } else {
      cmxMessage.error(result.error);
    }
  }

  const tiers = config?.org_loyalty_tiers_cf?.filter((t) => t.is_active) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {/* Config Card */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('config.title')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          {isLoading ? (
            <div className="animate-pulse h-40 rounded bg-muted" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ConfigField label={t('config.earnRate')}>
                <input
                  type="number" min="0" step="0.0001"
                  value={earnRate}
                  onChange={(e) => setEarnRate(e.target.value)}
                  className="cmx-input"
                />
              </ConfigField>
              <ConfigField label={t('config.redeemRate')}>
                <input
                  type="number" min="0" step="0.000001"
                  value={redeemRate}
                  onChange={(e) => setRedeemRate(e.target.value)}
                  className="cmx-input"
                />
              </ConfigField>
              <ConfigField label={t('config.minRedeemPoints')}>
                <input
                  type="number" min="0" step="1"
                  value={minRedeem}
                  onChange={(e) => setMinRedeem(e.target.value)}
                  className="cmx-input"
                />
              </ConfigField>
              <ConfigField label={t('config.maxRedeemPercent')}>
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={maxPct}
                  onChange={(e) => setMaxPct(e.target.value)}
                  className="cmx-input"
                />
              </ConfigField>
              <ConfigField label={t('config.expiryDays')}>
                <input
                  type="number" min="0" step="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="cmx-input"
                />
              </ConfigField>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <CmxButton
              variant="primary"
              size="sm"
              onClick={handleSaveConfig}
              disabled={isSavingConfig || isLoading}
            >
              {isSavingConfig ? tCommon('saving') : t('config.save')}
            </CmxButton>
          </div>
        </CmxCardContent>
      </CmxCard>

      {/* Tiers */}
      <CmxCard>
        <CmxCardHeader className="flex flex-row items-center justify-between">
          <CmxCardTitle>{t('tiers.title')}</CmxCardTitle>
          <CmxButton
            variant="outline"
            size="sm"
            onClick={openCreateTier}
            disabled={!config}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {t('tiers.add')}
          </CmxButton>
        </CmxCardHeader>
        <CmxCardContent className="p-0">
          <CmxDataTable
            isLoading={isLoading}
            columns={[
              {
                key: 'name',
                header: t('tiers.name'),
                render: (row: TierRow) => <span className="font-medium">{row.name}</span>,
              },
              {
                key: 'min_points',
                header: t('tiers.minPoints'),
                render: (row: TierRow) => (
                  <span className="tabular-nums">{row.min_points.toLocaleString()}</span>
                ),
              },
              {
                key: 'bonus_multiplier',
                header: t('tiers.bonusMultiplier'),
                render: (row: TierRow) => (
                  <span className="tabular-nums">{toNum(row.bonus_multiplier).toFixed(2)}x</span>
                ),
              },
              {
                key: 'sort_order',
                header: 'Order',
                render: (row: TierRow) => row.sort_order,
              },
              {
                key: 'actions',
                header: tCommon('actions'),
                render: (row: TierRow) => (
                  <div className="flex items-center gap-1">
                    <CmxButton
                      variant="ghost"
                      size="xs"
                      title={tCommon('edit')}
                      onClick={() => openEditTier(row)}
                    >
                      <Edit className="h-4 w-4" />
                    </CmxButton>
                    <CmxButton
                      variant="ghost"
                      size="xs"
                      title={tCommon('delete')}
                      onClick={() => handleDeleteTier(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </CmxButton>
                  </div>
                ),
              },
            ]}
            data={tiers}
            totalCount={tiers.length}
            currentPage={1}
            pageSize={tiers.length || 1}
            onPageChange={() => undefined}
          />
          {tiers.length === 0 && !isLoading && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('tiers.empty')}</p>
          )}
        </CmxCardContent>
      </CmxCard>

      {/* Tier Dialog */}
      <CmxDialog open={tierDialog !== null} onOpenChange={(open) => { if (!open) setTierDialog(null); }}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>
              {tierDialog === 'create' ? t('tiers.add') : tCommon('edit')}
            </CmxDialogTitle>
          </CmxDialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <ConfigField label={t('tiers.name')} required>
              <input
                type="text"
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                className="cmx-input"
              />
            </ConfigField>
            <ConfigField label={`${t('tiers.name')} (AR)`}>
              <input
                type="text"
                value={tierName2}
                onChange={(e) => setTierName2(e.target.value)}
                className="cmx-input"
                dir="rtl"
              />
            </ConfigField>
            <ConfigField label={t('tiers.minPoints')} required>
              <input
                type="number"
                min="0"
                step="1"
                value={tierMinPts}
                onChange={(e) => setTierMinPts(e.target.value)}
                className="cmx-input"
              />
            </ConfigField>
            <ConfigField label={t('tiers.bonusMultiplier')} required>
              <input
                type="number"
                min="1"
                step="0.01"
                value={tierMultiplier}
                onChange={(e) => setTierMultiplier(e.target.value)}
                className="cmx-input"
              />
            </ConfigField>
            <ConfigField label="Sort Order">
              <input
                type="number"
                min="0"
                step="1"
                value={tierSort}
                onChange={(e) => setTierSort(e.target.value)}
                className="cmx-input"
              />
            </ConfigField>
          </div>

          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setTierDialog(null)} disabled={isSavingTier}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton variant="primary" onClick={handleSaveTier} disabled={isSavingTier}>
              {isSavingTier ? tCommon('saving') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function ConfigField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
