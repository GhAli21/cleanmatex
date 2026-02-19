'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxCard, CmxSelect, Label } from '@ui/primitives';
import { CmxTabsPanel } from '@ui/navigation';
import { Package, MapPin } from 'lucide-react';
import { cmxMessage } from '@ui/feedback';
import { UNITS_OF_MEASURE } from '@/lib/constants/inventory';
import {
  updateInventoryItemAction,
  updateBranchStockAction,
  deleteInventoryItemAction,
} from '@/app/actions/inventory/inventory-actions';
import type { InventoryItemListItem } from '@/lib/types/inventory';

interface EditItemModalProps {
  item: InventoryItemListItem;
  branchId?: string;
  branchName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditItemModal({
  item,
  branchId,
  branchName,
  onClose,
  onSuccess,
}: EditItemModalProps) {
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
  const [minStockLevel, setMinStockLevel] = useState(
    String(item.min_stock_level ?? 0)
  );
  const [maxStockLevel, setMaxStockLevel] = useState(
    String(item.max_stock_level ?? '')
  );
  const [lastPurchaseCost, setLastPurchaseCost] = useState(
    String(item.last_purchase_cost ?? '')
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    const productPayload = {
      id: item.id,
      product_name: productName.trim(),
      product_name2: productName2.trim() || undefined,
      product_unit: productUnit,
      product_cost: parseFloat(productCost) || 0,
      default_sell_price: parseFloat(sellPrice) || 0,
    };

    if (!branchId) {
      (productPayload as Record<string, unknown>).reorder_point =
        parseFloat(reorderPoint) || 0;
      (productPayload as Record<string, unknown>).id_sku =
        skuValue.trim() || undefined;
      (productPayload as Record<string, unknown>).storage_location =
        storageLocation.trim() || undefined;
    }

    const result = await updateInventoryItemAction(productPayload);

    if (result.success && branchId) {
      const branchResult = await updateBranchStockAction({
        product_id: item.id,
        branch_id: branchId,
        reorder_point: parseFloat(reorderPoint) || 0,
        min_stock_level: parseFloat(minStockLevel) || 0,
        max_stock_level: maxStockLevel.trim() ? parseFloat(maxStockLevel) : null,
        last_purchase_cost: lastPurchaseCost.trim()
          ? parseFloat(lastPurchaseCost)
          : null,
        storage_location: storageLocation.trim() || null,
        id_sku: skuValue.trim() || null,
      });

      if (!branchResult.success) {
        setError(branchResult.error || t('messages.updateFailed'));
        setSaving(false);
        return;
      }
    }

    setSaving(false);

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || t('messages.updateFailed'));
    }
  }

  async function handleDelete() {
    const confirmed = await cmxMessage.confirm({
      title: t('actions.deleteItem'),
      message: t('messages.confirmDelete'),
      variant: 'destructive',
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
    });
    if (!confirmed) return;

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

  const productFields = (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t('messages.productMasterDescription')}</p>
      <div>
        <Label className="block text-sm font-medium text-gray-700 mb-1">
          {t('labels.itemName')} (EN) <span className="text-red-500">*</span>
        </Label>
        <CmxInput
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label className="block text-sm font-medium text-gray-700 mb-1">
          {t('labels.itemName')} (AR)
        </Label>
        <CmxInput
          value={productName2}
          onChange={(e) => setProductName2(e.target.value)}
          dir="rtl"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            {t('labels.unit')}
          </Label>
          <CmxSelect
            value={productUnit}
            onChange={(e) => setProductUnit(e.target.value)}
            options={unitOptions}
          />
        </div>
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">
            {t('labels.unitCost')}
          </Label>
          <CmxInput
            type="number"
            step="0.01"
            min="0"
            value={productCost}
            onChange={(e) => setProductCost(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.sellPrice')}</Label>
        <CmxInput
          type="number"
          step="0.01"
          min="0"
          value={sellPrice}
          onChange={(e) => setSellPrice(e.target.value)}
        />
      </div>
      {!branchId && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.reorderPoint')}</Label>
              <CmxInput
                type="number"
                step="0.01"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.sku')}</Label>
              <CmxInput value={skuValue} onChange={(e) => setSkuValue(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.storageLocation')}</Label>
            <CmxInput value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
          </div>
        </>
      )}
    </div>
  );

  const branchFields = (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t('messages.branchStockDescription')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.sku')}</Label>
          <CmxInput value={skuValue} onChange={(e) => setSkuValue(e.target.value)} placeholder="-" />
        </div>
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.storageLocation')}</Label>
          <CmxInput value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="-" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.reorderPoint')}</Label>
          <CmxInput type="number" step="0.01" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
        </div>
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.minStockLevel')}</Label>
          <CmxInput type="number" step="0.01" min="0" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.maxStockLevel')}</Label>
          <CmxInput type="number" step="0.01" min="0" value={maxStockLevel} onChange={(e) => setMaxStockLevel(e.target.value)} placeholder="-" />
        </div>
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1">{t('labels.lastPurchaseCost')}</Label>
          <CmxInput type="number" step="0.01" min="0" value={lastPurchaseCost} onChange={(e) => setLastPurchaseCost(e.target.value)} placeholder="-" />
        </div>
      </div>
    </div>
  );

  return (
    <CmxDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <CmxDialogContent
        className={`mx-4 w-full overflow-y-auto ${branchId ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            {t('actions.editItem')} — {item.product_code}
            {branchId && branchName && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {branchName}
              </span>
            )}
          </CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-0 py-4">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {branchId ? (
              <CmxTabsPanel
                tabs={[
                  {
                    id: 'product',
                    label: t('sections.productMaster'),
                    icon: <Package className="h-4 w-4" />,
                    content: <CmxCard className="p-4">{productFields}</CmxCard>,
                  },
                  {
                    id: 'branch',
                    label: t('sections.branchStock'),
                    icon: <MapPin className="h-4 w-4" />,
                    content: <CmxCard className="p-4">{branchFields}</CmxCard>,
                  },
                ]}
                defaultTab="product"
              />
            ) : (
              <CmxCard className="p-4">{productFields}</CmxCard>
            )}
          </div>

          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? tc('deleting') : tc('delete')}
            </CmxButton>
            <div className="flex-1" />
            <CmxButton
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving || deleting}
            >
              {tc('cancel')} 
            </CmxButton>
            <CmxButton type="submit" disabled={saving || deleting}>
              {saving ? tc('saving') : tc('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
