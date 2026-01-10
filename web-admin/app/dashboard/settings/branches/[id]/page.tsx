/**
 * Branch Override Settings Page
 * Phase 4: Client Frontend Enhancement
 *
 * Allows branch-level setting overrides
 * Route: /dashboard/settings/branches/[id]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Card, Button, Tabs, Alert } from '@/components/ui';
import { settingsClient, type ResolvedSetting, type SettingDefinition } from '@/lib/api/settings-client';
import { EnhancedSettingField } from '@/components/settings/enhanced-setting-field';

export default function BranchSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.id as string;

  const [branchName, setBranchName] = useState('');
  const [effectiveSettings, setEffectiveSettings] = useState<ResolvedSetting[]>([]);
  const [catalog, setCatalog] = useState<Record<string, SettingDefinition[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [branchId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch branch details
      const branchResponse = await fetch(`/api/v1/branches/${branchId}`);
      const branchData = await branchResponse.json();
      if (branchResponse.ok) {
        setBranchName(branchData.data.branch_name || 'Branch');
      }

      // Fetch effective settings for this branch
      const settings = await settingsClient.getEffectiveSettings({ branchId });
      setEffectiveSettings(settings);

      // Fetch catalog grouped by category
      const catalogData = await settingsClient.getCatalogByCategory();
      setCatalog(catalogData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all branch overrides?')) return;

    try {
      // Delete all branch overrides
      const branchSettings = effectiveSettings.filter(
        s => s.stngSourceLayer === 'BRANCH_OVERRIDE'
      );

      for (const setting of branchSettings) {
        await settingsClient.deleteOverride(setting.stngCode, { branchId });
      }

      await fetchData();
    } catch (err) {
      console.error('Failed to reset branch overrides:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading branch settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error" title="Error" message={error} />
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
        overrideReason: `Branch ${branchName} override`,
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Branch Settings
              </h1>
              <p className="mt-1 text-gray-600">{branchName}</p>
            </div>
          </div>

          <Button variant="outline" onClick={handleResetAll}>
            Reset All Overrides
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 p-4 bg-purple-50 border-purple-200">
        <p className="text-sm text-purple-800">
          Branch-level overrides apply to all users in this branch and take precedence over tenant-level settings.
        </p>
      </Card>

      {/* Settings Tabs */}
      <Tabs tabs={tabs} defaultTab={tabs[0]?.id} />
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
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-gray-300"
        />
      );

    case 'NUMBER':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border-gray-300"
        />
      );

    case 'TEXT':
    default:
      return (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border-gray-300"
        />
      );
  }
}
