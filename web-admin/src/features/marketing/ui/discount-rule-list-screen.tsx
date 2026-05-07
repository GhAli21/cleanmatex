'use client';

/**
 * Discount Rules List Screen
 *
 * Displays active discount rules ordered by priority.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Search, Archive, Edit } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { CmxConfirmDialog } from '@ui/feedback';
import { useDiscountRules } from '../hooks/use-discount-rules';
import type { DiscountRule } from '@/lib/types/payment';
import { DiscountRuleFormDialog } from './discount-rule-form-dialog';

export function DiscountRuleListScreen() {
  const t = useTranslations('marketing.discountRules');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);

  const { rules, total, isLoading, refetch } = useDiscountRules({ search, page });

  const handleArchive = useCallback(
    async (id: string) => {
      const { archiveDiscountRule } = await import(
        '@/app/actions/marketing/discount-rule-actions'
      );
      await archiveDiscountRule(id);
      refetch();
    },
    [refetch]
  );

  return (
    <div className="flex flex-col gap-4">
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

      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <CmxInput
          className="ps-8"
          placeholder={tCommon('search')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <CmxDataTable
        isLoading={isLoading}
        columns={[
          {
            key: 'priority',
            header: t('fields.priority'),
            render: (row: DiscountRule) => <span className="font-mono">{row.priority}</span>,
          },
          { key: 'rule_code', header: t('fields.code'), render: (row: DiscountRule) => row.rule_code },
          { key: 'rule_name', header: t('fields.name'), render: (row: DiscountRule) => row.rule_name },
          {
            key: 'discount',
            header: t('fields.discountValue'),
            render: (row: DiscountRule) =>
              row.discount_type === 'percentage'
                ? `${row.discount_value}%`
                : `${row.discount_value}`,
          },
          {
            key: 'stackable',
            header: t('fields.stackWithPromo'),
            render: (row: DiscountRule) => (
              <Badge variant={row.can_stack_with_promo ? 'default' : 'secondary'}>
                {row.can_stack_with_promo ? tCommon('yes') : tCommon('no')}
              </Badge>
            ),
          },
          {
            key: 'status',
            header: tCommon('status'),
            render: (row: DiscountRule) => (
              <Badge variant={row.is_enabled ? 'default' : 'secondary'}>
                {row.is_enabled ? tCommon('active') : tCommon('inactive')}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: DiscountRule) => (
              <div className="flex gap-1">
                <CmxButton
                  variant="ghost"
                  size="icon"
                  title={tCommon('edit')}
                  onClick={() => setEditingRule(row)}
                >
                  <Edit className="h-4 w-4" />
                </CmxButton>
                <CmxConfirmDialog
                  title={t('archive')}
                  description={t('confirmArchive')}
                  confirmLabel={t('archive')}
                  cancelLabel={tCommon('cancel')}
                  onConfirm={() => handleArchive(row.id)}
                  trigger={
                    <CmxButton
                      variant="ghost"
                      size="icon"
                      title={t('archive')}
                    >
                      <Archive className="h-4 w-4" />
                    </CmxButton>
                  }
                />
              </div>
            ),
          },
        ]}
        data={rules}
        totalCount={total}
        currentPage={page}
        pageSize={25}
        onPageChange={setPage}
      />

      <DiscountRuleFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => { setShowCreateDialog(false); refetch(); }}
      />

      <DiscountRuleFormDialog
        open={!!editingRule}
        rule={editingRule ?? undefined}
        onClose={() => setEditingRule(null)}
        onSuccess={() => { setEditingRule(null); refetch(); }}
      />
    </div>
  );
}
