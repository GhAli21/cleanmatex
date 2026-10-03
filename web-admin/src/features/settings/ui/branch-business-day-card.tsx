'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { CmxButton, CmxSelect } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { useLocale } from '@/lib/hooks/useLocale';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { isValidTimeZone } from '@/lib/utils/business-date';
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm';

interface TimezoneOption {
  code: string;
  name: string;
  name2: string | null;
  utc_offset_string: string | null;
}

interface BranchTimezone {
  timezone_code: string | null;
  tenant_timezone: string | null;
}

const INHERIT = '__inherit__';

/**
 * "Business day" card of the branch settings screen: the branch's own timezone, or inherit the
 * organization's. The timezone decides the branch business date and when POS sessions roll over,
 * so the card says what is in effect now and what changing it does — nothing is changed silently.
 */
export function BranchBusinessDayCard({ branchId }: { branchId: string }) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const canEdit = useHasPermissionCode(SETTINGS_PERMISSIONS.UPDATE);
  const [draft, setDraft] = React.useState<string | null | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  const zonesQuery = useQuery({
    queryKey: ['lookups', 'timezones'],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<TimezoneOption[]> => {
      const res = await fetch('/api/v1/lookups/timezones');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t('branchSettings.businessDay.loadFailed'));
      return json.data ?? [];
    },
  });

  const branchQuery = useQuery({
    queryKey: ['branch-business-day', branchId],
    queryFn: async (): Promise<BranchTimezone> => {
      const res = await fetch(`/api/v1/branches/${branchId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t('branchSettings.businessDay.loadFailed'));
      return { timezone_code: json.data.timezone_code ?? null, tenant_timezone: json.data.tenant_timezone ?? null };
    },
  });

  // Reset the draft whenever another branch is selected.
  React.useEffect(() => setDraft(undefined), [branchId]);

  const saved = branchQuery.data?.timezone_code ?? null;
  const value = draft === undefined ? saved : draft;
  const isDirty = draft !== undefined && draft !== saved;
  const effective = value ?? branchQuery.data?.tenant_timezone ?? null;
  const missing = !branchQuery.isLoading && !isValidTimeZone(effective);

  const options = [
    { value: INHERIT, label: t('branchSettings.businessDay.inherit', { zone: branchQuery.data?.tenant_timezone ?? '—' }) },
    ...(zonesQuery.data ?? []).map((zone) => ({
      value: zone.code,
      label: `${locale === 'ar' ? (zone.name2 ?? zone.name) : zone.name} (${zone.code}${zone.utc_offset_string ? `, UTC${zone.utc_offset_string}` : ''})`,
    })),
  ];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone_code: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t('branchSettings.businessDay.saveFailed'));
      cmxMessage.success(t('branchSettings.businessDay.saved'));
      setDraft(undefined);
      await queryClient.invalidateQueries({ queryKey: ['branch-business-day', branchId] });
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('branchSettings.businessDay.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CmxCard>
      <CmxCardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" aria-hidden />
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t('branchSettings.businessDay.title')}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{t('branchSettings.businessDay.description')}</p>
          </div>
        </div>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        {missing ? (
          <CmxSummaryMessage
            type="error"
            title={t('branchSettings.businessDay.missingTitle')}
            items={[t('branchSettings.businessDay.missingBody')]}
          />
        ) : null}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700" htmlFor="branch-timezone">
            {t('branchSettings.businessDay.label')}
          </label>
          <CmxSelect
            id="branch-timezone"
            value={value ?? INHERIT}
            disabled={!canEdit || branchQuery.isLoading || zonesQuery.isLoading}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setDraft(e.target.value === INHERIT ? null : e.target.value)
            }
            className="max-w-md"
            options={options}
          />
          {effective ? (
            <p className="text-xs text-blue-600">{t('branchSettings.businessDay.inEffect', { zone: effective })}</p>
          ) : null}
          {!canEdit ? (
            <p className="text-xs text-gray-500">{t('branchSettings.businessDay.noPermission')}</p>
          ) : null}
        </div>

        {isDirty ? (
          <CmxSummaryMessage
            type="info"
            title={t('branchSettings.businessDay.changeNoteTitle')}
            items={[t('branchSettings.businessDay.changeNote')]}
          />
        ) : null}

        <div className="flex items-center gap-3 border-t pt-4">
          <CmxButton type="button" size="sm" onClick={() => void save()} disabled={!canEdit || !isDirty || saving}>
            {saving ? t('saving') : t('saveChanges')}
          </CmxButton>
          {isDirty ? (
            <CmxButton type="button" size="sm" variant="ghost" onClick={() => setDraft(undefined)}>
              {t('cancel')}
            </CmxButton>
          ) : null}
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
