'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxSelect } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CMX_DEFAULT_PAGE_SIZE, CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { useAuth } from '@/lib/auth/auth-context';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { SPEED_RULE_LEVELS } from '@/lib/commercial/speed';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import type { SpeedRuleView } from '@/lib/services/catalog/speed-rules.service';
import type { SpeedRuleCreateInput } from '@/lib/validations/speed-rule-schemas';
import { SpeedRulesApiError, deleteSpeedRuleApi, fetchSpeedRules, updateSpeedRuleApi, type SpeedRuleFilters } from '../api/speed-rules-api';
import { useSpeedRuleLookups } from '../hooks/use-speed-rule-lookups';
import { SpeedRuleBulkStatusDialog } from './speed-rule-bulk-status-dialog';
import { SpeedRuleEditorDialog } from './speed-rule-editor-dialog';
import { SpeedRuleGuidanceCard, SpeedRuleProductField, SpeedRuleScopeText, useSpeedRuleValueText, type PickedProduct } from './speed-rule-parts';
import { SpeedRuleResolverPanel } from './speed-rule-resolver-panel';

type Editor = { mode: 'create' | 'bulk' } | { mode: 'edit'; rule: SpeedRuleView };

const toInput = (rule: SpeedRuleView, isActive: boolean): SpeedRuleCreateInput => ({
  serviceSpeed: rule.serviceSpeed,
  branchId: rule.branchId,
  serviceCategoryCode: rule.serviceCategoryCode,
  productId: rule.productId,
  speedPriceType: rule.speedPriceType,
  defaultSpeedSellPrice: rule.defaultSpeedSellPrice,
  multiplierSpeed: rule.multiplierSpeed,
  speedExtraAmount: rule.speedExtraAmount,
  priceBasis: rule.priceBasis,
  turnaroundHhSpeed: rule.turnaroundHhSpeed,
  turnaroundUnit: rule.turnaroundUnit,
  turnaroundDaysSpeed: rule.turnaroundDaysSpeed,
  cutoffTimeSpeed: rule.cutoffTimeSpeed,
  name: rule.name,
  name2: rule.name2,
  effectiveFrom: rule.effectiveFrom,
  effectiveTo: rule.effectiveTo,
  isActive,
});

/**
 * Catalog › Speed Pricing: the rules that add a premium for a faster service.
 * Filters and paging run on the server; rules are scoped to the authenticated tenant.
 * @returns the screen
 */
