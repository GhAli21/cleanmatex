/**
 * New Order Top Bar
 * Sticky top bar with branch, customer, express and category tabs
 * PRD-010: Advanced Order Management
 */

'use client';

import { ServiceSpeedSelect } from './service-speed-select';
import type { SpeedOptionPreviewSource } from '../hooks/use-speed-option-previews';
import { memo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useEditControlGroup } from '../order-change/use-edit-control-capability';
import { CategoryTabs } from './category-tabs';
import { CategoryTabsSkeleton } from './loading-skeletons';
import { UserPlus, UserCheck, Edit2, Settings2 } from 'lucide-react';
import type { BranchOption } from '@/lib/services/inventory-service';
import { CmxButton, CmxSelect } from '@ui/primitives';
import {
  SELECTABLE_NEW_ORDER_SOURCE_CODES,
  type OrderSourceCode,
} from '@/lib/constants/order-sources';
import { ORDER_TYPE_ID_VALUES, type OrderTypeId } from '@/lib/constants/order-types';
import { ORDER_TYPE_I18N_KEYS } from '@/lib/constants/order-type-labels';

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
  /** Current fulfillment choice; it must remain visible while staff add items. */
  orderTypeId: OrderTypeId;
  onOrderTypeChange: (orderTypeId: OrderTypeId) => void;
  /** Current auditable channel; user-editable only while creating a new order. */
  orderSourceCode: OrderSourceCode;
  onOrderSourceChange: (orderSourceCode: OrderSourceCode) => void;
  /** Hides creation-only fields when the same top bar renders an existing order. */
  showOrderContextSelectors?: boolean;
  customerName: string;
  onSelectCustomer: () => void;
  onEditCustomer?: () => void;
  /** The order speed code (`sys_service_speed_cd`). */
  serviceSpeed: string;
  onServiceSpeedChange: (serviceSpeed: string) => void;
  /** New Order only: prices each speed option for the cart, as the summary panel menu does. */
  speedPreview?: SpeedOptionPreviewSource;
  categories: ServiceCategory[];
  selectedCategory: string;
  onSelectCategory: (code: string) => void;
  categoriesLoading?: boolean;
  showCategories?: boolean;
  hasBranchDependentData?: boolean;
  /** When a POS session owns the order, the branch follows that session. */
  branchLocked?: boolean;
  sessionSlot?: ReactNode;
  /** Count of order-wide preferences already applied, shown as a badge. Omit/0 hides the badge. */
  orderPrefsCount?: number;
  /** Presence gates whether the order-preferences pill renders at all (tenant may have no service-pref catalog). */
  onOpenOrderPreferences?: () => void;
}

/**
 * Keeps creation context and high-frequency order controls visible above every New Order step.
 *
 * @param props Tenant-aware branches, order context, and interaction callbacks.
 * @returns Sticky bilingual controls and the optional service-category row.
 */
