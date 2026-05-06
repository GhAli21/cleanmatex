'use client';

/**
 * Promo Codes List Screen
 *
 * Displays paginated promo codes with search, status filter, and row actions.
 * Uses server actions for data fetching and mutations.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Search, Archive, Edit, BarChart2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { usePromoCodes } from '../hooks/use-promos';
import type { PromoCode } from '@/lib/types/payment';
import { PromoFormDialog } from './promo-form-dialog';
import { PromoUsageTable } from './promo-usage-table';

export function PromoListScreen() {
  const t = useTranslations('marketing.promos');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [page, setPage] = useState(1);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [viewingUsagePromoId, setViewingUsagePromoId] = useState<string | null>(null);

  const { promoCodes, total, isLoading, refetch } = usePromoCodes({ search, status, page });

  const handleArchive = useCallback(
    async (id: string) => {
      const { archivePromoCode } = await import(
        '@/app/actions/marketing/promo-actions'
      );
      await archivePromoCode(id);
      refetch();
    },
    [refetch]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <CmxButton
          variant="default"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          icon={<PlusCircle className="h-4 w-4" />}
        >
          {t('create')}
        </CmxButton>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <CmxInput
            className="ps-8"
            placeholder={tCommon('search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'expired'] as const).map((s) => (
            <CmxButton
              key={s}
              variant={status === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatus(s); setPage(1); }}
            >
              {tCommon(s)}
            </CmxButton>
          ))}
        </div>
      </div>

      {/* Table */}
      <CmxDataTable
        isLoading={isLoading}
        columns={[
          { key: 'promo_code', header: t('fields.code'), render: (row: PromoCode) => (
            <span className="font-mono font-medium">{row.promo_code}</span>
          )},
          { key: 'promo_name', header: t('fields.name'), render: (row: PromoCode) => row.promo_name },
          { key: 'discount', header: t('fields.discountType'), render: (row: PromoCode) => (
            <span>
              {row.discount_type === 'percentage'
                ? `${row.discount_value}%`
                : `${row.discount_value}`}
            </span>
          )},
          { key: 'max_uses', header: t('fields.maxUses'), render: (row: PromoCode) => (
            row.max_uses != null
              ? `${row.current_uses ?? 0} / ${row.max_uses}`
              : '—'
          )},
          { key: 'valid_to', header: t('fields.validTo'), render: (row: PromoCode) => (
            row.valid_to
              ? new Date(row.valid_to).toLocaleDateString()
              : '—'
          )},
          { key: 'status', header: tCommon('status'), render: (row: PromoCode) => {
            const now = new Date();
            const isExpired = row.valid_to ? new Date(row.valid_to) < now : false;
            const isMaxed = row.max_uses != null && (row.current_uses ?? 0) >= row.max_uses;
            if (isExpired) return <Badge variant="secondary">{t('status.expired')}</Badge>;
            if (isMaxed) return <Badge variant="secondary">{t('status.maxReached')}</Badge>;
            if (row.is_enabled) return <Badge variant="default">{t('status.active')}</Badge>;
            return <Badge variant="outline">{tCommon('inactive')}</Badge>;
          }},
          { key: 'actions', header: tCommon('actions'), render: (row: PromoCode) => (
            <div className="flex gap-1">
              <CmxButton
                variant="ghost"
                size="icon"
                title={tCommon('edit')}
                onClick={() => setEditingPromo(row)}
              >
                <Edit className="h-4 w-4" />
              </CmxButton>
              <CmxButton
                variant="ghost"
                size="icon"
                title={t('usageReport')}
                onClick={() => setViewingUsagePromoId(row.id)}
              >
                <BarChart2 className="h-4 w-4" />
              </CmxButton>
              <CmxButton
                variant="ghost"
                size="icon"
                title={t('archive')}
                onClick={() => handleArchive(row.id)}
              >
                <Archive className="h-4 w-4" />
              </CmxButton>
            </div>
          )},
        ]}
        data={promoCodes}
        totalCount={total}
        currentPage={page}
        pageSize={25}
        onPageChange={setPage}
      />

      {/* Create dialog */}
      <PromoFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => { setShowCreateDialog(false); refetch(); }}
      />

      {/* Edit dialog */}
      <PromoFormDialog
        open={!!editingPromo}
        promo={editingPromo ?? undefined}
        onClose={() => setEditingPromo(null)}
        onSuccess={() => { setEditingPromo(null); refetch(); }}
      />

      {/* Usage report dialog */}
      {viewingUsagePromoId && (
        <PromoUsageTable
          promoCodeId={viewingUsagePromoId}
          onClose={() => setViewingUsagePromoId(null)}
        />
      )}
    </div>
  );
}
