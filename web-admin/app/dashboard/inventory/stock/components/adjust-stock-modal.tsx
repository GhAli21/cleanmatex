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

export default function AdjustStockModal({ item, onClose, onSuccess, branchId: initialBranchId, branches = [] }: AdjustStockModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; reason?: string; branch?: string }>({});

  const [action, setAction] = useState<AdjustmentAction>(ADJUSTMENT_ACTIONS.INCREASE);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || '');

  const hasBranches = branches.length > 0;
  // When initialBranchId is pre-set from page filter, branch is fixed (read-only)
  const isBranchFixed = Boolean(initialBranchId);
  const fixedBranch = isBranchFixed
    ? branches.find((b) => b.id === initialBranchId)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Require branch selection — branch_id is mandatory for all stock transactions
    if (!selectedBranchId) {
      const msg = t('messages.branchRequired') || 'Please select a branch';
      setFieldErrors((prev) => ({ ...prev, branch: msg }));
      setError(msg);
      return;
    }

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
      branch_id: selectedBranchId,
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

            {/* Branch — read-only when pre-selected from page filter */}
            {isBranchFixed && fixedBranch ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t('filters.branch')}</p>
                  <p className="text-sm font-semibold text-blue-800">
                    {fixedBranch.name}
                    {fixedBranch.is_main && <span className="ml-1 text-yellow-600">★</span>}
                  </p>
                </div>
              </div>
            ) : hasBranches ? (
              /* Branch dropdown — required when no branch pre-selected */
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('filters.branch')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, branch: undefined }));
                    setError(null);
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">{t('filters.selectBranch') || 'Select branch...'}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.is_main ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.branch && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.branch}</p>
                )}
              </div>
            ) : (
              /* No branches configured */
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-700">{t('messages.noBranchConfigured')}</p>
              </div>
            )}

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
            <Button type="submit" disabled={saving || !selectedBranchId}>
              {saving ? tc('saving') : t('actions.adjust')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
