"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderItem } from '@/types/order';
import { useBilingual } from '@/lib/utils/bilingual';
import { formatCodeLabel } from '@/lib/utils/format-code-label';
import { CmxButton } from '@ui/primitives';
import { CmxBarcode } from '@ui/print';

/**
 * Code printed on the line label (HFC P4): the line serial (ORD-...-1). A stored plain code is used when
 * there is no serial; legacy SVG data URLs (before P3) are ignored because they never held a real barcode.
 */
function lineCode(item: OrderItem): string | null {
  if (item.order_item_srno) return item.order_item_srno;
  if (item.barcode && !item.barcode.startsWith('data:')) return item.barcode;
  return null;
}

interface PrintItemLabelsProps {
  orderNo: string;
  items: OrderItem[];
}

/**
 * Printable item labels for preparation / packing handoff.
 */
export function PrintItemLabels({ orderNo, items }: PrintItemLabelsProps) {
  const t = useTranslations('workflow');
  const tl = useTranslations('labels');
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
            const code = lineCode(item);
            return (
              <div key={item.id} className="p-3 border border-gray-300 rounded">
                <div className="text-xs text-gray-600">{orderNo}</div>
                <div className="text-sm font-semibold text-gray-900">{name}</div>
                {code ? (
                  <div className="mt-2">
                    <CmxBarcode
                      kind="code128"
                      value={code}
                      label={`${tl('template.lineBarcode')} ${code}`}
                      moduleWidth={1}
                      height={40}
                      className="block [&_svg]:max-w-full [&_svg]:h-auto"
                    />
                    <div dir="ltr" className="mt-1 font-mono text-sm text-gray-900 break-all">
                      {code}
                    </div>
                  </div>
                ) : null}
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
