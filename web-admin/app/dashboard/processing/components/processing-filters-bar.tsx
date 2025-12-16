/**
 * Processing Filters Bar Component
 * Dropdown filters and status search input
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProcessingFilters } from '@/types/processing';

interface ProcessingFiltersBarProps {
  filters: ProcessingFilters;
  onFilterChange: (filters: ProcessingFilters) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function ProcessingFiltersBar({
  filters,
  onFilterChange,
  statusFilter,
  onStatusFilterChange,
}: ProcessingFiltersBarProps) {
  const t = useTranslations('processing.filters');
  const [localFilters, setLocalFilters] = useState<ProcessingFilters>(filters);

  const handleFilterUpdate = (key: keyof ProcessingFilters, value: string) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Reports Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 rtl:text-right">
            {t('reports')}
          </label>
          <select
            value={localFilters.reports || ''}
            onChange={(e) => handleFilterUpdate('reports', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('allReports')}</option>
            <option value="daily">{t('daily')}</option>
            <option value="weekly">{t('weekly')}</option>
            <option value="monthly">{t('monthly')}</option>
          </select>
        </div>

        {/* Sections Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 rtl:text-right">
            {t('sections')}
          </label>
          <select
            value={localFilters.sections || ''}
            onChange={(e) => handleFilterUpdate('sections', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('allSections')}</option>
            <option value="washing">{t('washing')}</option>
            <option value="drying">{t('drying')}</option>
            <option value="finishing">{t('finishing')}</option>
            <option value="assembly">{t('assembly')}</option>
            <option value="qa">{t('qa')}</option>
          </select>
        </div>

        {/* Order Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 rtl:text-right">
            {t('orderType')}
          </label>
          <select
            value={localFilters.orderType || ''}
            onChange={(e) => handleFilterUpdate('orderType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('allTypes')}</option>
            <option value="normal">{t('normal')}</option>
            <option value="express">{t('express')}</option>
            <option value="urgent">{t('urgent')}</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 rtl:text-right">
            {t('date')}
          </label>
          <input
            type="date"
            value={localFilters.date || ''}
            onChange={(e) => handleFilterUpdate('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter (positioned above status column in table) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 rtl:text-right">
            {t('filterStatus')}
          </label>
          <input
            type="text"
            placeholder={t('typeToFilter')}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
