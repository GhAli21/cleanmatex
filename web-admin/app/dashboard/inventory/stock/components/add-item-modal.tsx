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
} from '@ui/compat';
import { UNITS_OF_MEASURE } from '@/lib/constants/inventory';
import { createInventoryItemAction } from '@/app/actions/inventory/inventory-actions';
import type { BranchOption } from '@/lib/services/inventory-service';

interface AddItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  branchId?: string;
  branches?: BranchOption[];
}

export default function AddItemModal({ onClose, onSuccess, branchId, branches = [] }: AddItemModalProps) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [productName2, setProductName2] = useState('');
  const [hintText, setHintText] = useState('');
  const [productUnit, setProductUnit] = useState('piece');
  const [sku, setSku] = useState('');

  // Pricing
  const [productCost, setProductCost] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [expressSellPrice, setExpressSellPrice] = useState('');
  const [minSellPrice, setMinSellPrice] = useState('');

  // Inventory
  const [qtyOnHand, setQtyOnHand] = useState('0');
  const [reorderPoint, setReorderPoint] = useState('0');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [maxStockLevel, setMaxStockLevel] = useState('');
  const [lastPurchaseCost, setLastPurchaseCost] = useState('');
  const [storageLocation, setStorageLocation] = useState('');

  // Optional
  const [productGroup1, setProductGroup1] = useState('');
  const [productGroup2, setProductGroup2] = useState('');
  const [productGroup3, setProductGroup3] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [piecesPerProduct, setPiecesPerProduct] = useState('');
  const [turnaroundHh, setTurnaroundHh] = useState('');
  const [turnaroundHhExpress, setTurnaroundHhExpress] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [multiplierExpress, setMultiplierExpress] = useState('');
  const [productOrder, setProductOrder] = useState('');
  const [recNotes, setRecNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productName.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createInventoryItemAction({
      product_code: productCode.trim() || undefined,
      product_name: productName.trim(),
      product_name2: productName2.trim() || undefined,
      hint_text: hintText.trim() || undefined,
      product_unit: productUnit,
      product_cost: parseFloat(productCost) || 0,
      default_sell_price: parseFloat(sellPrice) || 0,
      default_express_sell_price: expressSellPrice ? parseFloat(expressSellPrice) : undefined,
      min_sell_price: minSellPrice ? parseFloat(minSellPrice) : undefined,
      id_sku: sku.trim() || undefined,
      qty_on_hand: parseFloat(qtyOnHand) || 0,
      reorder_point: parseFloat(reorderPoint) || 0,
      min_stock_level: minStockLevel ? parseFloat(minStockLevel) : undefined,
      max_stock_level: maxStockLevel ? parseFloat(maxStockLevel) : undefined,
      last_purchase_cost: lastPurchaseCost ? parseFloat(lastPurchaseCost) : undefined,
      storage_location: storageLocation.trim() || undefined,
      product_group1: productGroup1.trim() || undefined,
      product_group2: productGroup2.trim() || undefined,
      product_group3: productGroup3.trim() || undefined,
      min_quantity: minQuantity ? parseInt(minQuantity, 10) : undefined,
      pieces_per_product: piecesPerProduct ? parseInt(piecesPerProduct, 10) : undefined,
      turnaround_hh: turnaroundHh ? parseFloat(turnaroundHh) : undefined,
      turnaround_hh_express: turnaroundHhExpress ? parseFloat(turnaroundHhExpress) : undefined,
      extra_days: extraDays ? parseInt(extraDays, 10) : undefined,
      multiplier_express: multiplierExpress ? parseFloat(multiplierExpress) : undefined,
      product_order: productOrder ? parseInt(productOrder, 10) : undefined,
      rec_notes: recNotes.trim() || undefined,
      is_active: isActive,
      branch_id: branchId || undefined,
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

  const selectedBranch = branchId ? branches.find((b) => b.id === branchId) : null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('actions.addItem')}
            {selectedBranch && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                + {t('sections.branchStock')}: {selectedBranch.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 py-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            {/* Read-only defaults */}
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              <span className="font-medium">{t('labels.serviceCategoryCode')}:</span> RETAIL_ITEMS
              {' · '}
              <span className="font-medium">{t('labels.isRetailItem')}:</span> {tc('yes')}
            </div>

            {/* Product Master */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">
                  {t('sections.productMaster')}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">{t('messages.productMasterDescription')}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={t('labels.itemCode')}
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="INV-00001 (auto if empty)"
                />
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
                <Input
                  label={t('labels.hintText')}
                  value={hintText}
                  onChange={(e) => setHintText(e.target.value)}
                />
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
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">{t('labels.sellPrice')} / {t('labels.unitCost')}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <Input
                  label={t('labels.defaultExpressSellPrice')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={expressSellPrice}
                  onChange={(e) => setExpressSellPrice(e.target.value)}
                />
                <Input
                  label={t('labels.minSellPrice')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={minSellPrice}
                  onChange={(e) => setMinSellPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Inventory / Branch Stock */}
            <div
              className={`space-y-4 rounded-lg p-4 ${
                branchId ? 'border border-blue-100 bg-blue-50/30' : ''
              }`}
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-700">
                  {branchId ? t('sections.branchStock') : t('labels.quantity') + ' / ' + t('labels.storageLocation')}
                </h3>
                {branchId && (
                  <p className="text-xs text-gray-500">{t('messages.branchStockDescription')}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <Input
                  label={t('labels.minStockLevel')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                />
                <Input
                  label={t('labels.maxStockLevel')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={maxStockLevel}
                  onChange={(e) => setMaxStockLevel(e.target.value)}
                />
                <Input
                  label={t('labels.lastPurchaseCost')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={lastPurchaseCost}
                  onChange={(e) => setLastPurchaseCost(e.target.value)}
                />
                <Input
                  label={t('labels.storageLocation')}
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Optional */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">{t('sections.optional')}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={t('labels.productGroup1')}
                  value={productGroup1}
                  onChange={(e) => setProductGroup1(e.target.value)}
                />
                <Input
                  label={t('labels.productGroup2')}
                  value={productGroup2}
                  onChange={(e) => setProductGroup2(e.target.value)}
                />
                <Input
                  label={t('labels.productGroup3')}
                  value={productGroup3}
                  onChange={(e) => setProductGroup3(e.target.value)}
                />
                <Input
                  label={t('labels.minQuantity')}
                  type="number"
                  min="0"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
                <Input
                  label={t('labels.piecesPerProduct')}
                  type="number"
                  min="0"
                  value={piecesPerProduct}
                  onChange={(e) => setPiecesPerProduct(e.target.value)}
                />
                <Input
                  label={t('labels.turnaroundHh')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={turnaroundHh}
                  onChange={(e) => setTurnaroundHh(e.target.value)}
                />
                <Input
                  label={t('labels.turnaroundHhExpress')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={turnaroundHhExpress}
                  onChange={(e) => setTurnaroundHhExpress(e.target.value)}
                />
                <Input
                  label={t('labels.extraDays')}
                  type="number"
                  min="0"
                  value={extraDays}
                  onChange={(e) => setExtraDays(e.target.value)}
                />
                <Input
                  label={t('labels.multiplierExpress')}
                  type="number"
                  step="0.01"
                  min="0"
                  value={multiplierExpress}
                  onChange={(e) => setMultiplierExpress(e.target.value)}
                />
                <Input
                  label={t('labels.productOrder')}
                  type="number"
                  min="0"
                  value={productOrder}
                  onChange={(e) => setProductOrder(e.target.value)}
                />
                <Input
                  label={t('labels.recNotes')}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">
                    {tc('active')}
                  </label>
                </div>
              </div>
            </div>
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
