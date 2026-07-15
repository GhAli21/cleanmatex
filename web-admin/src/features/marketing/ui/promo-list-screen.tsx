'use client';

/**
 * Promo Codes List Screen
 *
 * Displays paginated promo codes with search, status filter, and row actions.
 * Uses server actions for data fetching and mutations.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  PlusCircle,
  Search,
  Archive,
  Edit,
  BarChart2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import { usePromoCodes } from '../hooks/use-promos';
import type { PromoCode } from '@/lib/types/payment';
import { PromoFormDialog } from './promo-form-dialog';
import { PromoUsageTable } from './promo-usage-table';

/**
 * Marketing promo list — canonical admin surface for org_promotions_mst.
 */
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
      const { archivePromoCode } = await import('@/app/actions/marketing/promo-actions');
      await archivePromoCode(id);
      refetch();
    },
    [refetch]
  );

  const handleToggleEnabled = useCallback(
    async (row: PromoCode) => {
      const { setPromoCodeEnabled } = await import('@/app/actions/marketing/promo-actions');
      const result = await setPromoCodeEnabled(row.id, !row.is_enabled);
      if (result.success === false) {
        cmxMessage.error(result.error);
        return;
      }
      cmxMessage.success(row.is_enabled ? t('deactivated') : t('activated'));
      refetch();
    },
    [refetch, t]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <CmxButton
          variant="primary"
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {t('create')}
        </CmxButton>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <CmxInput
            className="ps-8"
            placeholder={tCommon('search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'active', 'expired'] as const).map((s) => (
            <CmxButton
              key={s}
              variant={status === s ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {tCommon(s)}
            </CmxButton>
          ))}
        </div>
      </div>

      <CmxDataTable
        isLoading={isLoading}
        columns={[
          {
            key: 'promo_code',
            header: t('fields.code'),
            render: (row: PromoCode) =>
              row.promo_code ? (
                <span className="font-mono font-medium">{row.promo_code}</span>
              ) : (
                <Badge variant="outline">{t('fields.autoApply')}</Badge>
              ),
          },
          {
            key: 'promo_name',
            header: t('fields.name'),
            render: (row: PromoCode) => row.promo_name,
          },
          {
            key: 'discount_type',
            header: t('fields.discountType'),
            render: (row: PromoCode) =>
              t(`discountTypeLabels.${row.discount_type}` as 'discountTypeLabels.percentage'),
          },
          {
            key: 'discount_value',
            header: t('fields.discountValue'),
            render: (row: PromoCode) => (
              <span className="tabular-nums">
                {row.discount_value.toFixed(3)}
                {row.discount_type === 'percentage' ? '%' : ''}
              </span>
            ),
          },
          {
            key: 'max_uses',
            header: t('fields.maxUses'),
            render: (row: PromoCode) =>
              row.max_uses != null
                ? `${row.current_uses ?? 0} / ${row.max_uses}`
                : t('fields.unlimited'),
          },
          {
            key: 'valid_from',
            header: t('fields.validFrom'),
            render: (row: PromoCode) => new Date(row.valid_from).toLocaleString(),
          },
          {
            key: 'valid_to',
            header: t('fields.validTo'),
            render: (row: PromoCode) =>
              row.valid_to ? new Date(row.valid_to).toLocaleString() : t('fields.noExpiry'),
          },
          {
            key: 'is_enabled',
            header: t('fields.isEnabled'),
            render: (row: PromoCode) => (
              <Badge variant={row.is_enabled ? 'default' : 'secondary'}>
                {row.is_enabled ? tCommon('enabled') : tCommon('disabled')}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: PromoCode) => (
              <div className="flex gap-1">
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={tCommon('edit')}
                  onClick={() => setEditingPromo(row)}
                >
                  <Edit className="h-4 w-4" />
                </CmxButton>
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={row.is_enabled ? t('deactivate') : t('activate')}
                  onClick={() => handleToggleEnabled(row)}
                >
                  {row.is_enabled ? (
                    <ToggleRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </CmxButton>
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={t('usageReport')}
                  onClick={() => setViewingUsagePromoId(row.id)}
                >
                  <BarChart2 className="h-4 w-4" />
                </CmxButton>
                <CmxConfirmDialog
                  title={t('archive')}
                  description={t('confirmArchive')}
                  confirmLabel={t('archive')}
                  cancelLabel={tCommon('cancel')}
                  onConfirm={() => handleArchive(row.id)}
                  trigger={
                    <CmxButton variant="ghost" size="xs" title={t('archive')}>
                      <Archive className="h-4 w-4" />
                    </CmxButton>
                  }
                />
              </div>
            ),
          },
        ]}
        data={promoCodes}
        totalCount={total}
        currentPage={page}
        pageSize={25}
        onPageChange={setPage}
      />

      <PromoFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          refetch();
        }}
      />

      <PromoFormDialog
        open={!!editingPromo}
        promo={editingPromo ?? undefined}
        onClose={() => setEditingPromo(null)}
        onSuccess={() => {
          setEditingPromo(null);
          refetch();
        }}
      />

      {viewingUsagePromoId && (
        <PromoUsageTable
          promoCodeId={viewingUsagePromoId}
          onClose={() => setViewingUsagePromoId(null)}
        />
      )}
    </div>
  );
}