export function SpeedPricingScreen() {
  const t = useTranslations('catalog.speedPricing');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { token: csrfToken } = useCSRFToken();
  const valueText = useSpeedRuleValueText();
  const { speedOptions, branchOptions, categoryOptions, speedLabel, branchLabel, categoryLabel } = useSpeedRuleLookups();

  const canCreate = useHasPermissionCode(PRICING_PERMISSIONS.CREATE);
  const canUpdate = useHasPermissionCode(PRICING_PERMISSIONS.UPDATE);
  const canDelete = useHasPermissionCode(PRICING_PERMISSIONS.DELETE);
  const canBulk = useHasPermissionCode(PRICING_PERMISSIONS.BULK);

  const [filters, setFilters] = useState<SpeedRuleFilters>({});
  const [filterProduct, setFilterProduct] = useState<PickedProduct | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(CMX_DEFAULT_PAGE_SIZE);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<SpeedRuleView | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const tenantId = currentTenant?.tenant_id;
  const list = useQuery({
    queryKey: ['speed-rules', 'list', tenantId, filters, page, pageSize],
    queryFn: ({ signal }) => fetchSpeedRules(filters, page, pageSize, signal),
    // Prevent the query before the tenant is confirmed.
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['speed-rules', 'list', tenantId] });
  const setFilter = (patch: SpeedRuleFilters) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const errorText = (error: unknown) => {
    const code = error instanceof SpeedRulesApiError ? error.code : 'INTERNAL_ERROR';
    return t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.INTERNAL_ERROR');
  };

  const setActive = async (rule: SpeedRuleView, isActive: boolean) => {
    try {
      await updateSpeedRuleApi(rule.id, toInput(rule, isActive), csrfToken);
      cmxMessage.success(t('saved'));
      await refresh();
    } catch (error) {
      cmxMessage.error(errorText(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSpeedRuleApi(deleting.id, csrfToken);
      cmxMessage.success(t('deleted'));
      await refresh();
    } catch (error) {
      cmxMessage.error(errorText(error));
    } finally {
      setDeleting(null);
    }
  };

  const columns: CmxDataTableSimpleColumn<SpeedRuleView>[] = [
    { key: 'speed', header: t('fields.speed'), render: (rule) => speedLabel(rule.serviceSpeed), sortable: false },
    {
      key: 'scope',
      header: t('fields.scope'),
      render: (rule) => <SpeedRuleScopeText rule={rule} categoryLabel={categoryLabel} branchLabel={branchLabel} />,
      sortable: false,
    },
    { key: 'value', header: t('fields.value'), render: (rule) => valueText(rule), sortable: false },
    {
      key: 'dates',
      header: t('fields.effective'),
      render: (rule) => `${rule.effectiveFrom} → ${rule.effectiveTo ?? t('openEnded')}`,
      sortable: false,
    },
    {
      key: 'status',
      header: tCommon('status'),
      render: (rule) => (
        <CmxStatusBadge label={rule.isActive ? tCommon('active') : tCommon('inactive')} variant={rule.isActive ? 'success' : 'outline'} size="sm" />
      ),
      sortable: false,
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      render: (rule) => (
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <>
              <CmxButton type="button" size="sm" variant="outline" onClick={() => setEditor({ mode: 'edit', rule })}>{tCommon('edit')}</CmxButton>
              <CmxButton type="button" size="sm" variant="outline" onClick={() => setActive(rule, !rule.isActive)}>
                {rule.isActive ? t('deactivate') : t('activate')}
              </CmxButton>
            </>
          ) : null}
          {canDelete ? (
            <CmxButton type="button" size="sm" variant="outline" onClick={() => setDeleting(rule)}>{tCommon('delete')}</CmxButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBulk ? <CmxButton type="button" variant="outline" onClick={() => setBulkStatusOpen(true)}>{t('bulkStatus.open')}</CmxButton> : null}
          {canBulk ? <CmxButton type="button" variant="outline" onClick={() => setEditor({ mode: 'bulk' })}>{t('bulk.open')}</CmxButton> : null}
          {canCreate ? <CmxButton type="button" onClick={() => setEditor({ mode: 'create' })}>{t('addRule')}</CmxButton> : null}
        </div>
      </div>

      <CmxCard>
        <CmxCardContent className="space-y-2 pt-6">
          <p className="text-sm font-medium">{t('order.title')}</p>
          <ol className="list-inside list-decimal space-y-0.5 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] sm:columns-2">
            {SPEED_RULE_LEVELS.map((level) => <li key={level}>{t(`level.${level}`)}</li>)}
          </ol>
        </CmxCardContent>
      </CmxCard>

      <SpeedRuleGuidanceCard speedLabel={speedLabel} />

      <CmxCard>
        <CmxCardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <CmxSelect
            label={t('fields.speed')}
            options={[{ value: '', label: tCommon('all') }, ...speedOptions]}
            value={filters.serviceSpeed ?? ''}
            onChange={(e) => setFilter({ serviceSpeed: e.target.value || undefined })}
          />
          <CmxSelect
            label={t('fields.branch')}
            options={[{ value: '', label: tCommon('all') }, ...branchOptions]}
            value={filters.branchId ?? ''}
            onChange={(e) => setFilter({ branchId: e.target.value || undefined })}
          />
          <CmxSelect
            label={t('fields.category')}
            options={[{ value: '', label: tCommon('all') }, ...categoryOptions]}
            value={filters.serviceCategoryCode ?? ''}
            onChange={(e) => setFilter({ serviceCategoryCode: e.target.value || undefined })}
          />
          <SpeedRuleProductField
            label={t('fields.product')}
            value={filterProduct}
            onChange={(next) => {
              setFilterProduct(next);
              setFilter({ productId: next?.id });
            }}
          />
          <CmxSelect
            label={tCommon('status')}
            options={[
              { value: '', label: tCommon('all') },
              { value: 'true', label: tCommon('active') },
              { value: 'false', label: tCommon('inactive') },
            ]}
            value={filters.active ?? ''}
            onChange={(e) => setFilter({ active: (e.target.value || undefined) as SpeedRuleFilters['active'] })}
          />
        </CmxCardContent>
      </CmxCard>

      {list.isError ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[errorText(list.error)]} /> : null}

      <CmxDataTable
        columns={columns}
        data={list.data?.rows ?? []}
        loading={list.isLoading}
        currentPage={page}
        pageSize={pageSize}
        total={list.data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        emptyStateTitle={t('empty.title')}
        emptyStateDescription={t('empty.description')}
        stickyEndColumnIds={['actions']}
      />

      <SpeedRuleResolverPanel
        speedOptions={speedOptions}
        branchOptions={branchOptions}
        categoryOptions={categoryOptions}
        categoryLabel={categoryLabel}
        branchLabel={branchLabel}
      />

      {bulkStatusOpen ? (
        <SpeedRuleBulkStatusDialog
          speedOptions={speedOptions}
          categoryOptions={categoryOptions}
          onClose={() => setBulkStatusOpen(false)}
          onDone={() => {
            setBulkStatusOpen(false);
            void refresh();
          }}
        />
      ) : null}

      {editor ? (
        <SpeedRuleEditorDialog
          key={editor.mode === 'edit' ? editor.rule.id : editor.mode}
          mode={editor.mode}
          rule={editor.mode === 'edit' ? editor.rule : undefined}
          speedOptions={speedOptions}
          branchOptions={branchOptions}
          categoryOptions={categoryOptions}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void refresh();
          }}
        />
      ) : null}

      <CmxConfirmDialog
        open={!!deleting}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
