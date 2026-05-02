'use client';

import { type ChangeEvent, useCallback, useId, useMemo } from 'react';
import { CmxButton, CmxInput } from '@ui/primitives';
import { COLOR_HEX_PICKER_FALLBACK } from '@/lib/constants/css-color';
import { bridgeHexForNativePicker, parseCssHexToFull } from '@/lib/utils/color-hex';

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
}: CmxHexColorFieldProps) {
  const id = useId();
  const textId = `${id}-hex`;
  const helperId = `${id}-hint`;
  const invalidId = `${id}-err`;

  const bridge = useMemo(() => bridgeHexForNativePicker(value), [value]);
  const trimmed = value.trim();
  const isInvalid = trimmed.length > 0 && parseCssHexToFull(trimmed) === null;

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
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700" htmlFor={textId}>
        {label}
      </label>

      <div className="flex flex-wrap items-stretch gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={bridge}
          onChange={onPick}
          disabled={disabled}
          aria-label={pickerAriaLabel}
          className={[
            'h-10 w-10 shrink-0 cursor-pointer rounded-md border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]',
            'bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
          title={pickerAriaLabel}
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
            aria-describedby={
              [helperText ? helperId : '', isInvalid ? invalidId : ''].filter(Boolean).join(' ') || undefined
            }
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

      {helperText ? (
        <p id={helperId} className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {helperText}
        </p>
      ) : null}

      {invalidMessage && isInvalid ? (
        <p id={invalidId} className="text-xs text-red-600" role="alert">
          {invalidMessage}
        </p>
      ) : null}
    </div>
  );
}
