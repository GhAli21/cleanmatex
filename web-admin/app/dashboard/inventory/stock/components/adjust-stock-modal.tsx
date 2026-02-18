'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui';
import { ADJUSTMENT_ACTIONS } from '@/lib/constants/inventory';
import { stockAdjustmentSchema } from '@/lib/validations/inventory-schemas';
import { adjustStockAction } from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem, AdjustmentAction } from '@/lib/types/inventory';
import type { BranchOption } from '@/lib/services/inventory-service';

interface AdjustStockModalProps {
  item: InventoryItemListItem;
  onClose: () => void;
  onSuccess: () => void;
  branchId?: string;
  branches?: BranchOption[];
}

export default function AdjustStockModal({ item, onClose, onSuccess, branchId, branches = [] }: AdjustStockModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; reason?: string }>({});

  const [action, setAction] = useState<AdjustmentAction>(ADJUSTMENT_ACTIONS.INCREASE);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = stockAdjustmentSchema.safeParse({
      action,
      quantity: quantity === '' ? 0 : quantity,
      reason: reason.trim(),
    });

    if (!parsed.success) {
      const issues = parsed.error.flatten();
      setFieldErrors({
        quantity: issues.fieldErrors.quantity?.[0],
        reason: issues.fieldErrors.reason?.[0],
      });
      setError(issues.formErrors?.[0] ?? issues.fieldErrors.quantity?.[0] ?? issues.fieldErrors.reason?.[0] ?? null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setSaving(true);

    const result = await adjustStockAction({
      product_id: item.id,
      action: parsed.data.action,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      branch_id: branchId || undefined,
    });

    setSaving(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || t('messages.adjustFailed'));
    }
  }

  const actions: { value: AdjustmentAction; label: string }[] = [
    { value: ADJUSTMENT_ACTIONS.INCREASE, label: t('adjustActions.increase') },
    { value: ADJUSTMENT_ACTIONS.DECREASE, label: t('adjustActions.decrease') },
    { value: ADJUSTMENT_ACTIONS.SET, label: t('adjustActions.set') },
  ];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>{t('actions.adjustStock')}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {item.product_name} ({item.product_code})
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Current quantity */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">{t('labels.currentQty')}</p>
              <p className="text-2xl font-semibold">{item.qty_on_hand} <span className="text-sm font-normal text-gray-500">{item.product_unit}</span></p>
            </div>

            {/* Action radio buttons */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('labels.adjustmentType')}</p>
              <div className="flex gap-3">
                {actions.map((a) => (
                  <label key={a.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="action"
                      value={a.value}
                      checked={action === a.value}
                      onChange={() => setAction(a.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label={t('labels.quantity')}
              type="number"
              step="0.01"
              min={action === ADJUSTMENT_ACTIONS.SET ? undefined : '0'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={fieldErrors.quantity}
              required
            />

            <Input
              label={t('labels.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('placeholders.reason')}
              error={fieldErrors.reason}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tc('saving') : t('actions.adjust')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
