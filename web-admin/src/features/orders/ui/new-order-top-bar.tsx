/**
 * New Order Top Bar
 * Sticky top bar with branch, customer, express and category tabs
 * PRD-010: Advanced Order Management
 */

'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CategoryTabs } from './category-tabs';
import { CategoryTabsSkeleton } from './loading-skeletons';
import { UserPlus, UserCheck, Edit2, Zap } from 'lucide-react';
import type { BranchOption } from '@/lib/services/inventory-service';

interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string;
  service_category_icon?: string;
  service_category_color1?: string;
}

interface NewOrderTopBarProps {
  branches: BranchOption[];
  branchId: string | null;
  onBranchChange: (id: string | null) => void;
  branchesLoading?: boolean;
  customerName: string;
  onSelectCustomer: () => void;
  onEditCustomer?: () => void;
  express: boolean;
  onExpressToggle: (value: boolean) => void;
  categories: ServiceCategory[];
  selectedCategory: string;
  onSelectCategory: (code: string) => void;
  categoriesLoading?: boolean;
  showCategories?: boolean;
}

export const NewOrderTopBar = memo(function NewOrderTopBar({
  branches,
  branchId,
  onBranchChange,
  branchesLoading = false,
  customerName,
  onSelectCustomer,
  onEditCustomer,
  express,
  onExpressToggle,
  categories,
  selectedCategory,
  onSelectCategory,
  categoriesLoading = false,
  showCategories = true,
}: NewOrderTopBarProps) {
  const t = useTranslations('newOrder');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
      {/* Row 1: Branch + Customer + Express */}
      <div className={`px-4 py-2 flex items-center gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Branch Selector — only if multiple branches */}
        {branches.length > 1 && (
          <select
            value={branchId ?? ''}
            onChange={(e) => onBranchChange(e.target.value || null)}
            className={`max-w-[180px] px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!branchId ? 'border-amber-400 bg-amber-50' : 'border-gray-300'} ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
            aria-label={tCommon('branch')}
          >
            <option value="">{tCommon('selectBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {isRTL ? (b.name2 || b.name) : b.name}
              </option>
            ))}
          </select>
        )}
        {branchesLoading && branches.length === 0 && (
          <span className="text-xs text-gray-400">{tCommon('loading') || 'Loading...'}</span>
        )}

        {/* Customer pill */}
        <button
          type="button"
          onClick={customerName ? (onEditCustomer ?? onSelectCustomer) : onSelectCustomer}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${isRTL ? 'flex-row-reverse' : ''} ${
            customerName
              ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          }`}
          aria-label={customerName ? (t('orderSummary.editCustomer') || 'Edit customer') : t('selectCustomer')}
        >
          {customerName ? (
            <UserCheck className="w-4 h-4 shrink-0" aria-hidden />
          ) : (
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
          )}
          <span className="max-w-[140px] truncate">
            {customerName || t('selectCustomer')}
          </span>
          {customerName && <Edit2 className="w-3 h-3 shrink-0 opacity-60" aria-hidden />}
        </button>

        {/* Express pill toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={express}
          onClick={() => onExpressToggle(!express)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${isRTL ? 'flex-row-reverse' : ''} ${
            express
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-orange-300'
          }`}
          aria-label={express ? (t('topBar.expressOn') || 'Express On') : (t('topBar.expressOff') || 'Express Off')}
        >
          <Zap className="w-4 h-4 shrink-0" aria-hidden />
          <span>{t('topBar.expressLabel') || t('express.label') || 'Express'}</span>
        </button>
      </div>

      {/* Row 2: Category Tabs */}
      {showCategories && (
        <div className="px-4 pb-2">
          {categoriesLoading ? (
            <CategoryTabsSkeleton />
          ) : (
            <CategoryTabs
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              className="py-1 border-0 rounded-none p-0 bg-transparent"
            />
          )}
        </div>
      )}
    </div>
  );
});
