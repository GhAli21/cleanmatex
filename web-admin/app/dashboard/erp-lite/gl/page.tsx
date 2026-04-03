import { Suspense } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags'
import { currentTenantCan } from '@/lib/services/feature-flags.service'
import {
  ErpLiteReportingService,
  type ErpLiteGlInquiryFilters,
} from '@/lib/services/erp-lite-reporting.service'
import { getErpLiteDisplayConfig } from '@features/erp-lite/server/get-erp-lite-display-config'
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard'
import { GlFilterBar } from '@features/erp-lite/ui/gl-filter-bar'
import { GlSummaryBar } from '@features/erp-lite/ui/gl-summary-bar'
import { GlInquiryTable } from '@features/erp-lite/ui/gl-inquiry-table'
import { GlPagination } from '@features/erp-lite/ui/gl-pagination'
import { GlJournalDetailPanel } from '@features/erp-lite/ui/gl-journal-detail-panel'
import { Alert, AlertDescription } from '@ui/primitives'

interface GlPageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    dateFrom?: string
    dateTo?: string
    eventCode?: string
    accountCode?: string
    entrySide?: string
    journalNo?: string
    journalId?: string
  }>
}

export default async function ErpLiteGlPage({ searchParams }: GlPageProps) {
  const t = await getTranslations('erpLite.reports')
  const tCommon = await getTranslations('erpLite.common')
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en'
  const displayConfig = await getErpLiteDisplayConfig()
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED)
  const sp = await searchParams

  if (!isEnabled) {
    return (
      <ErpLitePageGuard feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED} permissions={['erp_lite_gl:view']}>
        {null}
      </ErpLitePageGuard>
    )
  }

  // Parse filters from URL search params
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const pageSizeRaw = parseInt(sp.pageSize ?? '50', 10)
  const pageSize = ([25, 50, 100] as number[]).includes(pageSizeRaw) ? pageSizeRaw : 50

  const filters: ErpLiteGlInquiryFilters = {
    page,
    pageSize,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    eventCode: sp.eventCode || undefined,
    accountCode: sp.accountCode || undefined,
    entrySide: (sp.entrySide as 'DEBIT' | 'CREDIT') || undefined,
    journalNo: sp.journalNo || undefined,
  }

  // Parallel data fetches
  let loadError: string | null = null
  let rows: Awaited<ReturnType<typeof ErpLiteReportingService.getGlInquiry>>['rows'] = []
  let total = 0
  let summary: Awaited<ReturnType<typeof ErpLiteReportingService.getGlSummary>> = {
    totalDebit: 0,
    totalCredit: 0,
    rowCount: 0,
  }
  let eventCodes: string[] = []
  let journalDetail: Awaited<ReturnType<typeof ErpLiteReportingService.getGlJournalDetail>> = null

  try {
    const [inquiry, sum, codes] = await Promise.all([
      ErpLiteReportingService.getGlInquiry(filters, locale),
      ErpLiteReportingService.getGlSummary(filters, locale),
      ErpLiteReportingService.getGlDistinctEventCodes(locale),
    ])
    rows = inquiry.rows
    total = inquiry.total
    summary = sum
    eventCodes = codes

    // Detail panel: load if journalId param is present
    if (sp.journalId) {
      journalDetail = await ErpLiteReportingService.getGlJournalDetail(sp.journalId, locale)
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : tCommon('loadError')
  }

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_GL_ENABLED}
      permissions={['erp_lite_gl:view']}
    >
      <div className="space-y-5">
        {/* Page header */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            ERP-Lite
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            {t('gl.title')}
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('gl.subtitle')}
          </p>
        </div>

        {/* Error banner */}
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!loadError && (
          <>
            {/* Summary KPI cards */}
            <GlSummaryBar summary={summary} displayConfig={displayConfig} />

            {/* Filter bar — needs Suspense because it reads useSearchParams */}
            <Suspense>
              <GlFilterBar eventCodes={eventCodes} />
            </Suspense>

            {/* Master table — clickable rows open the detail panel */}
            <Suspense>
              <GlInquiryTable rows={rows} selectedJournalId={sp.journalId} displayConfig={displayConfig} />
            </Suspense>

            {/* Pagination */}
            {total > 0 && (
              <Suspense>
                <GlPagination page={page} pageSize={pageSize} total={total} />
              </Suspense>
            )}
          </>
        )}
      </div>

      {/* Master-detail slide-over rendered outside the main flow */}
      {journalDetail && (
        <Suspense>
          <GlJournalDetailPanel journal={journalDetail} displayConfig={displayConfig} />
        </Suspense>
      )}
    </ErpLitePageGuard>
  )
}
