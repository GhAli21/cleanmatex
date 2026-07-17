"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderItem } from '@/types/order';
import { useBilingual } from '@/lib/utils/bilingual';
import { formatCodeLabel } from '@/lib/utils/format-code-label';
import { CmxButton } from '@ui/primitives';

interface PrintItemLabelsProps {
  orderNo: string;
  items: OrderItem[];
}

/**
 * Printable item labels for preparation / packing handoff.
 */
export function PrintItemLabels({ orderNo, items }: PrintItemLabelsProps) {
  const t = useTranslations('workflow');
  const getBilingual = useBilingual();
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  return (
    <div className="space-y-3">
      <CmxButton
        type="button"
        variant="outline"
        className="w-full"
        disabled={printing || items.length === 0}
        loading={printing}
        onClick={handlePrint}
      >
        {t('preparation.actions.printItemLabels')}
      </CmxButton>

      <div className="hidden print:block">
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => {
            const name = formatCodeLabel(
              getBilingual(item.product_name, item.product_name2) ||
                item.service_category_code,
              t('preparation.detail.fallbackItem')
            );
            return (
              <div key={item.id} className="p-3 border border-gray-300 rounded">
                <div className="text-xs text-gray-600">{orderNo}</div>
                <div className="text-sm font-semibold text-gray-900">{name}</div>
                {item.barcode && (
                  // barcode may be a data URL from the label pipeline
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.barcode}
                    alt=""
                    className="mt-2 w-full h-16 object-contain"
                  />
                )}
                <div className="text-xs text-gray-600 mt-1">
                  {item.quantity}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
