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
import { createInventoryItemAction } from '@/app/actions/inventory/inventory-actions';

interface AddItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddItemModal({ onClose, onSuccess }: AddItemModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productName, setProductName] = useState('');
  const [productName2, setProductName2] = useState('');
  const [productUnit, setProductUnit] = useState('piece');
  const [qtyOnHand, setQtyOnHand] = useState('0');
  const [reorderPoint, setReorderPoint] = useState('0');
  const [productCost, setProductCost] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [sku, setSku] = useState('');
  const [storageLocation, setStorageLocation] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createInventoryItemAction({
      product_name: productName.trim(),
      product_name2: productName2.trim() || undefined,
      product_unit: productUnit,
      qty_on_hand: parseFloat(qtyOnHand) || 0,
      reorder_point: parseFloat(reorderPoint) || 0,
      product_cost: parseFloat(productCost) || 0,
      default_sell_price: parseFloat(sellPrice) || 0,
      id_sku: sku.trim() || undefined,
      storage_location: storageLocation.trim() || undefined,
    });

    setSaving(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || t('messages.createFailed'));
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
          <DialogTitle>{t('actions.addItem')}</DialogTitle>
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
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('labels.initialQty')}
                type="number"
                step="0.01"
                min="0"
                value={qtyOnHand}
                onChange={(e) => setQtyOnHand(e.target.value)}
              />
              <Input
                label={t('labels.reorderPoint')}
                type="number"
                step="0.01"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('labels.unitCost')}
                type="number"
                step="0.01"
                min="0"
                value={productCost}
                onChange={(e) => setProductCost(e.target.value)}
              />
              <Input
                label={t('labels.sellPrice')}
                type="number"
                step="0.01"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
            <Input
              label={t('labels.storageLocation')}
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
