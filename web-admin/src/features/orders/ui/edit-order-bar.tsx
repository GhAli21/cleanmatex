/**
 * Edit Order Bar
 * Shows edit mode indicator, Save and Cancel buttons when editing an order
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import { Check, X } from 'lucide-react';

interface EditOrderBarProps {
  orderNo: string | null;
  onCancelEdit: () => void;
  onSave: () => void;
  isDirty: boolean;
  isCancelling?: boolean;
  isSaving?: boolean;
}

export function EditOrderBar({
  orderNo,
  onCancelEdit,
  onSave,
  isDirty,
  isCancelling = false,
  isSaving = false,
}: EditOrderBarProps) {
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
      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <CmxButton
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving || isCancelling}
          loading={isSaving}
          className="gap-1.5"
          aria-label={t('saveChanges')}
        >
          <Check className="w-4 h-4" />
          {t('saveChanges')}
        </CmxButton>
        <CmxButton
          variant="outline"
          size="sm"
          onClick={onCancelEdit}
          disabled={isCancelling || isSaving}
          loading={isCancelling}
          className="gap-1.5"
          aria-label={t('cancelEdit')}
        >
          <X className="w-4 h-4" />
          {t('cancelEdit')}
        </CmxButton>
      </div>
    </div>
  );
}
