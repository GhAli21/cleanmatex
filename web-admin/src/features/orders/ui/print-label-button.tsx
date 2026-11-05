'use client';

/**
 * Print buttons for an order (HFC P4, T4.5): the order label and the piece tags.
 *
 * Always enabled: the label is built from the order number and piece codes (CODE128 + staff QR) on demand,
 * so it no longer needs stored qr_code / barcode images. Printing goes through useLabelPrint (hidden iframe,
 * React-rendered, sized from the tenant/branch label settings); no pop-up and no HTML built from strings.
 */
import { Printer, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { useLabelPrint } from '@/lib/hooks/use-label-print';

/** Minimal order shape for label printing (server may send partial joins). */
export type PrintLabelOrderInput = {
  id: string;
  order_no: string;
  // org_orders_mst.qr_code / barcode dropped by HFC 0696 (FOLLOWUPS #5)
  ready_by?: Date | string | null;
  org_customers_mst?: {
    sys_customers_mst?: {
      first_name?: string;
      last_name?: string | null;
    };
  } | null;
};

interface PrintLabelButtonProps {
  order: PrintLabelOrderInput;
  /** Also show "Print piece tags" (default true). */
  showPieceTags?: boolean;
}

export function PrintLabelButton({ order, showPieceTags = true }: PrintLabelButtonProps) {
  const t = useTranslations('orders.printLabel');
  const tl = useTranslations('labels');
  const { printOrderLabel, printPieceTags, printing } = useLabelPrint();

  return (
    <div className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={tl('actions.menu')}>
      <CmxButton
        type="button"
        size="sm"
        className="gap-2"
        loading={printing === 'order-label'}
        disabled={printing !== null}
        title={t('title')}
        onClick={() => void printOrderLabel(order.id)}
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        {printing === 'order-label' ? t('printing') : t('printLabel')}
      </CmxButton>
      {showPieceTags ? (
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          loading={printing === 'piece-tag'}
          disabled={printing !== null}
          onClick={() => void printPieceTags(order.id, 'all')}
        >
          <Tags className="h-4 w-4" aria-hidden="true" />
          {printing === 'piece-tag' ? tl('actions.printing') : tl('actions.printPieceTags')}
        </CmxButton>
      ) : null}
    </div>
  );
}
