/**
 * MeasureLineDialog - staff enter what they measured for a measured product (kg, m, L, h, length × width)
 * before it goes into the cart. The billed quantity shown here is the server's own resolver
 * (`resolveBilledMeasure`) as a preview; the cart quote stays the authority.
 * @module orders/ui
 */
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSelect } from '@ui/primitives/cmx-select';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays/cmx-dialog';
import { CmxQuantityMeasureInput, type MeasureValue } from '@ui/forms/cmx-quantity-measure-input';
import { resolveBilledMeasure } from '@/lib/commercial/measure';
import { convertMeasure, sizeMeasure, type MeasureEntryUnit } from '../model/measure-entry';
import { UOM_DIMENSIONS, type UomDimension } from '@/lib/constants/uom';
import type { OrderItemMeasure, OrderItemUom } from '../model/new-order-types';

const EMPTY: OrderItemMeasure = { measuredQty: '', length: '', width: '' };

/** Props of {@link MeasureLineDialog}. */
export interface MeasureLineDialogProps {
  open: boolean;
  /** The product's display name. */
  productName: string;
  uom: OrderItemUom;
  /** The current measure when the line is already in the cart (in the product's unit). */
  initial?: OrderItemMeasure;
  /** Units the measure may be typed in, the product's own first (an area line's size: metres first). One or none hides the choice. */
  entryUnits?: readonly MeasureEntryUnit[];
  /** Area lines: one square metre in the line's unit. Without it only the area itself can be typed. */
  areaRate?: string | null;
  /** Re-measure after a piece-count change: what happened, shown under the title (announced politely). */
  notice?: string;
  /** A refusal of the last Confirm, shown above the buttons. */
  refusal?: string;
  /**
   * Adding an article: the lines that could take it instead of a new line (Cart Line Grouping §4.1).
   * Asked when staff press Add; null or no options adds a new line at once.
   */
  mergeChoice?: (measure: OrderItemMeasure) => MeasureMergeChoice | null;
  /** Staff chose to add the article to an existing line. */
  onMerge?: (lineKey: string, measure: OrderItemMeasure) => void;
  onConfirm: (measure: OrderItemMeasure) => void;
  onClose: () => void;
}

/** The choice shown after Add when a line with this measure is already in the order. All text is ready to show. */
export interface MeasureMergeChoice {
  title: string;
  options: Array<{ lineKey: string; label: string; result: string; priceNote?: string }>;
  newLineLabel: string;
  newLinePriceNote?: string;
  /** Shown when the minimum or billing step applies to the line total. */
  note?: string;
}

/** The resolver's verdict on what was typed: the billed result, or the `uom.errors` code to show. */
function check(uom: OrderItemUom, value: MeasureValue) {
  try {
    const m = resolveBilledMeasure({
      dimension: uom.dimension, qtyDecimals: uom.qtyDecimals,
      measuredQty: value.measuredQty || undefined, length: value.length || undefined, width: value.width || undefined,
      minBillableQty: uom.minBillableQty, billingIncrement: uom.billingIncrement,
    });
    return { ok: true as const, billed: m.billedQty.toString(), minimumApplied: m.minimumApplied, incrementApplied: m.incrementApplied };
  } catch (e) {
    return { ok: false as const, code: (e as { code?: string }).code ?? 'GENERIC' };
  }
}

