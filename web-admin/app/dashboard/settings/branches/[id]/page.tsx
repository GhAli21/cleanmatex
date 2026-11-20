/**
 * Branch Override Settings Page
 * Phase 4: Client Frontend Enhancement
 *
 * Allows branch-level setting overrides
 * Route: /dashboard/settings/branches/[id]
 */

'use client';

import { CmxConfirmDialog } from '@ui/feedback';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox, CmxInput } from '@ui/primitives';
import { CmxTabsPanel } from '@ui/navigation';
import { settingsClient, type ResolvedSetting, type SettingDefinition } from '@/lib/api/settings-client';
import { EnhancedSettingField } from '@features/settings/ui/enhanced-setting-field';

/**
 *
 */
export default function BranchSettingsPage() {
  const t = useTranslations('settings.advancedSettings');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const branchId = params.id as string;

  const [branchName, setBranchName] = useState('');
  const [effectiveSettings, setEffectiveSettings] = useState<ResolvedSetting[]>([]);
  const [catalog, setCatalog] = useState<Record<string, SettingDefinition[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch branch details
      const branchResponse = await fetch(`/api/v1/branches/${branchId}`);
      const branchData = await branchResponse.json();
      if (branchResponse.ok) {
        setBranchName(branchData.data.branch_name || t('branchDetailFallback'));
      }

      // Fetch effective settings for this branch
      const settings = await settingsClient.getEffectiveSettings({ branchId });
      setEffectiveSettings(settings);

      // Fetch catalog grouped by category
      const catalogData = await settingsClient.getCatalogByCategory();
      setCatalog(catalogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadErrorBranchSettings'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAll = async () => {
    try {
      // Delete all branch overrides
      const branchSettings = effectiveSettings.filter(
        s => s.stngSourceLayer === 'BRANCH_OVERRIDE'
      );

      for (const setting of branchSettings) {
        await settingsClient.deleteOverride(setting.stngCode, { branchId });
      }

      setShowResetConfirm(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to reset branch overrides:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">{t('loadingBranchSettings')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CmxSummaryMessage type="error" title={tCommon('error')} message={error} />
      </div>
    );
  }

  // Group settings by category
  const tabs = Object.entries(catalog).map(([categoryCode, settings]) => ({
    id: categoryCode,
    label: settings[0]?.stng_category_code || categoryCode,
    content: (
      <div className="space-y-6">
        {settings.map(setting => {
          const resolved = effectiveSettings.find(
            s => s.stngCode === setting.setting_code
          );

          return (
            <EnhancedSettingField
              key={setting.setting_code}
              settingCode={setting.setting_code}
              label={setting.setting_name}
              description={setting.setting_description}
              value={resolved?.stngValue}
              source={resolved?.stngSourceLayer as any || 'SYSTEM_DEFAULT'}
              sourceName={resolved?.stngSourceId}
              isOverridable={setting.stng_is_overridable}
              isLocked={false}
              branchId={branchId}
              onReset={fetchData}
            >
              {/* Render appropriate input based on data type */}
              <SettingInput
                setting={setting}
                value={resolved?.stngValue}
                onChange={(value) => handleSettingChange(setting.setting_code, value)}
              />
            </EnhancedSettingField>
          );
        })}
      </div>
    ),
  }));

  const handleSettingChange = async (settingCode: string, value: any) => {
    try {
      await settingsClient.upsertOverride({
        settingCode,
        value,
        branchId,
        overrideReason: t('branchOverrideReason', { name: branchName }),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
          {t('backToSettings')}
        </CmxButton>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-bg rounded-lg">
              <Building2 className="h-6 w-6 text-primary-text" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t('branchSettingsTitle')}
              </h1>
              <p className="mt-1 text-muted-foreground">{branchName}</p>
            </div>
          </div>

          <CmxButton variant="outline" onClick={() => setShowResetConfirm(true)}>
            {t('resetAllOverrides')}
          </CmxButton>
        </div>
      </div>

      {/* Info Banner */}
      <CmxCard className="mb-6 p-4 bg-info-bg border-info-border">
        <p className="text-sm text-primary-text">
          {t('branchBanner')}
        </p>
      </CmxCard>

      {/* Settings Tabs */}
      <CmxTabsPanel tabs={tabs} defaultTab={tabs[0]?.id} />

      <CmxConfirmDialog
        open={showResetConfirm}
        title={t('resetAllOverrides')}
        description={t('resetAllConfirm')}
        confirmLabel={tCommon('confirm')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleResetAll}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

// ============================================================
// SETTING INPUT COMPONENT
// ============================================================

interface SettingInputProps {
  setting: SettingDefinition;
  value: any;
  onChange: (value: any) => void;
}

function SettingInput({ setting, value, onChange }: SettingInputProps) {
  // Render appropriate input based on data type
  switch (setting.stng_data_type) {
    case 'BOOLEAN':
      return (
        <CmxCheckbox
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      );

    case 'NUMBER':
      return (
        <CmxInput
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );

    case 'TEXT':
    default:
      return (
        <CmxInput
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
