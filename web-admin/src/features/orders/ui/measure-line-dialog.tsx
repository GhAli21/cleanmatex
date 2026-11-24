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
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays/cmx-dialog';
import { CmxQuantityMeasureInput, type MeasureValue } from '@ui/forms/cmx-quantity-measure-input';
import { resolveBilledMeasure } from '@/lib/commercial/measure';
import type { UomDimension } from '@/lib/constants/uom';
import type { OrderItemMeasure, OrderItemUom } from '../model/new-order-types';

const EMPTY: OrderItemMeasure = { measuredQty: '', length: '', width: '' };

/** Props of {@link MeasureLineDialog}. */
export interface MeasureLineDialogProps {
  open: boolean;
  /** The product's display name. */
  productName: string;
  uom: OrderItemUom;
  /** The current measure when the line is already in the cart. */
  initial?: OrderItemMeasure;
  onConfirm: (measure: OrderItemMeasure) => void;
  onClose: () => void;
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
function MeasureForm({ productName, uom, initial, onConfirm, onClose }: Omit<MeasureLineDialogProps, 'open'>) {
  const t = useTranslations('uom');
  const tCommon = useTranslations('common');
  const ar = useLocale() === 'ar';
  const [value, setValue] = useState<MeasureValue>(initial ?? EMPTY);
  const symbol = ar && uom.symbol2 ? uom.symbol2 : uom.symbol;
  const result = useMemo(() => check(uom, value), [uom, value]);
  const typed = !!(value.measuredQty || value.length || value.width);
  // Silent until staff start typing; then the resolver's reason is shown next to the field.
  const error = typed && !result.ok ? (t.has(`errors.${result.code}`) ? t(`errors.${result.code}`) : t('errors.GENERIC')) : undefined;

  return (
    <>
      <CmxDialogHeader><CmxDialogTitle>{t('measure.dialogTitle', { product: productName })}</CmxDialogTitle></CmxDialogHeader>
      <div className="space-y-3">
        <CmxQuantityMeasureInput
          dimension={uom.dimension as UomDimension}
          unitSymbol={symbol}
          qtyDecimals={uom.qtyDecimals}
          value={value}
          onChange={setValue}
          error={error}
          billedPreview={result.ok ? `${result.billed} ${symbol}` : undefined}
        />
        {result.ok && (result.minimumApplied || result.incrementApplied) && (
          <p className="text-xs text-muted-foreground">{t(result.minimumApplied ? 'measure.minimumApplied' : 'measure.incrementApplied')}</p>
        )}
        {(uom.minBillableQty || uom.billingIncrement) && (
          <ul className="text-xs text-muted-foreground list-disc ps-4 tabular-nums">
            {uom.minBillableQty && <li>{t('measure.minRule', { qty: `${uom.minBillableQty} ${symbol}` })}</li>}
            {uom.billingIncrement && <li>{t('measure.stepRule', { qty: `${uom.billingIncrement} ${symbol}` })}</li>}
          </ul>
        )}
      </div>
      <CmxDialogFooter>
        <CmxButton variant="outline" className="pointer-coarse:min-h-11" onClick={onClose}>{tCommon('cancel')}</CmxButton>
        <CmxButton className="pointer-coarse:min-h-11" disabled={!result.ok} onClick={() => onConfirm(value)}>{initial ? tCommon('save') : tCommon('add')}</CmxButton>
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
