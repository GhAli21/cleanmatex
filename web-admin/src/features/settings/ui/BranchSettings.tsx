/**
 * Branch Settings screen
 *
 * Allows selecting a branch and managing branch-level overrides
 * for settings using the shared SettingsTable component.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CmxSelect, CmxButton } from '@ui/primitives';
import { SettingsTable, type SettingsTableRow } from './SettingsTable';
import {
  settingsClient,
  SettingsApiError,
  type SettingDefinition,
  type ResolvedSetting,
} from '@/lib/api/settings-client';

interface BranchOption {
  id: string;
  name: string;
  name2: string | null;
  is_main: boolean | null;
}

export function BranchSettings() {
  const [branches, setBranches] = React.useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>('');
  const [rows, setRows] = React.useState<SettingsTableRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);

  React.useEffect(() => {
    void loadBranches();
  }, []);

  React.useEffect(() => {
    if (selectedBranchId) {
      void loadSettingsForBranch(selectedBranchId);
    } else {
      setRows([]);
    }
  }, [selectedBranchId]);

  async function loadBranches() {
    setInitialLoading(true);
    try {
      const res = await fetch('/api/v1/branches');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load branches');
      }
      const list: BranchOption[] = json.data || [];
      setBranches(list);
      const main = list.find((b) => b.is_main) || list[0];
      if (main) {
        setSelectedBranchId(main.id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load branches';
      cmxMessage.error(message);
    } finally {
      setInitialLoading(false);
    }
  }

  async function loadSettingsForBranch(branchId: string) {
    setLoading(true);
    try {
      const [catalog, effective] = await Promise.all([
        settingsClient.getCatalog(),
        settingsClient.getEffectiveSettings({ branchId }),
      ]);
      setRows(buildRows(catalog, effective));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load branch settings';
      cmxMessage.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveOverride(row: SettingsTableRow, nextValue: any) {
    if (!selectedBranchId) return;
    try {
      await settingsClient.upsertOverride({
        settingCode: row.definition.setting_code,
        value: nextValue,
        branchId: selectedBranchId,
      });
      cmxMessage.success('Branch setting updated successfully');
      await loadSettingsForBranch(selectedBranchId);
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : 'Failed to update branch setting';
      cmxMessage.error(message);
      throw error;
    }
  }

  async function handleResetOverride(row: SettingsTableRow) {
    if (!selectedBranchId) return;
    try {
      await settingsClient.deleteOverride(row.definition.setting_code, {
        branchId: selectedBranchId,
      });
      cmxMessage.success('Branch setting override removed');
      await loadSettingsForBranch(selectedBranchId);
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : 'Failed to reset branch setting';
      cmxMessage.error(message);
      throw error;
    }
  }

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Branch Settings</h2>
          <p className="text-sm text-gray-500">
            Select a branch to view and override settings at the branch level.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CmxSelect
            value={selectedBranchId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedBranchId(e.target.value)
            }
            className="min-w-[220px]"
            options={[
              { value: '', label: 'Select branch…' },
              ...branches.map((b) => ({
                value: b.id,
                label: `${b.name2 || b.name}${b.is_main ? ' (Main)' : ''}`,
              })),
            ]}
          />
          {selectedBranchId && (
            <CmxButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadSettingsForBranch(selectedBranchId)}
            >
              Reload
            </CmxButton>
          )}
        </div>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
          Loading branches...
        </div>
      ) : !selectedBranchId ? (
        <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
          No branch selected.
        </div>
      ) : (
        <SettingsTable
          title={currentBranch ? `Settings for ${currentBranch.name}` : 'Branch Settings'}
          description="View all effective settings for this branch and manage branch-level overrides."
          rows={rows}
          context={{ scope: 'BRANCH', branchId: selectedBranchId }}
          isLoading={loading}
          onSaveOverride={handleSaveOverride}
          onResetOverride={handleResetOverride}
        />
      )}
    </div>
  );
}

function buildRows(
  catalog: SettingDefinition[],
  effective: ResolvedSetting[],
): SettingsTableRow[] {
  return catalog
    .filter((def) => def.is_active && def.stng_scope !== 'SYSTEM')
    .map<SettingsTableRow>((def) => {
      const resolved = effective.find((s) => s.stngCode === def.setting_code);
      const isOverridden = resolved?.stngSourceLayer === 'BRANCH_OVERRIDE';
      const isLockedByEditPolicy =
        (def.stng_edit_policy ?? 'FREELY_EDITABLE') === 'EDITABLE_ONCE' &&
        isOverridden &&
        resolved?.stngValue != null;

      const baseCanEdit =
        def.stng_scope !== 'SYSTEM' &&
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

