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
          { key: 'rule_name2', header: t('fields.name2'), render: (row: DiscountRule) => row.rule_name2 || '—' },
          { key: 'description', header: t('fields.description'), render: (row: DiscountRule) => row.description || '—' },
          { key: 'description2', header: t('fields.description2'), render: (row: DiscountRule) => row.description2 || '—' },
          { key: 'rule_type', header: t('fields.ruleType'), render: (row: DiscountRule) => row.rule_type },
          { key: 'discount_type', header: t('fields.discountType'), render: (row: DiscountRule) => row.discount_type },
          { key: 'discount_value', header: t('fields.discountValue'), render: (row: DiscountRule) => row.discount_value.toFixed(3) },
          { key: 'conditions', header: t('fields.conditions'), render: (row: DiscountRule) => JSON.stringify(row.conditions, null, 2) },
          { key: 'can_stack_with_promo', header: t('fields.canStackWithPromo'), render: (row: DiscountRule) => (
            <Badge variant={row.can_stack_with_promo ? 'default' : 'secondary'}>
              {row.can_stack_with_promo ? tCommon('yes') : tCommon('no')}
            </Badge>
          )},
          { key: 'can_stack_with_other_rules', header: t('fields.canStackWithOtherRules'), render: (row: DiscountRule) => (
            <Badge variant={row.can_stack_with_other_rules ? 'default' : 'secondary'}>
              {row.can_stack_with_other_rules ? tCommon('yes') : tCommon('no')}
            </Badge>
          )},
          { key: 'valid_from', header: t('fields.validFrom'), render: (row: DiscountRule) => new Date(row.valid_from).toLocaleDateString() },
          { key: 'valid_to', header: t('fields.validTo'), render: (row: DiscountRule) => (
            row.valid_to
              ? new Date(row.valid_to).toLocaleDateString()
              : '—'
          )},
          { key: 'is_active', header: t('fields.isActive'), render: (row: DiscountRule) => (
            <Badge variant={row.is_active ? 'default' : 'secondary'}>
              {row.is_active ? tCommon('active') : tCommon('inactive')}
            </Badge>
          )},
          { key: 'is_enabled', header: t('fields.isEnabled'), render: (row: DiscountRule) => (
            <Badge variant={row.is_enabled ? 'default' : 'secondary'}>
              {row.is_enabled ? tCommon('enabled') : tCommon('disabled')}
            </Badge>
          )},
          { key: 'metadata', header: t('fields.metadata'), render: (row: DiscountRule) => row.metadata ? JSON.stringify(row.metadata, null, 2) : '—' },
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