/** Dialog body; remounted on every open so it starts from `initial`. */
function MeasureForm({ productName, uom, initial, entryUnits, areaRate, notice, refusal, mergeChoice, onMerge, onConfirm, onClose }: Omit<MeasureLineDialogProps, 'open'>) {
  const t = useTranslations('uom');
  const tCommon = useTranslations('common');
  const ar = useLocale() === 'ar';
  // What staff type, in the chosen entry unit; the line's measure is derived from it.
  const [typedValue, setTypedValue] = useState<MeasureValue>(initial ?? EMPTY);
  const [entryCode, setEntryCode] = useState('');
  const [choice, setChoice] = useState<MeasureMergeChoice | null>(null);
  const isArea = uom.dimension === UOM_DIMENSIONS.AREA;
  // An area is typed as length × width unless it was saved without a size.
  const [bySize, setBySize] = useState(!initial?.measuredQty || !!initial.length);
  const base = entryUnits?.[0];
  // The size needs the length units and the square-metre rate; until they load only the area can be typed.
  const sizing = isArea && bySize && !!base && !!areaRate;
  const entry = entryUnits?.find((u) => u.code === entryCode);
  const converting = !isArea && !!entry && !!base && entry.code !== base.code;
  const sizeUnit = entry ?? base;
  const value = useMemo<MeasureValue>(() => {
    if (sizing && sizeUnit && areaRate) return sizeMeasure(typedValue, sizeUnit.rate, areaRate, uom.qtyDecimals);
    if (isArea) return { measuredQty: typedValue.measuredQty, length: '', width: '' };
    return converting && entry ? convertMeasure(typedValue, entry.rate, uom.qtyDecimals) : typedValue;
  }, [sizing, sizeUnit, areaRate, isArea, converting, entry, typedValue, uom.qtyDecimals]);
  const add = () => {
    const found = mergeChoice?.(value);
    if (found && found.options.length > 0 && onMerge) setChoice(found);
    else onConfirm(value);
  };

  const symbol = ar && uom.symbol2 ? uom.symbol2 : uom.symbol;
  const result = useMemo(() => check(uom, value), [uom, value]);
  const typed = !!(typedValue.measuredQty || typedValue.length || typedValue.width);
  const symbolOf = (u: Pick<MeasureEntryUnit, 'symbol' | 'symbol2'>) => (ar && u.symbol2 ? u.symbol2 : u.symbol);
  /** "2 m × 3 m = 7.18 yd²" or "2 lb = 0.907 kg": the figure that will be saved, shown before it is. */
  const conversionLine = () => {
    if (sizing && sizeUnit) {
      if (!typedValue.length || !typedValue.width || !value.measuredQty) return null;
      const side = symbolOf(sizeUnit);
      return t('measure.converted', {
        entered: `${typedValue.length} ${side} × ${typedValue.width} ${side}`, converted: `${value.measuredQty} ${symbol}`,
      });
    }
    if (!converting || !entry || !typedValue.measuredQty || !value.measuredQty) return null;
    return t('measure.converted', { entered: `${typedValue.measuredQty} ${symbolOf(entry)}`, converted: `${value.measuredQty} ${symbol}` });
  };
  const converted = conversionLine();
  // Silent until staff start typing; then the resolver's reason is shown next to the field.
  const error = typed && !result.ok ? (t.has(`errors.${result.code}`) ? t(`errors.${result.code}`) : t('errors.GENERIC')) : undefined;

  if (choice) {
    return (
      <>
        <CmxDialogHeader><CmxDialogTitle>{choice.title}</CmxDialogTitle></CmxDialogHeader>
        <div className="space-y-2">
          {choice.options.map((option, index) => (
            <CmxButton
              key={option.lineKey}
              variant={index === 0 ? 'primary' : 'outline'}
              className="h-auto w-full flex-col items-start gap-0.5 py-2 text-start pointer-coarse:min-h-11"
              autoFocus={index === 0}
              onClick={() => onMerge?.(option.lineKey, value)}
            >
              <span>{option.label}</span>
              <span className="text-xs font-normal opacity-90 tabular-nums" aria-live="polite">{option.result}</span>
              {option.priceNote && <span className="text-xs font-normal opacity-90 tabular-nums">{option.priceNote}</span>}
            </CmxButton>
          ))}
          <CmxButton
            variant="outline"
            className="h-auto w-full flex-col items-start gap-0.5 py-2 text-start pointer-coarse:min-h-11"
            onClick={() => onConfirm(value)}
          >
            <span>{choice.newLineLabel}</span>
            {choice.newLinePriceNote && <span className="text-xs font-normal text-muted-foreground tabular-nums">{choice.newLinePriceNote}</span>}
          </CmxButton>
          {choice.note && <p className="text-xs text-muted-foreground">{choice.note}</p>}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="ghost" className="pointer-coarse:min-h-11" onClick={() => setChoice(null)}>{tCommon('back')}</CmxButton>
        </CmxDialogFooter>
      </>
    );
  }

  return (
    <>
      <CmxDialogHeader><CmxDialogTitle>{t('measure.dialogTitle', { product: productName })}</CmxDialogTitle></CmxDialogHeader>
      <div className="space-y-3">
        {notice && <p role="status" aria-live="polite" className="text-sm text-foreground">{notice}</p>}
        {isArea && base && areaRate && (
          <CmxSelect
            label={t('measure.enterAs')}
            value={bySize ? 'SIZE' : 'AREA'}
            // The typed figures belong to the other way of entering, so they are cleared rather than reread.
            onChange={(e) => { setBySize(e.target.value === 'SIZE'); setTypedValue(EMPTY); }}
            options={[{ value: 'SIZE', label: t('measure.bySize') }, { value: 'AREA', label: t('measure.byArea', { unit: symbol }) }]}
          />
        )}
        {entryUnits && entryUnits.length > 1 && (!isArea || sizing) && (
          <CmxSelect
            label={t('measure.enterIn')}
            value={entry?.code ?? entryUnits[0].code}
            // The typed figures belong to the previous unit, so they are cleared rather than reread.
            onChange={(e) => { setEntryCode(e.target.value); setTypedValue(EMPTY); }}
            options={entryUnits.map((u) => ({ value: u.code, label: `${u.code} (${symbolOf(u)})` }))}
          />
        )}
        <CmxQuantityMeasureInput
          dimension={uom.dimension as UomDimension}
          unitSymbol={converting && entry ? symbolOf(entry) : symbol}
          lengthSymbol={sizing && sizeUnit ? symbolOf(sizeUnit) : undefined}
          sizeEntry={sizing}
          // Typed figures keep the decimals of the unit they are typed in.
          qtyDecimals={sizing && sizeUnit ? sizeUnit.qtyDecimals : converting && entry ? entry.qtyDecimals : uom.qtyDecimals}
          value={typedValue}
          onChange={setTypedValue}
          error={error}
          billedPreview={result.ok ? `${result.billed} ${symbol}` : undefined}
        />
        {converted && (
          <p role="status" aria-live="polite" className="text-sm text-foreground tabular-nums">
            <bdi dir="ltr">{converted}</bdi>
          </p>
        )}
        {result.ok && (result.minimumApplied || result.incrementApplied) && (
          <p className="text-xs text-muted-foreground">{t(result.minimumApplied ? 'measure.minimumApplied' : 'measure.incrementApplied')}</p>
        )}
        {(uom.minBillableQty || uom.billingIncrement) && (
          <ul className="text-xs text-muted-foreground list-disc ps-4 tabular-nums">
            {uom.minBillableQty && <li>{t('measure.minRule', { qty: `${uom.minBillableQty} ${symbol}` })}</li>}
            {uom.billingIncrement && <li>{t('measure.stepRule', { qty: `${uom.billingIncrement} ${symbol}` })}</li>}
          </ul>
        )}
        {refusal && <p role="alert" className="text-sm text-destructive">{refusal}</p>}
      </div>
      <CmxDialogFooter>
        <CmxButton variant="outline" className="pointer-coarse:min-h-11" onClick={onClose}>{tCommon('cancel')}</CmxButton>
        <CmxButton className="pointer-coarse:min-h-11" disabled={!result.ok} onClick={() => (notice || initial ? onConfirm(value) : add())}>{notice ? tCommon('confirm') : initial ? tCommon('save') : tCommon('add')}</CmxButton>
      </CmxDialogFooter>
    </>
  );
}

/**
 * @param props - {@link MeasureLineDialogProps}
 * @returns the Measure dialog; confirm is enabled only for a measure the server would accept
 */
export function MeasureLineDialog({ open, onClose, ...rest }: MeasureLineDialogProps) {
  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-md w-full mx-4" data-testid="measure-line-dialog">
        {open && <MeasureForm {...rest} onClose={onClose} />}
      </CmxDialogContent>
    </CmxDialog>
  );
}