export const NewOrderTopBar = memo(function NewOrderTopBar({
  branches,
  branchId,
  onBranchChange,
  branchesLoading = false,
  orderTypeId,
  onOrderTypeChange,
  orderSourceCode,
  onOrderSourceChange,
  showOrderContextSelectors = true,
  customerName,
  onSelectCustomer,
  onEditCustomer,
  serviceSpeed,
  onServiceSpeedChange,
  speedPreview,
  categories,
  selectedCategory,
  onSelectCategory,
  categoriesLoading = false,
  showCategories = true,
  hasBranchDependentData = false,
  branchLocked = false,
  sessionSlot,
  orderPrefsCount = 0,
  onOpenOrderPreferences,
}: NewOrderTopBarProps) {
  const t = useTranslations('newOrder');
  const tCommon = useTranslations('common');
  const tOrders = useTranslations('orders');
  const isRTL = useRTL();
  const speedCapability = useEditControlGroup(['CHANGE_SERVICE_SPEED'], 'ORDER');
  const orderTypeOptions = ORDER_TYPE_ID_VALUES.map((code) => ({
    value: code,
    label: tOrders(ORDER_TYPE_I18N_KEYS[code]),
  }));
  const orderSourceOptions = SELECTABLE_NEW_ORDER_SOURCE_CODES.map((code) => ({
    value: code,
    label: t(`topBar.orderSources.${code}`),
  }));

  return (
    <div className="sticky top-0 z-20 bg-card border-b border-border shadow-sm flex-shrink-0">
      {/* Row 1: Branch + Customer + Express */}
      <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Branch Selector — only if multiple branches */}
        {branches.length > 1 && (
          <CmxSelect
            fullWidth={false}
            size="sm"
            value={branchId ?? ''}
            autoFocus={!branchId && !branchLocked}
            disabled={branchLocked}
            onChange={(e) => {
              if (branchLocked) return;
              const newId = e.target.value || null;
              if (hasBranchDependentData && newId && newId !== branchId) {
                // cmx-ds-ignore UI002: synchronous confirmation gates branch change before state clear
                const confirmed = window.confirm(
                  t('warnings.changeBranchConfirm') || 'Changing the branch will clear your current order data. Continue?'
                );
                if (!confirmed) return;
              }
              onBranchChange(newId);
            }}
            className={`max-w-[180px] text-start ${branchLocked ? 'border-border bg-muted text-foreground' : !branchId ? 'border-warning bg-warning-bg' : 'border-border'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
            aria-label={tCommon('branch')}
            options={[
              { value: '', label: tCommon('selectBranch') },
              ...branches.map((b) => ({
                value: b.id,
                label: isRTL ? (b.name2 || b.name) : b.name,
              })),
            ]}
          />
        )}
        {branchesLoading && branches.length === 0 && (
          <span className="text-xs text-muted-foreground">{tCommon('loading') || 'Loading...'}</span>
        )}

        {/* Customer pill */}
        <CmxButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={customerName ? (onEditCustomer ?? onSelectCustomer) : onSelectCustomer}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-sm font-medium ${
            customerName
              ? 'border-primary bg-info-bg text-info-text hover:bg-info-bg'
              : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
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
        </CmxButton>

        {/* Order speed (§5.4): options from sys_service_speed_cd; new lines follow it */}
        <ServiceSpeedSelect
          className="w-40"
          value={serviceSpeed}
          onChange={(code) => { if (code) onServiceSpeedChange(code); }}
          disabled={!speedCapability.interactive}
          disabledReason={t('serviceSpeed.locked')}
          ariaLabel={t('serviceSpeed.orderAria')}
          preview={speedPreview}
        />

        {/* Order-wide preferences pill — always visible on every step, so staff don't
            need to remember which step/tab holds order-level entry (see B18 redesign). */}
        {onOpenOrderPreferences && (
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenOrderPreferences}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-sm font-medium ${
              orderPrefsCount > 0
                ? 'border-primary bg-info-bg text-info-text hover:bg-info-bg'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
            }`}
            aria-label={
              t('topBar.orderPreferencesAria', { count: orderPrefsCount }) ||
              `Order preferences${orderPrefsCount > 0 ? `, ${orderPrefsCount} applied` : ''}`
            }
          >
            <Settings2 className="w-4 h-4 shrink-0" aria-hidden />
            <span>{t('topBar.orderPreferences') || 'Preferences'}</span>
            {orderPrefsCount > 0 && (
              <span
                className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
              >
                {orderPrefsCount}
              </span>
            )}
          </CmxButton>
        )}

        {/* Context remains above the fold because it changes workflow and audit semantics, not item pricing. */}
        {showOrderContextSelectors && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {t('topBar.orderTypeLabel')}
              </span>
              <CmxSelect
                id="new-order-type"
                value={orderTypeId}
                onChange={(event) => onOrderTypeChange(event.currentTarget.value as OrderTypeId)}
                options={orderTypeOptions}
                size="sm"
                fullWidth={false}
                className="min-w-[10.5rem]"
                dir={isRTL ? 'rtl' : 'ltr'}
                aria-label={t('topBar.orderTypeLabel')}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {t('topBar.orderSourceLabel')}
              </span>
              <CmxSelect
                id="new-order-source"
                value={orderSourceCode}
                onChange={(event) => onOrderSourceChange(event.currentTarget.value as OrderSourceCode)}
                options={orderSourceOptions}
                size="sm"
                fullWidth={false}
                className="min-w-[9.5rem]"
                dir={isRTL ? 'rtl' : 'ltr'}
                aria-label={t('topBar.orderSourceLabel')}
              />
            </div>
          </div>
        )}

        {sessionSlot ? (
          <div className="ms-auto flex min-w-0 items-center">
            {sessionSlot}
          </div>
        ) : null}
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
