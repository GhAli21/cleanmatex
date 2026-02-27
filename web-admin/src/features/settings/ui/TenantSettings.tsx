/**
 * Tenant Settings screen
 *
 * Shows all effective settings for the current tenant and allows
 * tenant-level overrides where permitted by catalog metadata.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { SettingsTable, type SettingsTableRow } from './SettingsTable';
import {
  settingsClient,
  SettingsApiError,
  type SettingDefinition,
  type ResolvedSetting,
} from '@/lib/api/settings-client';

export function TenantSettings() {
  const t = useTranslations('settings');
  const [rows, setRows] = React.useState<SettingsTableRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, effective] = await Promise.all([
        settingsClient.getCatalog(),
        settingsClient.getEffectiveSettings(),
      ]);
      setRows(buildRows(catalog, effective));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load tenant settings';
      cmxMessage.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveOverride(row: SettingsTableRow, nextValue: any) {
    try {
      await settingsClient.upsertOverride({
        settingCode: row.definition.setting_code,
        value: nextValue,
      });
      cmxMessage.success('Tenant setting updated successfully');
      await load();
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : 'Failed to update tenant setting';
      cmxMessage.error(message);
      throw error;
    }
  }

  async function handleResetOverride(row: SettingsTableRow) {
    try {
      await settingsClient.deleteOverride(row.definition.setting_code);
      cmxMessage.success('Tenant setting override removed');
      await load();
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : 'Failed to reset tenant setting';
      cmxMessage.error(message);
      throw error;
    }
  }

  return (
    <SettingsTable
      title="Tenant Settings"
      description="View all effective settings for this tenant and manage tenant-level overrides."
      rows={rows}
      context={{ scope: 'TENANT' }}
      isLoading={loading}
      onSaveOverride={handleSaveOverride}
      onResetOverride={handleResetOverride}
    />
  );
}

function buildRows(
  catalog: SettingDefinition[],
  effective: ResolvedSetting[],
): SettingsTableRow[] {
  return catalog
    .filter((def) => def.is_active)
    .map<SettingsTableRow>((def) => {
      const resolved = effective.find((s) => s.stngCode === def.setting_code);
      const isOverridden = resolved?.stngSourceLayer === 'TENANT_OVERRIDE';
      const isLockedByEditPolicy =
        (def.stng_edit_policy ?? 'FREELY_EDITABLE') === 'EDITABLE_ONCE' &&
        isOverridden &&
        resolved?.stngValue != null;

      const baseCanEdit =
        def.stng_scope === 'TENANT' &&
        def.stng_is_overridable &&
        !def.stng_is_sensitive;
      const canEdit = baseCanEdit && !isLockedByEditPolicy;

      return {
        definition: def,
        resolved,
        isOverridden,
        canEdit,
        isLockedByEditPolicy,
      };
    });
}

