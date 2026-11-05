'use client';

/**
 * "Order financial summary" for an unsaved order (PLAN §6.3, D8, P6-09): a
 * button that opens the read-only statement of what payment-modal-v4 already
 * shows. The draft is built from the modal's own figures and is never written
 * back; closing returns to the modal with every entered amount untouched
 * (CRITICAL RULE #15).
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { OrderFinDraftInput } from '@/lib/types/order-fin-view';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { OrderFinancialView } from './order-financial-view';

export interface OrderDraftFinancialSummaryButtonProps {
  /** The modal's figures; null while the server quote is loading (the button is disabled). */
  draft: OrderFinDraftInput | null;
  disabled?: boolean;
}

/**
 * @param props - the draft figures and an optional disabled flag
 * @param props.draft - the modal's figures; null while the server quote loads
 * @param props.disabled - true while the modal is locked
 */
export function OrderDraftFinancialSummaryButton({ draft, disabled }: OrderDraftFinancialSummaryButtonProps) {
  const t = useTranslations('orders.finView');
  const [open, setOpen] = useState(false);
  return (
    <>
      <CmxButton type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled || !draft}>
        {t('title')}
      </CmxButton>
      {draft && (
        <CmxDialog open={open} onOpenChange={setOpen}>
          <CmxDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('title')}</CmxDialogTitle>
            </CmxDialogHeader>
            <OrderFinancialView source={{ kind: 'draft', draft }} config={{ preset: 'detailed', layout: 'sheet', density: 'compact', columns: 1 }} />
          </CmxDialogContent>
        </CmxDialog>
      )}
    </>
  );
}
