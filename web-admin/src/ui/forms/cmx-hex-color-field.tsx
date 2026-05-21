'use client';
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */

import { type ChangeEvent, useCallback, useId, useMemo } from 'react';
import { CmxButton, CmxInput } from '@ui/primitives';
import { COLOR_HEX_PICKER_FALLBACK } from '@/lib/constants/css-color';
import { bridgeHexForNativePicker, parseCssHexToFull } from '@/lib/utils/color-hex';
import { CmxFieldShell } from './cmx-field-shell';

export interface CmxHexColorFieldProps {
  label: string;
  helperText?: string;
  hexPlaceholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel: string;
  pickerAriaLabel: string;
  value: string;
  onChange: (nextHexDraft: string) => void;
  /** Highlight when non-empty hex is malformed */
  invalidMessage?: string;
  presets?: string[];
  presetAriaLabel?: string;
}

/**
 * Labeled hex field with native picker + monospace input + optional clear.
 * Hex input stays LTR for readability in Arabic UI.
 */
export function CmxHexColorField({
  label,
  helperText,
  hexPlaceholder,
  disabled,
  allowClear = true,
  clearLabel,
  pickerAriaLabel,
  value,
  onChange,
  invalidMessage,
  presets = [],
  presetAriaLabel = 'Select preset color',
}: CmxHexColorFieldProps) {
  const id = useId();
  const textId = `${id}-hex`;

  const bridge = useMemo(() => bridgeHexForNativePicker(value), [value]);
  const trimmed = value.trim();
  const isInvalid = trimmed.length > 0 && parseCssHexToFull(trimmed) === null;
  const normalizedValue = parseCssHexToFull(trimmed) ?? bridge;

  const onPick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value.toUpperCase());
    },
    [onChange]
  );

  /** Commit canonical `#RRGGBB` once the user finishes editing (easier CSV / API parity). */
  const onBlurHex = useCallback(() => {
    const n = parseCssHexToFull(value);
    if (n !== null && n !== trimmed) {
      onChange(n);
    }
  }, [onChange, trimmed, value]);

  return (
    <CmxFieldShell
      id={textId}
      label={label}
      hint={helperText}
      error={invalidMessage && isInvalid ? invalidMessage : undefined}
    >
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={bridge}
          onChange={onPick}
          disabled={disabled}
          aria-label={pickerAriaLabel}
          className={[
            'h-11 w-11 shrink-0 cursor-pointer rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]',
            'bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))] p-1 shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
          title={pickerAriaLabel}
        />

        <div
          className="hidden h-11 w-11 shrink-0 rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] shadow-inner md:block"
          style={{ backgroundColor: normalizedValue }}
          aria-hidden="true"
        />

        <div dir="ltr" className="min-w-0 flex-1 basis-[140px]" lang="en">
          <CmxInput
            id={textId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={hexPlaceholder ?? COLOR_HEX_PICKER_FALLBACK}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={disabled}
            onBlur={onBlurHex}
            aria-invalid={isInvalid}
            className="w-full font-mono uppercase"
          />
        </div>

        {allowClear ? (
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 px-3"
            disabled={disabled || trimmed.length === 0}
            onClick={() => onChange('')}
          >
            {clearLabel}
          </CmxButton>
        ) : null}
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const normalizedPreset = parseCssHexToFull(preset);
            if (!normalizedPreset) {
              return null;
            }

            const isSelected = normalizedPreset === normalizedValue;

            return (
              <button
                key={normalizedPreset}
                type="button"
                aria-label={`${presetAriaLabel}: ${normalizedPreset}`}
                className={[
                  'h-9 w-9 rounded-full border-2 shadow-sm transition',
                  isSelected
                    ? 'border-[rgb(var(--cmx-primary-rgb,37_99_235))] ring-2 ring-[rgb(var(--cmx-focus-ring-rgb,59_130_246))]/20'
                    : 'border-white hover:scale-[1.03]',
                ].join(' ')}
                style={{ backgroundColor: normalizedPreset }}
                onClick={() => onChange(normalizedPreset)}
                disabled={disabled}
              />
            );
          })}
        </div>
      ) : null}
    </CmxFieldShell>
  );
}
