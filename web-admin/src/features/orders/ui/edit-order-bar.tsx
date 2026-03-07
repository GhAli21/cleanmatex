/**
 * Edit Order Bar
 * Shows edit mode indicator and Cancel button when editing an order
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import { X } from 'lucide-react';

interface EditOrderBarProps {
  orderNo: string | null;
  onCancelEdit: () => void;
  isCancelling?: boolean;
}

export function EditOrderBar({ orderNo, onCancelEdit, isCancelling = false }: EditOrderBarProps) {
  const t = useTranslations('orders.edit');
  const isRTL = useRTL();

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg"
      role="status"
      aria-label={t('editModeLabel', { orderNo: orderNo || '' }) || `Editing Order ${orderNo}`}
    >
      <span className="text-sm font-medium text-amber-800">
        {t('editModeLabel', { orderNo: orderNo || '' }) || `Editing Order ${orderNo}`}
      </span>
      <CmxButton
        variant="outline"
        size="sm"
        onClick={onCancelEdit}
        disabled={isCancelling}
        loading={isCancelling}
        className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}
        aria-label={t('cancelEdit')}
      >
        <X className="w-4 h-4" />
        {t('cancelEdit')}
      </CmxButton>
    </div>
  );
}
