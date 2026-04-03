import { getLocale, getTranslations } from 'next-intl/server';
import {
  Alert,
  AlertDescription,
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxInput,
  CmxSelect,
  CmxCardTitle,
} from '@ui/primitives';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { ErpLitePhase10Service } from '@/lib/services/erp-lite-phase10.service';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { currentTenantCan } from '@/lib/services/feature-flags.service';
import { formatErpLiteMoney } from '@features/erp-lite/lib/display-format';
import { getErpLiteDisplayConfig } from '@features/erp-lite/server/get-erp-lite-display-config';
import { ErpLiteBranchPlCostSummaryTable } from '@features/erp-lite/ui/erp-lite-branch-pl-cost-summary-table';
import { ErpLiteBranchPlProfitabilityTable } from '@features/erp-lite/ui/erp-lite-branch-pl-profitability-table';
import type { ErpLitePhase10DashboardSnapshot } from '@/lib/types/erp-lite-phase10';
import {
  addErpLiteAllocationRunLineAction,
  addErpLiteCostRunDetailAction,
  createErpLiteAllocationRuleAction,
  createErpLiteAllocationRunAction,
  createErpLiteCostComponentAction,
  createErpLiteCostRunAction,
  postErpLiteAllocationRunAction,
  postErpLiteCostRunAction,
} from '@/app/actions/erp-lite/branch-pl-actions';
import { CmxKpiStatCard } from '@ui/data-display';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLiteBranchPlPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.branchPl');
  const tCommon = await getTranslations('erpLite.common');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const displayConfig = await getErpLiteDisplayConfig();
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED);

  if (!isEnabled) {
    return (
      <ErpLitePageGuard
        feature={FEATURE_FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED}
        permissions={['erp_lite_branch_pl:view']}
      >
        {null}
      </ErpLitePageGuard>
    );
  }

  let loadError: string | null = null;
  let snapshot: ErpLitePhase10DashboardSnapshot = {
    profitability_rows: [],
    allocation_rules: [],
    allocation_runs: [],
    cost_components: [],
    cost_runs: [],
    cost_summary_rows: [],
    branch_options: [],
    allocation_rule_options: [],
    allocation_run_options: [],
    cost_component_options: [],
    cost_run_options: [],
    latest_alloc_run_no: null,
    latest_cost_run_no: null,
  };

  try {
    snapshot = await ErpLitePhase10Service.getDashboardSnapshot(locale);
  } catch (loadFailure) {
    loadError =
      loadFailure instanceof Error
        ? loadFailure.message
        : tCommon('loadError');
  }
  const rows = snapshot.profitability_rows;
  const totalRevenue = rows.reduce((sum, row) => sum + row.direct_revenue, 0);
  const totalExpense = rows.reduce((sum, row) => sum + row.direct_expense, 0);
  const totalDirectProfit = rows.reduce((sum, row) => sum + row.direct_profit, 0);
  const totalAllocatedProfit = rows.reduce((sum, row) => sum + row.allocated_profit, 0);

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_BRANCH_PL_ENABLED}
      permissions={['erp_lite_branch_pl:view']}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {notice ? (
          <Alert>
            <AlertDescription>{t(`notices.${notice}`)}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CmxKpiStatCard title={t('summary.revenue')} value={formatErpLiteMoney(totalRevenue, displayConfig)} subtitle={`${tCommon('currency')}: ${displayConfig.currencyCode}`} />
          <CmxKpiStatCard title={t('summary.expense')} value={formatErpLiteMoney(totalExpense, displayConfig)} subtitle={`${tCommon('currency')}: ${displayConfig.currencyCode}`} />
          <CmxKpiStatCard title={t('summary.directProfit')} value={formatErpLiteMoney(totalDirectProfit, displayConfig)} subtitle={`${tCommon('currency')}: ${displayConfig.currencyCode}`} />
          <CmxKpiStatCard title={t('summary.allocatedProfit')} value={formatErpLiteMoney(totalAllocatedProfit, displayConfig)} subtitle={`${tCommon('currency')}: ${displayConfig.currencyCode}`} />
        </div>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('list.title')}</CmxCardTitle>
            <CmxCardDescription>{t('list.subtitle')}</CmxCardDescription>
          </CmxCardHeader>
          <CmxCardContent>
            <ErpLiteBranchPlProfitabilityTable rows={rows} displayConfig={displayConfig} />
          </CmxCardContent>
        </CmxCard>

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.allocationRule.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.allocationRule.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteAllocationRuleAction} className="space-y-3">
                <CmxInput name="rule_code" label={t('forms.allocationRule.fields.code')} />
                <CmxInput name="name" label={t('forms.allocationRule.fields.name')} required />
                <CmxInput name="name2" label={t('forms.allocationRule.fields.name2')} />
                <CmxSelect
                  name="basis_code"
                  label={t('forms.allocationRule.fields.basis')}
                  defaultValue="REVENUE"
                  options={[
                    { value: 'REVENUE', label: 'REVENUE' },
                    { value: 'WEIGHT', label: 'WEIGHT' },
                    { value: 'PIECES', label: 'PIECES' },
                    { value: 'ORDERS', label: 'ORDERS' },
                    { value: 'MANUAL', label: 'MANUAL' },
                  ]}
                />
                <CmxInput name="effective_from" type="date" label={t('forms.allocationRule.fields.effectiveFrom')} />
                <CmxButton type="submit" className="w-full">{t('forms.allocationRule.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.allocationRun.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.allocationRun.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteAllocationRunAction} className="space-y-3">
                <CmxInput name="run_date" type="date" label={t('forms.allocationRun.fields.runDate')} required />
                <CmxButton type="submit" className="w-full">{t('forms.allocationRun.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.allocationLine.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.allocationLine.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={addErpLiteAllocationRunLineAction} className="space-y-3">
                <CmxSelect
                  name="alloc_run_id"
                  label={t('forms.allocationLine.fields.run')}
                  defaultValue=""
                  options={snapshot.allocation_run_options}
                  required
                />
                <CmxSelect
                  name="alloc_rule_id"
                  label={t('forms.allocationLine.fields.rule')}
                  defaultValue=""
                  options={snapshot.allocation_rule_options}
                />
                <CmxSelect
                  name="source_branch_id"
                  label={t('forms.allocationLine.fields.sourceBranch')}
                  defaultValue=""
                  options={snapshot.branch_options}
                />
                <CmxSelect
                  name="target_branch_id"
                  label={t('forms.allocationLine.fields.targetBranch')}
                  defaultValue=""
                  options={snapshot.branch_options}
                  required
                />
                <CmxInput name="source_amount" type="number" step="0.0001" label={t('forms.allocationLine.fields.sourceAmount')} required />
                <CmxInput name="alloc_amount" type="number" step="0.0001" label={t('forms.allocationLine.fields.allocAmount')} required />
                <CmxButton type="submit" className="w-full">{t('forms.allocationLine.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.allocationRuns.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.allocationRuns.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.allocation_runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.allocationRuns.empty')}</p>
              ) : (
                snapshot.allocation_runs.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.run_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.run_date} · {item.status_code} · {item.line_count} {t('lists.allocationRuns.lines')}
                    </div>
                    {item.status_code === 'DRAFT' ? (
                      <form action={postErpLiteAllocationRunAction} className="mt-3">
                        <input type="hidden" name="alloc_run_id" value={item.id} />
                        <CmxButton type="submit" variant="outline" className="w-full">
                          {t('lists.allocationRuns.post')}
                        </CmxButton>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.allocationRules.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.allocationRules.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.allocation_rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.allocationRules.empty')}</p>
              ) : (
                snapshot.allocation_rules.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.rule_code} · {item.rule_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.basis_code} · {item.status_code}
                    </div>
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.costComponent.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.costComponent.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCostComponentAction} className="space-y-3">
                <CmxInput name="comp_code" label={t('forms.costComponent.fields.code')} />
                <CmxInput name="name" label={t('forms.costComponent.fields.name')} required />
                <CmxInput name="name2" label={t('forms.costComponent.fields.name2')} />
                <CmxSelect
                  name="cost_class_code"
                  label={t('forms.costComponent.fields.class')}
                  defaultValue="DIRECT"
                  options={[
                    { value: 'DIRECT', label: 'DIRECT' },
                    { value: 'INDIRECT', label: 'INDIRECT' },
                  ]}
                />
                <CmxSelect
                  name="basis_code"
                  label={t('forms.costComponent.fields.basis')}
                  defaultValue="WEIGHT"
                  options={[
                    { value: 'WEIGHT', label: 'WEIGHT' },
                    { value: 'PIECES', label: 'PIECES' },
                    { value: 'ORDERS', label: 'ORDERS' },
                    { value: 'REVENUE', label: 'REVENUE' },
                    { value: 'MANUAL', label: 'MANUAL' },
                  ]}
                />
                <CmxButton type="submit" className="w-full">{t('forms.costComponent.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.costRun.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.costRun.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCostRunAction} className="space-y-3">
                <CmxInput name="run_date" type="date" label={t('forms.costRun.fields.runDate')} required />
                <CmxButton type="submit" className="w-full">{t('forms.costRun.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.costRunDetail.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.costRunDetail.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={addErpLiteCostRunDetailAction} className="space-y-3">
                <CmxSelect name="cost_run_id" label={t('forms.costRunDetail.fields.run')} defaultValue="" options={snapshot.cost_run_options} required />
                <CmxSelect name="cost_comp_id" label={t('forms.costRunDetail.fields.component')} defaultValue="" options={snapshot.cost_component_options} required />
                <CmxSelect name="branch_id" label={t('forms.costRunDetail.fields.branch')} defaultValue="" options={snapshot.branch_options} />
                <CmxInput name="basis_value" type="number" step="0.0001" label={t('forms.costRunDetail.fields.basisValue')} />
                <CmxInput name="alloc_amount" type="number" step="0.0001" label={t('forms.costRunDetail.fields.allocAmount')} required />
                <CmxInput name="unit_cost" type="number" step="0.0001" label={t('forms.costRunDetail.fields.unitCost')} />
                <CmxInput name="total_cost" type="number" step="0.0001" label={t('forms.costRunDetail.fields.totalCost')} required />
                <CmxButton type="submit" className="w-full">{t('forms.costRunDetail.submit')}</CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.costRuns.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.costRuns.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              {snapshot.cost_runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('lists.costRuns.empty')}</p>
              ) : (
                snapshot.cost_runs.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">{item.run_no}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.run_date} · {item.status_code} · {item.line_count} {t('lists.costRuns.lines')}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{formatErpLiteMoney(item.total_cost, displayConfig)}</div>
                    {item.status_code === 'DRAFT' ? (
                      <form action={postErpLiteCostRunAction} className="mt-3">
                        <input type="hidden" name="cost_run_id" value={item.id} />
                        <CmxButton type="submit" variant="outline" className="w-full">
                          {t('lists.costRuns.post')}
                        </CmxButton>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('lists.costSummary.title')}</CmxCardTitle>
            <CmxCardDescription>{t('lists.costSummary.subtitle')}</CmxCardDescription>
          </CmxCardHeader>
          <CmxCardContent>
            <ErpLiteBranchPlCostSummaryTable rows={snapshot.cost_summary_rows} displayConfig={displayConfig} />
          </CmxCardContent>
        </CmxCard>
      </div>
      </div>
    </ErpLitePageGuard>
  );
}
