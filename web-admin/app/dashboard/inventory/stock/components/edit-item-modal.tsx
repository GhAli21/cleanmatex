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
  Select,
} from '@/components/ui';
import { UNITS_OF_MEASURE } from '@/lib/constants/inventory';
import { updateInventoryItemAction, deleteInventoryItemAction } from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem } from '@/lib/types/inventory';

interface EditItemModalProps {
  item: InventoryItemListItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditItemModal({ item, onClose, onSuccess }: EditItemModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productName, setProductName] = useState(item.product_name || '');
  const [productName2, setProductName2] = useState(item.product_name2 || '');
  const [productUnit, setProductUnit] = useState(item.product_unit || 'piece');
  const [reorderPoint, setReorderPoint] = useState(String(item.reorder_point || 0));
  const [productCost, setProductCost] = useState(String(item.product_cost || 0));
  const [sellPrice, setSellPrice] = useState(String(item.default_sell_price || 0));
  const [skuValue, setSkuValue] = useState(item.id_sku || '');
  const [storageLocation, setStorageLocation] = useState(item.storage_location || '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    const result = await updateInventoryItemAction({
      id: item.id,
      product_name: productName.trim(),
      product_name2: productName2.trim() || undefined,
      product_unit: productUnit,
      reorder_point: parseFloat(reorderPoint) || 0,
      product_cost: parseFloat(productCost) || 0,
      default_sell_price: parseFloat(sellPrice) || 0,
      id_sku: skuValue.trim() || undefined,
      storage_location: storageLocation.trim() || undefined,
    });

    setSaving(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || t('messages.updateFailed'));
    }
  }

  async function handleDelete() {
    if (!confirm(t('messages.confirmDelete'))) return;

    setDeleting(true);
    setError(null);

    const result = await deleteInventoryItemAction(item.id);
    setDeleting(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || t('messages.deleteFailed'));
    }
  }

  const unitOptions = Object.values(UNITS_OF_MEASURE).map((u) => ({
    value: u,
    label: t(`units.${u}`),
  }));

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-lg mx-4">
        <DialogHeader>
          <DialogTitle>{t('actions.editItem')} — {item.product_code}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <Input
              label={t('labels.itemName') + ' (EN)'}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
            />
            <Input
              label={t('labels.itemName') + ' (AR)'}
              value={productName2}
              onChange={(e) => setProductName2(e.target.value)}
              dir="rtl"
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('labels.unit')}
                value={productUnit}
                onChange={(e) => setProductUnit(e.target.value)}
                options={unitOptions}
              />
              <Input
                label={t('labels.sku')}
                value={skuValue}
                onChange={(e) => setSkuValue(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('labels.reorderPoint')}
                type="number"
                step="0.01"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
              <Input
                label={t('labels.unitCost')}
                type="number"
                step="0.01"
                min="0"
                value={productCost}
                onChange={(e) => setProductCost(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('labels.sellPrice')}
                type="number"
                step="0.01"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
              <Input
                label={t('labels.storageLocation')}
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? tc('deleting') : tc('delete')}
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving || deleting}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={saving || deleting}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
