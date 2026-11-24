/**
 * CmxQuantityMeasureInput - the measure staff type for a measured line: one number
 * (kg, m, L, h) or length × width for an area unit. It only collects text; the server
 * computes the billed quantity from it (so the preview line is passed in, never computed here).
 * Typing is limited to the unit's decimals so a value that the server would refuse cannot be entered.
 * @module ui/forms
 */
'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { CmxInput } from '@ui/primitives/cmx-input';
import { UOM_DIMENSIONS, type UomDimension } from '@/lib/constants/uom';

/** What staff entered; empty strings mean "not entered". */
export interface MeasureValue { measuredQty: string; length: string; width: string }

/** Props of {@link CmxQuantityMeasureInput}. */
export interface CmxQuantityMeasureInputProps {
  dimension: UomDimension;
  /** Symbol shown beside the field (already localized). */
  unitSymbol: string;
  /** Decimals the unit allows. */
  qtyDecimals: number;
  value: MeasureValue;
  onChange: (value: MeasureValue) => void;
  /** Billed text from the server preview, e.g. "3.5 kg". */
  billedPreview?: string;
  error?: string;
  disabled?: boolean;
}

/** Keeps digits and one dot, trimmed to `decimals` places. */
function clean(raw: string, decimals: number): string {
  const text = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [int, ...rest] = text.split('.');
  return rest.length === 0 ? int : decimals === 0 ? int : `${int}.${rest.join('').slice(0, decimals)}`;
}

/**
 * @param props - {@link CmxQuantityMeasureInputProps}
 * @returns One measure field, or length × width for an area unit
 */
export function CmxQuantityMeasureInput({ dimension, unitSymbol, qtyDecimals, value, onChange, billedPreview, error, disabled }: CmxQuantityMeasureInputProps) {
  const t = useTranslations('uom.measure');
  const errorId = useId();
  const isArea = dimension === UOM_DIMENSIONS.AREA;
  const set = (k: keyof MeasureValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: clean(e.target.value, qtyDecimals) });

  return (
    <div className="space-y-2">
      {isArea ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3">
            <CmxInput
              label={t('length')}
              dir="ltr"
              className="tabular-nums"
              inputMode="decimal"
              disabled={disabled}
              value={value.length}
              onChange={set('length')}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
            />
            <CmxInput
              label={t('width')}
              dir="ltr"
              className="tabular-nums"
              inputMode="decimal"
              disabled={disabled}
              value={value.width}
              onChange={set('width')}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      ) : (
        <CmxInput
          label={t('label', { unit: unitSymbol })}
          dir="ltr"
          className="tabular-nums"
          inputMode="decimal"
          disabled={disabled}
          value={value.measuredQty}
          onChange={set('measuredQty')}
          error={error}
        />
      )}
      {billedPreview && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {t('billed', { qty: billedPreview })}
        </p>
      )}
    </div>
  );
}
