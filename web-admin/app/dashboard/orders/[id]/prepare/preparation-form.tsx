'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Upload, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useAuth } from '@/lib/auth/auth-context';
import { useMessage } from '@ui/feedback';
import { addOrderItems } from '@/app/actions/orders/add-order-items';
import { completePreparation } from '@/app/actions/orders/complete-preparation';
import type { AddOrderItemInput } from '@/types/order';

interface PreparationFormProps {
  order: {
    id: string;
    order_no: string;
    tenant_org_id: string;
    service_category_code?: string | null;
    org_order_items_dtl: any[];
  };
}

interface ItemFormData {
  tempId: string;
  service_category_code: string;
  product_name: string;
  product_name2: string;
  quantity: number;
  price_per_unit: string;
  color: string;
  brand: string;
  has_stain: boolean;
  has_damage: boolean;
  stain_notes: string;
  damage_notes: string;
  notes: string;
}

export function PreparationForm({ order }: PreparationFormProps) {
  const router = useRouter();
  const t = useTranslations('orders.preparation');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currentTenant, user } = useAuth();
  const { showErrorFrom } = useMessage();
  const [items, setItems] = useState<ItemFormData[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [bagCount, setBagCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with one empty item
  useEffect(() => {
    if (items.length === 0) {
      addNewItem();
    }
  }, []);

  const addNewItem = () => {
    const newItem: ItemFormData = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      service_category_code: order.service_category_code || '',
      product_name: '',
      product_name2: '',
      quantity: 1,
      price_per_unit: '2.000',
      color: '',
      brand: '',
      has_stain: false,
      has_damage: false,
      stain_notes: '',
      damage_notes: '',
      notes: '',
    };
    setItems([...items, newItem]);
  };

  const removeItem = (tempId: string) => {
    if (items.length === 1) {
      alert(t('errors.atLeastOneItem'));
      return;
    }
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof ItemFormData, value: any) => {
    setItems(
      items.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const price = parseFloat(item.price_per_unit) || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For now, just create data URLs for preview
    // In production, upload to MinIO
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const dataUrl = URL.createObjectURL(file);
        newUrls.push(dataUrl);
      }
    }

    setPhotoUrls([...photoUrls, ...newUrls]);
  };

  const removePhoto = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const validateItems = (): boolean => {
    for (const item of items) {
      if (!item.product_name.trim()) {
        setError(t('errors.allItemsMustHaveName'));
        return false;
      }
      if (item.quantity < 1) {
        setError(t('errors.quantityMustBeAtLeast1'));
        return false;
      }
      if (parseFloat(item.price_per_unit) <= 0) {
        setError(t('errors.priceMustBeGreaterThan0'));
        return false;
      }
      if (item.has_stain && !item.stain_notes.trim()) {
        setError(t('errors.provideStainNotes'));
        return false;
      }
      if (item.has_damage && !item.damage_notes.trim()) {
        setError(t('errors.provideDamageNotes'));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateItems()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert form data to AddOrderItemInput format
      // TODO: The form uses product_name but API requires productId
      // Need to either lookup product by name or create product first
      // For now, using a temporary UUID - this needs proper implementation
      const orderItems: AddOrderItemInput[] = items.map((item) => ({
        productId: crypto.randomUUID(), // TODO: Replace with actual product lookup
        quantity: item.quantity,
        serviceCategoryCode: item.service_category_code,
        color: item.color || undefined,
        brand: item.brand || undefined,
        hasStain: item.has_stain,
        stainNotes: item.stain_notes || undefined,
        hasDamage: item.has_damage,
        damageNotes: item.damage_notes || undefined,
        notes: item.notes || undefined,
      }));

      // Add items to order
      // Note: addOrderItems requires tenantOrgId as first parameter
      if (!currentTenant?.tenant_id) {
        throw new Error(t('errors.authenticationRequired') || 'Authentication required');
      }
      const addResult = await addOrderItems(currentTenant.tenant_id, order.id, {
        items: orderItems,
        isExpressService: false,
      });

      if (!addResult.success) {
        throw new Error(addResult.error || t('errors.failedToAddItems'));
      }

      // Complete preparation
      if (!currentTenant?.tenant_id || !user?.id) {
        throw new Error(t('errors.authenticationRequired') || 'Authentication required');
      }
      const completeResult = await completePreparation(
        currentTenant.tenant_id,
        order.id,
        user.id,
        {
          readyByOverride: undefined,
          internalNotes: undefined,
        }
      );

      if (!completeResult.success) {
        throw new Error(completeResult.error || t('errors.failedToCompletePreparation'));
      }

      // Redirect back to order detail
      router.push(`/dashboard/orders/${order.id}`);
      router.refresh();
    } catch (err: any) {
      console.error('Preparation error:', err);
      const errorMsg = err.message || t('errors.failedToSavePreparation');
      setError(errorMsg); // ✅ Keep for inline display
      showErrorFrom(err, { fallback: t('errors.failedToSavePreparation') }); // ✅ Add global notification
      setIsSubmitting(false);
    }
  };

  const totalAmount = calculateTotal();
  const taxAmount = totalAmount * 0.05; // 5% VAT
  const grandTotal = totalAmount + taxAmount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className={`bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h3 className={`text-sm font-semibold text-red-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('error')}</h3>
            <p className={`text-sm text-red-700 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>{error}</p>
          </div>
        </div>
      )}

      {/* Photos Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('orderPhotos')}</h2>
        <div className="space-y-4">
          {/* Photo Grid */}
          {photoUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {photoUrls.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                  <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className={`absolute ${isRTL ? 'top-2 left-2' : 'top-2 right-2'} p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}
                    aria-label={t('removePhoto')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Camera className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">{t('addPhotos')}</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-4`}>
          <h2 className={`text-lg font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('orderItems')}</h2>
          <button
            type="button"
            onClick={addNewItem}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('addItem')}
          </button>
        </div>

        <div className="space-y-6">
          {items.map((item, index) => (
            <div key={item.tempId} className="border border-gray-200 rounded-lg p-4">
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-4`}>
                <h3 className={`text-sm font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>{t('item')} {index + 1}</h3>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.tempId)}
                    className="text-red-600 hover:text-red-700 p-1"
                    title={t('removeItem')}
                    aria-label={t('removeItem')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Product Name (English) */}
                <div>
                  <label htmlFor={`product_name_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('productName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id={`product_name_${item.tempId}`}
                    name={`product_name_${item.tempId}`}
                    value={item.product_name}
                    onChange={(e) => updateItem(item.tempId, 'product_name', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder={t('productNamePlaceholder')}
                    required
                  />
                </div>

                {/* Product Name (Arabic) */}
                <div>
                  <label htmlFor={`product_name2_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('productNameArabic')}
                  </label>
                  <input
                    type="text"
                    id={`product_name2_${item.tempId}`}
                    name={`product_name2_${item.tempId}`}
                    value={item.product_name2}
                    onChange={(e) => updateItem(item.tempId, 'product_name2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('productNameArabicPlaceholder')}
                    dir="rtl"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label htmlFor={`quantity_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('quantity')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id={`quantity_${item.tempId}`}
                    name={`quantity_${item.tempId}`}
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.tempId, 'quantity', parseInt(e.target.value) || 1)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    required
                  />
                </div>

                {/* Price */}
                <div>
                  <label htmlFor={`price_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('price')} (OMR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id={`price_${item.tempId}`}
                    name={`price_${item.tempId}`}
                    step="0.001"
                    min="0.001"
                    value={item.price_per_unit}
                    onChange={(e) => updateItem(item.tempId, 'price_per_unit', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    required
                  />
                </div>

                {/* Color */}
                <div>
                  <label htmlFor={`color_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('color')}</label>
                  <input
                    type="text"
                    id={`color_${item.tempId}`}
                    name={`color_${item.tempId}`}
                    value={item.color}
                    onChange={(e) => updateItem(item.tempId, 'color', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder={t('colorPlaceholder')}
                  />
                </div>

                {/* Brand */}
                <div>
                  <label htmlFor={`brand_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('brand')}</label>
                  <input
                    type="text"
                    id={`brand_${item.tempId}`}
                    name={`brand_${item.tempId}`}
                    value={item.brand}
                    onChange={(e) => updateItem(item.tempId, 'brand', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    placeholder={t('brandPlaceholder')}
                  />
                </div>
              </div>

              {/* Condition Checkboxes */}
              <div className={`flex gap-6 mt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <label htmlFor={`has_stain_${item.tempId}`} className={`flex items-center gap-2 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    id={`has_stain_${item.tempId}`}
                    name={`has_stain_${item.tempId}`}
                    checked={item.has_stain}
                    onChange={(e) => updateItem(item.tempId, 'has_stain', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>{t('hasStain')}</span>
                </label>
                <label htmlFor={`has_damage_${item.tempId}`} className={`flex items-center gap-2 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    id={`has_damage_${item.tempId}`}
                    name={`has_damage_${item.tempId}`}
                    checked={item.has_damage}
                    onChange={(e) => updateItem(item.tempId, 'has_damage', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className={`text-sm text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>{t('hasDamage')}</span>
                </label>
              </div>

              {/* Conditional Notes */}
              {item.has_stain && (
                <div className="mt-4">
                  <label htmlFor={`stain_notes_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('stainNotes')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id={`stain_notes_${item.tempId}`}
                    name={`stain_notes_${item.tempId}`}
                    value={item.stain_notes}
                    onChange={(e) => updateItem(item.tempId, 'stain_notes', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    rows={2}
                    placeholder={t('stainNotesPlaceholder')}
                    required
                  />
                </div>
              )}

              {item.has_damage && (
                <div className="mt-4">
                  <label htmlFor={`damage_notes_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('damageNotes')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id={`damage_notes_${item.tempId}`}
                    name={`damage_notes_${item.tempId}`}
                    value={item.damage_notes}
                    onChange={(e) => updateItem(item.tempId, 'damage_notes', e.target.value)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                    rows={2}
                    placeholder={t('damageNotesPlaceholder')}
                    required
                  />
                </div>
              )}

              {/* General Notes */}
              <div className="mt-4">
                <label htmlFor={`notes_${item.tempId}`} className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('notes')}</label>
                <textarea
                  id={`notes_${item.tempId}`}
                  name={`notes_${item.tempId}`}
                  value={item.notes}
                  onChange={(e) => updateItem(item.tempId, 'notes', e.target.value)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                  rows={2}
                  placeholder={t('notesPlaceholder')}
                />
              </div>

              {/* Item Total */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
                  <span className="text-gray-600">{t('itemTotal')}:</span>
                  <span className="font-semibold text-gray-900">
                    {(parseFloat(item.price_per_unit) * item.quantity).toFixed(3)} OMR
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bag Count */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('packaging')}</h2>
        <div className={`max-w-xs ${isRTL ? 'ml-auto' : ''}`}>
          <label className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('numberOfBags')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={bagCount}
            onChange={(e) => setBagCount(parseInt(e.target.value) || 1)}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
            required
          />
        </div>
      </div>

      {/* Summary & Submit */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('orderSummary')}</h2>
        <div className="space-y-3">
          <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
            <span className="text-gray-600">{t('totalItems')}:</span>
            <span className="font-medium text-gray-900">
              {items.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </div>
          <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
            <span className="text-gray-600">{t('subtotal')}:</span>
            <span className="font-medium text-gray-900">{totalAmount.toFixed(3)} OMR</span>
          </div>
          <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'} text-sm`}>
            <span className="text-gray-600">{t('tax')}:</span>
            <span className="font-medium text-gray-900">{taxAmount.toFixed(3)} OMR</span>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className={`flex ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
              <span className="text-base font-semibold text-gray-900">{t('grandTotal')}:</span>
              <span className="text-xl font-bold text-gray-900">{grandTotal.toFixed(3)} OMR</span>
            </div>
          </div>
        </div>

        <div className={`mt-6 flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <CheckCircle className="w-5 h-5" />
            {isSubmitting ? t('saving') : t('completePreparation')}
          </button>
        </div>
      </div>
    </form>
  );
}
