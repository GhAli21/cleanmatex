'use client';

/**
 * Extra Tenant Configuration Screen (`/dashboard/settings/extra-config`).
 * Allows authorized Organization administrators to customize GCC-first number/date
 * scripts, BiDi isolation, table density/paging, and POS ergonomics using
 * curated bilingual lists from `sys_tenant_extra_config_cf`.
 *
 * @module features/settings/ui/extra-config/extra-config-screen
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { useHasPermission } from '@/lib/hooks/use-has-permission';
import { EXTRA_CONFIG_CATEGORY_ORDER } from '@/lib/constants/tenant-extra-config';
import type { ExtraConfigItemView, ExtraConfigSaveEntry } from '@/lib/types/tenant-extra-config';
import { CmxButton, CmxSkeletonTable } from '@ui/primitives';
import { CmxFormSection } from '@ui/forms';
import { CmxConfirmDialog, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { CmxCrudPageShell } from '@ui/patterns';
import { ExtraConfigApiError } from '@features/settings/api/extra-config-api';
import { useExtraConfig } from '@features/settings/hooks/use-extra-config';
import { ExtraConfigFieldRow } from './extra-config-field-row';
import { ExtraConfigPreview } from './extra-config-preview';

/**
 * List-assisted screen managing per-Organization extra UI & formatting settings.
 */
