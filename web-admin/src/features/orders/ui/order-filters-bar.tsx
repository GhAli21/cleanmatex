/**
 * Order Filters Bar Component
 *
 * Provides filters and search for orders list.
 */

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives';
import { CmxCodeSearchInput, type CodeSearchSubmit } from '@ui/forms/cmx-code-search-input';
import { resolveScan, scanResultHref } from '@features/scan/api/scan-api';

interface OrderFiltersBarProps {
  currentFilters: Record<string, string | undefined>;
}

/**
 *
 * @param root0
 * @param root0.currentFilters
 */
export function OrderFiltersBar({ currentFilters }: OrderFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('orders');
  const [search, setSearch] = useState(currentFilters.search || '');

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to first page
    router.push(`${pathname}?${params.toString()}`);
  };

  const [opening, setOpening] = useState(false);

  // HFC T3.9: a full code (order, line, piece, staff QR) opens that order at once; on any miss it falls back to the
  // normal list search, which also has an exact order-number fast path on the server.
  const handleSearch = async (submit: CodeSearchSubmit) => {
    if (submit.mode === 'text') {
      handleFilterChange('search', submit.text);
      return;
    }
    setOpening(true);
    try {
      const found = await resolveScan(submit.code, 'any');
      if (found.ok) {
        router.push(scanResultHref(found.data));
        return;
      }
    } catch {
      // Network error: fall through to the list search.
    } finally {
      setOpening(false);
    }
    handleFilterChange('search', submit.code);
  };

  const handleClearFilters = () => {
    router.push('/dashboard/orders');
    setSearch('');
  };

  // No frame of its own: CmxCrudPageShell frames the filters slot.
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8">
        {/* Search */}
        <div className="lg:col-span-2" aria-busy={opening || undefined}>
          <CmxCodeSearchInput
            value={search}
            onChange={setSearch}
            onSubmit={(submit) => {
              void handleSearch(submit);
            }}
            placeholder={t('search')}
            aria-label={t('search')}
            disabled={opening}
          />
        </div>

        {/* Status Filter */}
        <CmxSelect
          value={currentFilters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="text-start"
          aria-label={t('filterByStatus')}
          options={[
            { value: '', label: t('allStatuses') },
            { value: 'draft', label: t('statuses.draft') },
            { value: 'intake', label: t('statuses.intake') },
            { value: 'preparation', label: t('statuses.preparation') },
            { value: 'processing', label: t('statuses.processing') },
            { value: 'ready', label: t('statuses.ready') },
            { value: 'ready_for_pickup', label: t('statuses.readyForPickup') },
            { value: 'out_for_delivery', label: t('statuses.outForDelivery') },
            { value: 'delivered', label: t('statuses.delivered') },
          ]}
        />

        {/* Preparation Status Filter */}
        <CmxSelect
          value={currentFilters.preparationStatus || ''}
          onChange={(e) => handleFilterChange('preparationStatus', e.target.value)}
          className="text-start"
          aria-label={t('prepStatus')}
          options={[
            { value: '', label: t('allPrepStatuses') },
            { value: 'pending', label: t('prepStatuses.pending') },
            { value: 'in_progress', label: t('prepStatuses.inProgress') },
            { value: 'completed', label: t('prepStatuses.completed') },
          ]}
        />

        {/* Priority Filter */}
        <CmxSelect
          value={currentFilters.priority || ''}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
          className="text-start"
          aria-label={t('filterByPriority')}
          options={[
            { value: '', label: t('allPriorities') },
            { value: 'normal', label: t('priorities.normal') },
            { value: 'urgent', label: t('priorities.urgent') },
            { value: 'express', label: t('priorities.express') },
          ]}
        />

        {/* Retail Filter */}
        <CmxSelect
          value={currentFilters.isRetail || ''}
          onChange={(e) => handleFilterChange('isRetail', e.target.value)}
          className="text-start"
          aria-label={t('filterByOrderType')}
          options={[
            { value: '', label: t('allOrders') },
            { value: 'true', label: t('retailOnly') },
            { value: 'false', label: t('servicesOnly') },
          ]}
        />

        <CmxSelect
          value={currentFilters.physicalIntakeStatus || ''}
          onChange={(e) => handleFilterChange('physicalIntakeStatus', e.target.value)}
          className="text-start"
          aria-label={t('filterByIntake')}
          options={[
            { value: '', label: t('allIntakeStatuses') },
            { value: 'pending_dropoff', label: t('intakePendingDropoff') },
            { value: 'received', label: t('intakeReceived') },
          ]}
        />

        <CmxInput
          type="date"
          value={currentFilters.fromDate || ''}
          onChange={(e) => handleFilterChange('fromDate', e.target.value)}
          aria-label={t('fromDate')}
        />

        <CmxInput
          type="date"
          value={currentFilters.toDate || ''}
          onChange={(e) => handleFilterChange('toDate', e.target.value)}
          aria-label={t('toDate')}
        />
      </div>

      {/* Clear Filters */}
      {(currentFilters.status ||
        currentFilters.preparationStatus ||
        currentFilters.priority ||
        currentFilters.isRetail ||
        currentFilters.physicalIntakeStatus ||
        currentFilters.fromDate ||
        currentFilters.toDate ||
        currentFilters.orderSourceCode ||
        currentFilters.overdue === 'true' ||
        currentFilters.search) && (
        <div className="mt-3">
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-auto px-1 py-0.5 text-sm text-primary-text hover:bg-transparent hover:text-primary-text/80"
          >
            {t('clearAllFilters')}
          </CmxButton>
        </div>
      )}
    </div>
  );
}
