/**
 * CmxQuantityMeasureInput - the measure staff type for a measured line: one number
 * (kg, m, L, h) or length × width for an area unit, from the keyboard or an on-screen keypad.
 * It only collects text; the server computes the billed quantity from it (so the preview line
 * is passed in, never computed here). Typing is limited to the unit's decimals so a value that
 * the server would refuse cannot be entered.
 * @module ui/forms
 */
'use client';

import { useId, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxKeypadPopover } from '@ui/overlays/cmx-keypad-popover';
import { KEYPAD_NUMERIC_3COL } from '@ui/utilities/cmx-keypad-presets';
import { useRTL } from '@/lib/hooks/useRTL';
import { UOM_DIMENSIONS, type UomDimension } from '@/lib/constants/uom';
import { applyKeypadKey, typedQtyText } from '@/lib/uom/scale';

/** What staff entered; empty strings mean "not entered". */
export interface MeasureValue { measuredQty: string; length: string; width: string }

/** Props of {@link CmxQuantityMeasureInput}. */
export interface CmxQuantityMeasureInputProps {
  dimension: UomDimension;
  /** Symbol shown beside the single field (already localized). */
  unitSymbol: string;
  /** Area only: the unit length and width are typed in (already localized), e.g. m or ft; metres when omitted. */
  lengthSymbol?: string;
  /** Area only: false shows the single area field instead of length × width. Default true. */
  sizeEntry?: boolean;
  /** Decimals the typed unit allows. */
  qtyDecimals: number;
  value: MeasureValue;
  onChange: (value: MeasureValue) => void;
  /** Billed text from the server preview, e.g. "3.5 kg". */
  billedPreview?: string;
  error?: string;
  disabled?: boolean;
}

type Field = keyof MeasureValue;

/**
 * @param props - {@link CmxQuantityMeasureInputProps}
 * @returns One measure field, or length × width for an area unit, with an optional keypad
 */
export function CmxQuantityMeasureInput({ dimension, unitSymbol, lengthSymbol, sizeEntry = true, qtyDecimals, value, onChange, billedPreview, error, disabled }: CmxQuantityMeasureInputProps) {
  const t = useTranslations('uom.measure');
  const isRTL = useRTL();
  const errorId = useId();
  const isArea = dimension === UOM_DIMENSIONS.AREA && sizeEntry;
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const keypadButtonRef = useRef<HTMLButtonElement>(null);
  const measuredRef = useRef<HTMLInputElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);

  /** The field the keypad types into: the last one touched, else the first. */
  const target: Field = isArea ? (focused === 'width' ? 'width' : 'length') : 'measuredQty';
  const metre = lengthSymbol ?? t('metre');
  const labels: Record<Field, string> = {
    measuredQty: t('label', { unit: unitSymbol }),
    length: t('length', { unit: metre }),
    width: t('width', { unit: metre }),
  };
  const set = (field: Field, text: string) => onChange({ ...value, [field]: text });
  const inputProps = (field: Field) => ({
    label: labels[field],
    dir: 'ltr' as const,
    className: 'tabular-nums',
    // With the keypad open a touch device should not raise its own keyboard over it.
    inputMode: keypadOpen ? ('none' as const) : ('decimal' as const),
    disabled,
    value: value[field],
    onFocus: () => setFocused(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(field, typedQtyText(e.target.value, qtyDecimals)),
  });

  return (
    <div className="space-y-2">
      {isArea ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3">
            <CmxInput ref={lengthRef} {...inputProps('length')} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
            <CmxInput ref={widthRef} {...inputProps('width')} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      ) : (
        <CmxInput ref={measuredRef} {...inputProps('measuredQty')} error={error} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {billedPreview ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
            {t('billed', { qty: billedPreview })}
          </p>
        ) : <span />}
        <CmxButton
          ref={keypadButtonRef}
          type="button"
          variant="outline"
          size="sm"
          className="pointer-coarse:min-h-11"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={keypadOpen}
          onClick={() => setKeypadOpen((open) => !open)}
        >
          <Keyboard className="me-2 h-4 w-4" aria-hidden />
          {t('keypad')}
        </CmxButton>
      </div>
      <CmxKeypadPopover
        open={keypadOpen && !disabled}
        onClose={() => setKeypadOpen(false)}
        anchorRef={keypadButtonRef}
        linkedFieldRefs={[measuredRef, lengthRef, widthRef]}
        storageKey="cmx-measure-keypad"
        isRTL={isRTL}
        title={t('keypad')}
        echo={<bdi dir="ltr">{`${value[target] || '0'} ${isArea ? metre : unitSymbol}`}</bdi>}
        hint={labels[target]}
        dockLabel={t('keypadDock')}
        closeLabel={t('keypadClose')}
        columns={3}
        keys={KEYPAD_NUMERIC_3COL}
        // A digit is read as itself in any language; the two other keys are named.
        getKeyAriaLabel={(key) => (key === 'backspace' ? t('keypadBackspace') : key === '.' ? t('keypadDecimal') : key)}
        onKeyPress={(key) => set(target, applyKeypadKey(value[target], key, qtyDecimals))}
        onKeyLongPress={(key) => { if (key === 'backspace') set(target, ''); }}
      />
    </div>
  );
}
