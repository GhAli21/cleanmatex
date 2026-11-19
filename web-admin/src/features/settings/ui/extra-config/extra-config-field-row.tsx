'use client';

/**
 * List-assisted configuration field row for `/dashboard/settings/extra-config`.
 * Renders `CmxSelectDropdown` (4+ options), `CmxRadioGroup` (2-3 SELECT options),
 * `CmxSwitch` (BOOLEAN), or bounded `CmxInput` (NUMBER/TEXT) with System Default
 * vs Custom Override badges, lock indicators, and one-click reset.
 *
 * @module features/settings/ui/extra-config/extra-config-field-row
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, RotateCcw } from 'lucide-react';
import { useBilingual } from '@/lib/utils/bilingual';
import {
  CmxButton,
  CmxInput,
  CmxSwitch,
  Label,
} from '@ui/primitives';
import {
  CmxRadioGroup,
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { CmxStatusBadge } from '@ui/feedback';
import { EXTRA_CONFIG_VALUE_TYPES } from '@/lib/constants/tenant-extra-config';
import type { ExtraConfigItemView } from '@/lib/types/tenant-extra-config';

interface ExtraConfigFieldRowProps {
  item: ExtraConfigItemView;
  draftValue: string;
  canManage: boolean;
  isBusy: boolean;
  validationError?: string;
  onChange: (configKey: string, nextValue: string) => void;
  onResetKey: (configKey: string) => void;
}

/**
 * Single configuration row with curated bilingual list assistance and source badge.
 */
export function ExtraConfigFieldRow({
  item,
  draftValue,
  canManage,
  isBusy,
  validationError,
  onChange,
  onResetKey,
}: ExtraConfigFieldRowProps) {
  const t = useTranslations('settings.extraConfig');
  const getBilingual = useBilingual();
  const controlId = useId();

  const label = getBilingual(item.name, item.name2) || item.config_key;
  const description = getBilingual(item.description, item.description2);
  const editable = canManage && item.is_editable_by_tenant && item.plan_allowed;
  const isModifiedFromDefault = draftValue !== item.default_value;
  const isDirty = draftValue !== item.effective_value;

  const defaultOption = item.allowed_values.find((o) => o.value === item.default_value);
  const defaultDisplay = defaultOption
    ? getBilingual(defaultOption.label, defaultOption.label2)
    : item.default_value;

  const renderControl = () => {
    if (item.value_type === EXTRA_CONFIG_VALUE_TYPES.BOOLEAN) {
      const checked = draftValue === 'TRUE';
      const trueOpt = item.allowed_values.find((o) => o.value === 'TRUE');
      const falseOpt = item.allowed_values.find((o) => o.value === 'FALSE');
      const statusText = checked
        ? (trueOpt ? getBilingual(trueOpt.label, trueOpt.label2) : t('enabled'))
        : (falseOpt ? getBilingual(falseOpt.label, falseOpt.label2) : t('disabled'));

      return (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <CmxSwitch
            id={controlId}
            checked={checked}
            disabled={!editable || isBusy}
            onCheckedChange={(next) => onChange(item.config_key, next ? 'TRUE' : 'FALSE')}
            aria-label={label}
          />
          <Label htmlFor={controlId} className="text-sm font-medium text-foreground cursor-pointer">
            {statusText}
          </Label>
        </div>
      );
    }

    if (
      item.value_type === EXTRA_CONFIG_VALUE_TYPES.SELECT &&
      item.allowed_values.length > 0 &&
      item.allowed_values.length <= 3
    ) {
      return (
        <CmxRadioGroup
          name={`extra-config-${item.config_key}`}
          value={draftValue}
          disabled={!editable || isBusy}
          onChange={(val) => onChange(item.config_key, val)}
          options={item.allowed_values.map((opt) => {
            const optLabel = getBilingual(opt.label, opt.label2);
            const optDesc = getBilingual(opt.description, opt.description2);
            const isSystemOpt = opt.value === item.default_value;
            return {
              value: opt.value,
              label: (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{optLabel}</span>
                  {isSystemOpt && (
                    <CmxStatusBadge size="sm" tone="neutral" appearance="outline" label={t('defaultTag')} />
                  )}
                </span>
              ),
              description: optDesc || undefined,
            };
          })}
        />
      );
    }

    if (item.value_type === EXTRA_CONFIG_VALUE_TYPES.SELECT && item.allowed_values.length > 0) {
      return (
        <div className="max-w-md space-y-1.5">
          <CmxSelectDropdown
            value={draftValue}
            disabled={!editable || isBusy}
            onValueChange={(val) => onChange(item.config_key, val)}
          >
            <CmxSelectDropdownTrigger id={controlId} className="w-full" aria-label={label}>
              <CmxSelectDropdownValue />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              {item.allowed_values.map((opt) => {
                const optLabel = getBilingual(opt.label, opt.label2);
                const isSystemOpt = opt.value === item.default_value;
                return (
                  <CmxSelectDropdownItem key={opt.value} value={opt.value}>
                    {optLabel}
                    {isSystemOpt ? ` (${t('defaultTag')})` : ''}
                  </CmxSelectDropdownItem>
                );
              })}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>
      );
    }

    return (
      <div className="max-w-md space-y-1">
        <CmxInput
          id={controlId}
          type={item.value_type === EXTRA_CONFIG_VALUE_TYPES.NUMBER ? 'number' : 'text'}
          value={draftValue}
          disabled={!editable || isBusy}
          min={item.min_num ?? undefined}
          max={item.max_num ?? undefined}
          onChange={(e) => onChange(item.config_key, e.target.value)}
          aria-label={label}
        />
        {(item.min_num !== null || item.max_num !== null) && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('rangeHint', {
              min: item.min_num ?? '—',
              max: item.max_num ?? '—',
            })}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={controlId} className="text-sm font-semibold text-foreground">
              {label}
            </Label>
            {isModifiedFromDefault ? (
              <CmxStatusBadge size="sm" tone="brand" label={t('customOverride')} />
            ) : (
              <CmxStatusBadge size="sm" tone="neutral" label={t('systemDefault')} />
            )}
            {isDirty && (
              <CmxStatusBadge size="sm" tone="warning" label={t('unsavedBadge')} />
            )}
            {(!item.is_editable_by_tenant || !item.plan_allowed) && (
              <CmxStatusBadge
                size="sm"
                tone="neutral"
                appearance="outline"
                label={
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" aria-hidden />
                    {!item.plan_allowed ? t('planLocked') : t('hqLocked')}
                  </span>
                }
              />
            )}
          </div>

          {description && (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}

          <p className="text-xs text-muted-foreground">
            {t('defaultValueLabel')}: <span className="font-medium text-foreground">{defaultDisplay}</span>
          </p>
        </div>

        {(item.is_overridden || isModifiedFromDefault) && editable && (
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              if (item.is_overridden) {
                onResetKey(item.config_key);
              } else {
                onChange(item.config_key, item.default_value);
              }
            }}
          >
            <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {t('resetKey')}
          </CmxButton>
        )}
      </div>

      <div className="mt-3">{renderControl()}</div>

      {validationError && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {validationError}
        </p>
      )}
    </div>
  );
}
