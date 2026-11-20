/**
 * Generic settings table for displaying resolved settings with override actions.
 *
 * Used by Tenant/Branch/User settings screens.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton, CmxInput, CmxSelect, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives';
import type { SettingDefinition, ResolvedSetting } from '@/lib/api/settings-client';

type EditMode = 'inline';

/**
 *
 */
export interface SettingsTableContext {
  scope: 'TENANT' | 'BRANCH' | 'USER';
  branchId?: string;
  userId?: string;
}

/**
 *
 */
export interface SettingsTableRow {
  definition: SettingDefinition;
  resolved?: ResolvedSetting;
  isOverridden: boolean;
  canEdit: boolean;
  /** When true, setting is EDITABLE_ONCE and already has a value; edit and reset are disabled */
  isLockedByEditPolicy?: boolean;
}

interface SettingsTableProps {
  title: string;
  description?: string;
  rows: SettingsTableRow[];
  context: SettingsTableContext;
  isLoading: boolean;
  editMode?: EditMode;
  onSaveOverride?: (row: SettingsTableRow, nextValue: any) => Promise<void> | void;
  onResetOverride?: (row: SettingsTableRow) => Promise<void> | void;
}

/**
 *
 * @param root0
 * @param root0.title
 * @param root0.description
 * @param root0.rows
 * @param root0.context
 * @param root0.isLoading
 * @param root0.editMode
 * @param root0.onSaveOverride
 * @param root0.onResetOverride
 */
