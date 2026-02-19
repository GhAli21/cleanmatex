/**
 * Describe Item Modal Component
 * Modal for adding custom items with full details
 * Re-Design: PRD-010 Advanced Orders - Section 5A
 */

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

interface DescribeItemModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (item: {
    name: string;
    quantity: number;
    pricePerItem: number;
    piecesPerItem: number;
    section: string;
    taxExempt: boolean;
  }) => void;
  categories?: Array<{ code: string; name: string }>;
}

export function DescribeItemModal({
  open,
  onClose,
  onSubmit,
  categories = [],
}: DescribeItemModalProps) {
  const t = useTranslations('newOrder.itemsGrid');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [pricePerItem, setPricePerItem] = useState(0);
  const [piecesPerItem, setPiecesPerItem] = useState(1);
  const [section, setSection] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setQuantity(1);
      setPricePerItem(0);
      setPiecesPerItem(1);
      setSection(categories[0]?.code || '');
      setTaxExempt(false);
    }
  }, [open, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert(t('itemNameRequired') || 'Please enter an item name');
      return;
    }

    if (quantity < 1) {
      alert(t('quantityMin') || 'Quantity must be at least 1');
      return;
    }

    if (pricePerItem < 0) {
      alert(t('priceCannotBeNegative') || 'Price cannot be negative');
      return;
    }

    onSubmit({
      name: name.trim(),
      quantity,
      pricePerItem,
      piecesPerItem,
      section,
      taxExempt,
    });

    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-6 border-b border-gray-200`}>
          <h2 className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customItemTitle')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('fieldName')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('customGarmentPlaceholder')}
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${isRTL ? 'text-right' : 'text-left'}`}
              required
              autoFocus
            />
          </div>

          {/* Quantity */}
          <div>
            <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('fieldQuantity')} *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              dir="ltr"
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${isRTL ? 'text-right' : 'text-left'}`}
              required
            />
          </div>

          {/* Price Per Item */}
          <div>
            <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('fieldPrice')} *
            </label>
            <div className="relative">
              <input
                type="number"
                value={pricePerItem}
                onChange={(e) => setPricePerItem(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.001"
                dir="ltr"
                className={`w-full px-4 py-3 ${isRTL ? 'pl-16 pr-4' : 'pr-16 pl-4'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base`}
                required
              />
              <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-500 font-medium`}>
                OMR
              </span>
            </div>
            <p className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('total')}: {(pricePerItem * quantity).toFixed(3)} OMR
            </p>
          </div>

          {/* Pieces Per Item */}
          <div>
            <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('fieldPieces')}
            </label>
            <input
              type="number"
              value={piecesPerItem}
              onChange={(e) => setPiecesPerItem(parseInt(e.target.value) || 1)}
              min="1"
              dir="ltr"
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${isRTL ? 'text-right' : 'text-left'}`}
            />
            <p className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('totalPieces')}: {piecesPerItem * quantity}
            </p>
          </div>

          {/* Section Dropdown */}
          {categories.length > 0 && (
            <div>
              <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('fieldSection')}
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {categories.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tax Exempt Checkbox */}
          <div>
            <label className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-3 cursor-pointer p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors`}>
              <input
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded border-gray-300"
              />
              <span className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('fieldTaxExempt')}</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full h-14 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl mt-6"
          >
            {t('addItem')}
          </button>
        </form>
      </div>
    </div>
  );
}
