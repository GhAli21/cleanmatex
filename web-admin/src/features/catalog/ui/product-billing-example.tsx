/**
 * ProductBillingExample - on the product form, shows what a measured product will charge:
 * "2.4 kg · billed 3 kg (minimum) × 1.200 OMR". Computed with the pricing rule itself.
 * @module features/catalog/ui
 */
'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { billingExamples } from '@/lib/commercial/measure'
import { formatUnitPriceWithCode } from '@/lib/money/format-money'
import { formatLineMeasure } from '@/lib/orders/line-qualifier-format'
import type { UomUnit } from '@/lib/types/uom'

/** Props of {@link ProductBillingExample}. */
export interface ProductBillingExampleProps {
  unit: Pick<UomUnit, 'code' | 'symbol' | 'symbol2' | 'qtyDecimals'>
  minBillableQty?: string | null
  billingIncrement?: string | null
  /** The price of one unit as typed on the form. */
  unitPrice: number
}

/**
 * @param props - {@link ProductBillingExampleProps}
 * @returns the sample lines, or the note that the measure is billed as it is
 */
export function ProductBillingExample({ unit, minBillableQty, billingIncrement, unitPrice }: ProductBillingExampleProps) {
  const t = useTranslations('uom')
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  const { currencyCode, decimalPlaces } = useTenantCurrency()
  const examples = billingExamples({ qtyDecimals: unit.qtyDecimals, minBillableQty, billingIncrement })

  return (
    <div className="rounded-[var(--cmx-radius-md)] border border-border bg-surface-muted px-4 py-3 text-sm sm:col-span-2" role="status" aria-live="polite">
      {examples.length === 0 ? (
        <p className="text-muted-foreground">{t('product.billedAsMeasured')}</p>
      ) : (
        <>
          <p className="font-medium text-foreground">{t('product.example')}</p>
          <ul className="mt-1 space-y-0.5 tabular-nums text-muted-foreground">
            {examples.map((example) => (
              <li key={example.measuredQty}>
                {formatLineMeasure(
                  {
                    qty: example.measuredQty, billedQty: example.billedQty, uomCode: unit.code,
                    symbol: unit.symbol, symbol2: unit.symbol2, qtyDecimals: unit.qtyDecimals,
                    minBillableQty: minBillableQty || null, billingIncrement: billingIncrement || null,
                    unitPrice: String(unitPrice || 0),
                  },
                  {
                    locale, t,
                    formatUnitPrice: (price) => formatUnitPriceWithCode(price, { currencyCode, decimalPlaces, locale }),
                  }
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
