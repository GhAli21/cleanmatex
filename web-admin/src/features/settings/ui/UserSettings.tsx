/**
 * User Settings screen
 *
 * Allows selecting a user and managing user-level overrides
 * for settings using the shared SettingsTable component.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CmxSelect, CmxButton } from '@ui/primitives';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchUsers, type TenantUser } from '@/lib/api/users';
import { SettingsTable, type SettingsTableRow } from './SettingsTable';
import {
  settingsClient,
  SettingsApiError,
  type SettingDefinition,
  type ResolvedSetting,
} from '@/lib/api/settings-client';

/**
 *
 */
export function UserSettings() {
  const t = useTranslations('settings');
  const tAdv = useTranslations('settings.advancedSettings');
  const { currentTenant, session } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';
  const accessToken = session?.access_token ?? '';

  const [users, setUsers] = React.useState<TenantUser[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [rows, setRows] = React.useState<SettingsTableRow[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!tenantId || !accessToken) {
      setInitialLoading(false);
      return;
    }
    void loadUsers(tenantId, accessToken);
  }, [tenantId, accessToken]);

  React.useEffect(() => {
    if (selectedUserId) {
      void loadSettingsForUser(selectedUserId);
    } else {
      setRows([]);
    }
  }, [selectedUserId]);

  async function loadUsers(tId: string, token: string) {
    setInitialLoading(true);
    try {
      const response = await fetchUsers(tId, {}, 1, 100, token);
      const list = response.data || [];
      setUsers(list);
      const first = list[0];
      if (first) {
        setSelectedUserId(first.id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tAdv('loadErrorUsers');
      cmxMessage.error(message);
    } finally {
      setInitialLoading(false);
    }
  }

  async function loadSettingsForUser(userId: string) {
    setLoading(true);
    try {
      const [catalog, effective] = await Promise.all([
        settingsClient.getCatalog({ scope: 'USER' }),
        settingsClient.getEffectiveSettings({ userId }),
      ]);
      setRows(buildRows(catalog, effective));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tAdv('loadErrorUserSettings');
      cmxMessage.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveOverride(row: SettingsTableRow, nextValue: any) {
    if (!selectedUserId) return;
    try {
      await settingsClient.upsertOverride({
        settingCode: row.definition.setting_code,
        value: nextValue,
        userId: selectedUserId,
      });
      cmxMessage.success(tAdv('userUpdatedSuccess'));
      await loadSettingsForUser(selectedUserId);
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : tAdv('userUpdateError');
      cmxMessage.error(message);
      throw error;
    }
  }

  async function handleResetOverride(row: SettingsTableRow) {
    if (!selectedUserId) return;
    try {
      await settingsClient.deleteOverride(row.definition.setting_code, {
        userId: selectedUserId,
      });
      cmxMessage.success(tAdv('userResetSuccess'));
      await loadSettingsForUser(selectedUserId);
    } catch (error) {
      const message =
        error instanceof SettingsApiError && error.code === 'SETTING_EDIT_ONCE_LOCKED'
          ? t('error.settingLocked')
          : error instanceof Error
            ? error.message
            : tAdv('userResetError');
      cmxMessage.error(message);
      throw error;
    }
  }

  const currentUser = users.find((u) => u.id === selectedUserId) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tAdv('userSettingsTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {tAdv('userSettingsSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CmxSelect
            value={selectedUserId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedUserId(e.target.value)
            }
            className="min-w-[220px]"
            options={[
              { value: '', label: tAdv('selectUserPlaceholder') },
              ...users.map((u) => ({
                value: u.id,
                label: u.display_name || u.email,
              })),
            ]}
          />
          {selectedUserId && (
            <CmxButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadSettingsForUser(selectedUserId)}
            >
              {tAdv('reload')}
            </CmxButton>
          )}
        </div>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {tAdv('loadingUsers')}
        </div>
      ) : !selectedUserId ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {tAdv('noUserSelected')}
        </div>
      ) : (
        <SettingsTable
          title={
            currentUser
              ? tAdv('settingsForUser', { name: currentUser.display_name || currentUser.email })
              : tAdv('userSettingsTitle')
          }
          description={tAdv('userTableDescription')}
          rows={rows}
          context={{ scope: 'USER', userId: selectedUserId }}
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
    .filter((def) => def.is_active && def.stng_scope === 'USER')
    .map<SettingsTableRow>((def) => {
      const resolved = effective.find((s) => s.stngCode === def.setting_code);
      const isOverridden = resolved?.stngSourceLayer === 'USER_OVERRIDE';
      const isLockedByEditPolicy =
        (def.stng_edit_policy ?? 'FREELY_EDITABLE') === 'EDITABLE_ONCE' &&
        isOverridden &&
        resolved?.stngValue != null;

      const baseCanEdit =
        def.stng_scope === 'USER' &&
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