export function ExtraConfigScreen() {
  const t = useTranslations('settings.extraConfig');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const canManage = useHasPermission('settings', 'update');

  const { query, saveBatch, resetKey, resetAll } = useExtraConfig();
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const items = query.data?.items ?? [];

  // Build effective draft map without effect synchronization loops.
  const draftValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.config_key] = draftOverrides[item.config_key] ?? item.effective_value;
    }
    return map;
  }, [items, draftOverrides]);

  const dirtyEntries = useMemo<ExtraConfigSaveEntry[]>(() => {
    const list: ExtraConfigSaveEntry[] = [];
    for (const item of items) {
      const current = draftValues[item.config_key];
      if (current !== undefined && current !== item.effective_value) {
        list.push({ config_key: item.config_key, config_value: current });
      }
    }
    return list;
  }, [items, draftValues]);

  const hasAnyOverride = useMemo(
    () => items.some((item) => item.is_overridden),
    [items]
  );

  const groupedCategories = useMemo(() => {
    const byCat = new Map<string, ExtraConfigItemView[]>();
    for (const item of items) {
      const group = byCat.get(item.category_code) ?? [];
      group.push(item);
      byCat.set(item.category_code, group);
    }

    const orderedKeys = [
      ...EXTRA_CONFIG_CATEGORY_ORDER.filter((cat) => byCat.has(cat)),
      ...Array.from(byCat.keys()).filter(
        (cat) => !(EXTRA_CONFIG_CATEGORY_ORDER as readonly string[]).includes(cat)
      ),
    ];

    return orderedKeys.map((categoryCode) => ({
      categoryCode,
      items: byCat.get(categoryCode) ?? [],
    }));
  }, [items]);

  const isBusy = saveBatch.isPending || resetKey.isPending || resetAll.isPending;

  const handleFieldChange = (configKey: string, nextValue: string) => {
    setDraftOverrides((prev) => ({ ...prev, [configKey]: nextValue }));
    setFieldErrors((prev) => {
      if (!prev[configKey]) return prev;
      const copy = { ...prev };
      delete copy[configKey];
      return copy;
    });
  };

  const handleDiscard = () => {
    setDraftOverrides({});
    setFieldErrors({});
  };

  const handleError = (err: unknown) => {
    if (err instanceof ExtraConfigApiError) {
      if (err.configKey) {
        setFieldErrors((prev) => ({ ...prev, [err.configKey!]: err.message }));
      }
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      cmxMessage.error(err.message);
      return;
    }
    cmxMessage.error(tSettings('saveError'));
  };

  const handleSave = async () => {
    if (dirtyEntries.length === 0) return;
    try {
      await saveBatch.mutateAsync(dirtyEntries);
      setDraftOverrides({});
      setFieldErrors({});
      cmxMessage.success(t('saved'));
    } catch (err) {
      handleError(err);
    }
  };

  const handleResetKey = async (configKey: string) => {
    try {
      await resetKey.mutateAsync(configKey);
      setDraftOverrides((prev) => {
        const next = { ...prev };
        delete next[configKey];
        return next;
      });
      cmxMessage.success(t('resetKeySuccess'));
    } catch (err) {
      handleError(err);
    }
  };

  const handleResetAll = async () => {
    try {
      await resetAll.mutateAsync();
      setDraftOverrides({});
      setFieldErrors({});
      setConfirmResetAll(false);
      cmxMessage.success(t('resetAllSuccess'));
    } catch (err) {
      handleError(err);
    }
  };

  const categoryTitle = (code: string): string => {
    switch (code) {
      case 'NUMBERS_AND_DATES':
        return t('categories.NUMBERS_AND_DATES');
      case 'TABLES_AND_DENSITY':
        return t('categories.TABLES_AND_DENSITY');
      case 'POS_ERGONOMICS':
        return t('categories.POS_ERGONOMICS');
      case 'ACCESSIBILITY':
        return t('categories.ACCESSIBILITY');
      default:
        return code;
    }
  };

  return (
    <CmxCrudPageShell
      title={
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6 text-primary-text" aria-hidden />
          <span>{t('title')}</span>
        </span>
      }
      subtitle={t('subtitle')}
      actions={
        canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {hasAnyOverride && (
              <CmxButton
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setConfirmResetAll(true)}
              >
                <RotateCcw className="me-1.5 h-4 w-4" aria-hidden />
                {t('resetAll')}
              </CmxButton>
            )}
            {dirtyEntries.length > 0 && (
              <CmxButton
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={handleDiscard}
              >
                {tCommon('cancel')}
              </CmxButton>
            )}
            <CmxButton
              type="button"
              variant="primary"
              loading={saveBatch.isPending}
              disabled={dirtyEntries.length === 0 || isBusy}
              onClick={handleSave}
            >
              <Save className="me-1.5 h-4 w-4" aria-hidden />
              {dirtyEntries.length > 0
                ? t('saveCount', { count: dirtyEntries.length })
                : tCommon('save')}
            </CmxButton>
          </div>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <CmxSkeletonTable rows={6} columns={1} showHeader />
      ) : query.isError ? (
        <CmxSummaryMessage type="error" title={t('loadErrorTitle')}>
          <p>{t('loadError')}</p>
        </CmxSummaryMessage>
      ) : (
        <div className="space-y-6">
          {!canManage && (
            <CmxSummaryMessage type="info">
              <p>{t('readOnlyNotice')}</p>
            </CmxSummaryMessage>
          )}

          <ExtraConfigPreview draftValues={draftValues} />

          <div className="space-y-5">
            {groupedCategories.map((group) => (
              <CmxFormSection
                key={group.categoryCode}
                title={categoryTitle(group.categoryCode)}
                layout="single"
                contentClassName="space-y-3"
              >
                {group.items.map((item) => (
                  <ExtraConfigFieldRow
                    key={item.config_key}
                    item={item}
                    draftValue={draftValues[item.config_key] ?? item.effective_value}
                    canManage={canManage}
                    isBusy={isBusy}
                    validationError={fieldErrors[item.config_key]}
                    onChange={handleFieldChange}
                    onResetKey={handleResetKey}
                  />
                ))}
              </CmxFormSection>
            ))}
          </div>
        </div>
      )}

      <CmxConfirmDialog
        open={confirmResetAll}
        onCancel={() => setConfirmResetAll(false)}
        title={t('resetAllTitle')}
        description={t('resetAllDescription')}
        confirmLabel={t('resetAllConfirm')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleResetAll}
      />
    </CmxCrudPageShell>
  );
}