export function SettingsTable({
  title,
  description,
  rows,
  context,
  isLoading,
  editMode = 'inline',
  onSaveOverride,
  onResetOverride,
}: SettingsTableProps) {
  const t = useTranslations('settings.advancedSettings');
  const tCommon = useTranslations('common');
  const [filter, setFilter] = React.useState('');
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [draftValue, setDraftValue] = React.useState<any>('');
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredRows = React.useMemo(() => {
    if (!normalizedFilter) return rows;
    return rows.filter(({ definition, resolved }) => {
      const code = definition.setting_code.toLowerCase();
      const name = definition.setting_name.toLowerCase();
      const name2 = (definition.setting_name2 || '').toLowerCase();
      const desc = (definition.setting_description || '').toLowerCase();
      const desc2 = (definition.setting_description2 || '').toLowerCase();
      const value = resolved?.stngValue;
      const valueStr =
        typeof value === 'string'
          ? value.toLowerCase()
          : value !== undefined && value !== null
          ? String(value).toLowerCase()
          : '';

      return (
        code.includes(normalizedFilter) ||
        name.includes(normalizedFilter) ||
        name2.includes(normalizedFilter) ||
        desc.includes(normalizedFilter) ||
        desc2.includes(normalizedFilter) ||
        valueStr.includes(normalizedFilter)
      );
    });
  }, [rows, normalizedFilter]);

  function openEditor(row: SettingsTableRow) {
    if (!row.canEdit || !onSaveOverride) return;
    setEditingKey(row.definition.setting_code);
    setDraftValue(row.resolved?.stngValue ?? row.definition.stng_default_value_jsonb ?? '');
  }

  async function handleSave(row: SettingsTableRow) {
    if (!onSaveOverride || editingKey !== row.definition.setting_code) return;
    try {
      setSavingKey(row.definition.setting_code);
      await onSaveOverride(row, coerceValueForType(row.definition.stng_data_type, draftValue));
    } finally {
      setSavingKey(null);
      setEditingKey(null);
    }
  }

  async function handleReset(row: SettingsTableRow) {
    if (!onResetOverride) return;
    try {
      setSavingKey(row.definition.setting_code);
      await onResetOverride(row);
    } finally {
      setSavingKey(null);
      setEditingKey(null);
    }
  }

  return (
    <CmxCard>
      <CmxCardContent className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t('tableScope', { scope: context.scope })}
              {context.branchId ? t('tableScopeBranch', { id: context.branchId }) : ''}
              {context.userId ? t('tableScopeUser', { id: context.userId }) : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CmxInput
              placeholder={t('searchSettingsPlaceholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-64"
            />
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border text-sm">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('colCode')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('colName')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('colScope')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('colEffectiveValue')}</TableHead>
                  <TableHead className="px-4 py-2 text-start font-medium text-foreground">{t('colSource')}</TableHead>
                  <TableHead className="px-4 py-2 text-end font-medium text-foreground">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border bg-card">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      {t('loadingSettings')}
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      {t('noSettingsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const { definition, resolved, isOverridden, canEdit, isLockedByEditPolicy } = row;
                    const isEditing = editMode === 'inline' && editingKey === definition.setting_code;
                    const isSaving = savingKey === definition.setting_code;

                    return (
                      <TableRow key={definition.setting_code}>
                        <TableCell className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                          {definition.setting_code}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="text-foreground text-sm font-medium">
                            {definition.setting_name}
                          </div>
                          {definition.setting_description && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {definition.setting_description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {definition.stng_scope}
                        </TableCell>
                        <TableCell className="px-4 py-3 min-w-[180px]">
                          {isEditing ? (
                            renderEditor(definition.stng_data_type, draftValue, setDraftValue, { select: tCommon('select'), boolTrue: t('boolTrue'), boolFalse: t('boolFalse') })
                          ) : (
                            <div className="text-sm text-foreground break-words">
                              {renderValue(resolved?.stngValue)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {resolved ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                isOverridden
                                  ? 'bg-info-bg text-info-text border border-info-border'
                                  : 'bg-muted text-foreground border border-border'
                              }`}
                            >
                              {resolved.stngSourceLayer}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap text-end text-xs">
                          <div className="inline-flex items-center gap-2">
                            {canEdit && (
                              <>
                                {isEditing ? (
                                  <>
                                    <CmxButton
                                      size="sm"
                                      variant="primary"
                                      loading={isSaving}
                                      onClick={() => handleSave(row)}
                                    >
                                      {tCommon('save')}
                                    </CmxButton>
                                    <CmxButton
                                      size="sm"
                                      variant="ghost"
                                      disabled={isSaving}
                                      onClick={() => setEditingKey(null)}
                                    >
                                      {tCommon('cancel')}
                                    </CmxButton>
                                  </>
                                ) : (
                                  <CmxButton
                                    size="sm"
                                    variant="outline"
                                    disabled={isSaving}
                                    onClick={() => openEditor(row)}
                                  >
                                    {tCommon('edit')}
                                  </CmxButton>
                                )}
                              </>
                            )}
                            {isOverridden && onResetOverride && !isLockedByEditPolicy && (
                              <CmxButton
                                size="sm"
                                variant="ghost"
                                disabled={isSaving}
                                onClick={() => handleReset(row)}
                              >
                                {tCommon('reset')}
                              </CmxButton>
                            )}
                            {isLockedByEditPolicy && (
                              <span className="text-xs text-warning-text" title={t('lockedTooltip')}>
                                {t('locked')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}

function renderValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderEditor(
  dataType: SettingDefinition['stng_data_type'],
  value: any,
  onChange: (next: any) => void,
  labels: { select: string; boolTrue: string; boolFalse: string },
) {
  switch (dataType) {
    case 'BOOLEAN':
      return (
        <CmxSelect
          value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const v = e.target.value;
            onChange(v === '' ? '' : v === 'true');
          }}
          className="w-28"
          options={[
            { value: '', label: labels.select },
            { value: 'true', label: labels.boolTrue },
            { value: 'false', label: labels.boolFalse },
          ]}
        />
      );
    case 'NUMBER':
    case 'NUMBER_ARRAY':
      return (
        <CmxInput
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      );
    default:
      return (
        <CmxInput
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      );
  }
}

function coerceValueForType(
  dataType: SettingDefinition['stng_data_type'],
  raw: any,
): any {
  if (raw === '' || raw === null || raw === undefined) {
    return null;
  }

  switch (dataType) {
    case 'BOOLEAN':
      return raw === true || raw === 'true';
    case 'NUMBER':
      return typeof raw === 'number' ? raw : Number(raw);
    case 'NUMBER_ARRAY':
      if (Array.isArray(raw)) return raw.map((v) => Number(v));
      return String(raw)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map((v) => Number(v));
    case 'TEXT_ARRAY':
      if (Array.isArray(raw)) return raw;
      return String(raw)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    case 'JSON':
      if (typeof raw === 'object') return raw;
      try {
        return JSON.parse(String(raw));
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

