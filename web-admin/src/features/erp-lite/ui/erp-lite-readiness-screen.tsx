'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { ErpLiteTenantReadiness, ErpLiteMissingUsageRow } from '@/lib/types/erp-lite-ops'
import type { ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxKpiStatCard } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'
import { Alert, AlertDescription } from '@ui/primitives'

interface ErpLiteReadinessScreenProps {
  readiness: ErpLiteTenantReadiness | null
  missingUsage: ErpLiteMissingUsageRow[]
  displayConfig: ErpLiteDisplayConfig
}

function ReadinessBadge({ status }: { status: ErpLiteTenantReadiness['readiness_status'] }) {
  if (status === 'READY') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        READY
      </span>
    )
  }
  if (status === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        WARNING
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-700">
      <XCircle className="h-4 w-4" />
      NOT READY
    </span>
  )
}

function MappingIssueBadge({ issue }: { issue: ErpLiteMissingUsageRow['mapping_issue'] }) {
  const palette: Record<string, string> = {
    MISSING: 'bg-red-500/10 text-red-700',
    ACCOUNT_INACTIVE: 'bg-amber-500/10 text-amber-700',
    ACCOUNT_NOT_POSTABLE: 'bg-amber-500/10 text-amber-700',
    TYPE_MISMATCH: 'bg-orange-500/10 text-orange-700',
    OK: 'bg-green-500/10 text-green-700',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[issue] ?? 'bg-muted text-muted-foreground'}`}
    >
      {issue}
    </span>
  )
}

export function ErpLiteReadinessScreen({
  readiness,
  missingUsage,
}: ErpLiteReadinessScreenProps) {
  const t = useTranslations('erpLite.readiness')
  const tCommon = useTranslations('erpLite.common')

  if (!readiness) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{tCommon('loadError')}</AlertDescription>
      </Alert>
    )
  }

  const issues = missingUsage.filter((r) => r.mapping_issue !== 'OK')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ReadinessBadge status={readiness.readiness_status} />
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CmxKpiStatCard
          title={t('kpi.missingMappings')}
          value={readiness.missing_required_mappings.toString()}
          subtitle={`${t('kpi.ofRequired', { count: readiness.total_required_mappings })}`}
        />
        <CmxKpiStatCard
          title={t('kpi.openExceptions')}
          value={readiness.open_exception_count.toString()}
        />
        <CmxKpiStatCard
          title={t('kpi.openPeriods')}
          value={readiness.open_period_count.toString()}
        />
        <CmxKpiStatCard
          title={t('kpi.coaAccounts')}
          value={readiness.total_coa_accounts.toString()}
          subtitle={`${readiness.postable_coa_accounts} ${t('kpi.postable')}`}
        />
      </div>

      {/* Gov assignment */}
      {!readiness.has_gov_assignment && (
        <Alert variant="destructive">
          <AlertDescription>{t('alerts.noGovAssignment')}</AlertDescription>
        </Alert>
      )}

      {/* Template status */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('sections.templateStatus')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('fields.lastTemplate')}</dt>
              <dd className="font-medium">{readiness.last_template_pkg_code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('fields.lastApplyStatus')}</dt>
              <dd className="font-medium">{readiness.last_apply_status ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('fields.lastAppliedAt')}</dt>
              <dd className="font-medium">
                {readiness.last_template_applied_at
                  ? new Date(readiness.last_template_applied_at).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('fields.lastPostedAt')}</dt>
              <dd className="font-medium">
                {readiness.last_posted_at
                  ? new Date(readiness.last_posted_at).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('fields.lastFailedAt')}</dt>
              <dd className="font-medium">
                {readiness.last_failed_at
                  ? new Date(readiness.last_failed_at).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
          </dl>
        </CmxCardContent>
      </CmxCard>

      {/* Missing / broken usage mappings */}
      {issues.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('sections.mappingIssues', { count: issues.length })}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-start font-normal">{t('columns.usageCode')}</th>
                    <th className="py-2 text-start font-normal">{t('columns.requiredType')}</th>
                    <th className="py-2 text-start font-normal">{t('columns.mappedAccount')}</th>
                    <th className="py-2 text-start font-normal">{t('columns.issue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((row) => (
                    <tr key={row.usage_code_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        {row.usage_code}
                        <div className="text-xs text-muted-foreground">{row.usage_code_name}</div>
                      </td>
                      <td className="py-2">{row.required_acc_type_code ?? '—'}</td>
                      <td className="py-2">
                        {row.mapped_account_code ? (
                          <>
                            {row.mapped_account_code}
                            <div className="text-xs text-muted-foreground">
                              {row.mapped_account_name}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <MappingIssueBadge issue={row.mapping_issue} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CmxCardContent>
        </CmxCard>
      )}
    </div>
  )
}
