'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers3, WalletCards } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  fetchCashDrawerOverview,
  fetchCashDrawerSessions,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  buildDrawerSessionIndicator,
  CashDrawerStatusBadge,
  CashDrawerTypeBadge,
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
  useCashDrawerStatusText,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import type { CashDrawerOverviewRow, CashDrawerSessionListRow } from '@lib/types/cash-drawer'
import { CmxDataTable, CmxEmptyState } from '@ui/data-display'
import { CmxButton } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'

const HUB_DRAWER_PAGE_SIZE = 5
const HUB_SESSION_PAGE_SIZE = 5

function readPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback

  return Math.floor(parsed)
}

/**
 * Operational cash-drawer master-detail hub.
 *
 * Why:
 * counter staff and finance users need one route that shows drawer readiness
 * and the session history beneath the selected drawer without bouncing between
 * multiple pages.
 */
export function CashDrawerHubScreen() {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const drawerPage = readPositiveInt(searchParams.get('drawerPage'), 1)
  const sessionPage = readPositiveInt(searchParams.get('sessionPage'), 1)
  const requestedDrawerId = searchParams.get('drawerId')

  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const statusText = useCashDrawerStatusText()

  const drawersQuery = useQuery({
    queryKey: ['cash-drawers', 'overview', drawerPage, HUB_DRAWER_PAGE_SIZE],
    queryFn: () =>
      fetchCashDrawerOverview({
        page: drawerPage,
        pageSize: HUB_DRAWER_PAGE_SIZE,
      }),
  })

  const selectedDrawer = useMemo(() => {
    const rows = drawersQuery.data?.items ?? []
    if (rows.length === 0) return null

    return rows.find((row) => row.id === requestedDrawerId) ?? rows[0]
  }, [drawersQuery.data?.items, requestedDrawerId])

  useEffect(() => {
    if (!drawersQuery.data) return
    if (drawersQuery.data.items.length === 0) return
    if (selectedDrawer == null) return
    if (requestedDrawerId === selectedDrawer.id) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('drawerId', selectedDrawer.id)
    nextParams.set('drawerPage', String(drawerPage))
    nextParams.set('sessionPage', '1')

    startTransition(() => {
      router.replace(`?${nextParams.toString()}`)
    })
  }, [
    drawerPage,
    drawersQuery.data,
    requestedDrawerId,
    router,
    searchParams,
    selectedDrawer,
    startTransition,
  ])

  const sessionsQuery = useQuery({
    queryKey: [
      'cash-drawers',
      'sessions',
      selectedDrawer?.id ?? 'none',
      sessionPage,
      HUB_SESSION_PAGE_SIZE,
    ],
    enabled: !!selectedDrawer?.id,
    queryFn: () =>
      fetchCashDrawerSessions({
        drawerId: selectedDrawer!.id,
        page: sessionPage,
        pageSize: HUB_SESSION_PAGE_SIZE,
      }),
  })

  const replaceSearchParams = (mutator: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    mutator(nextParams)
    const nextQuery = nextParams.toString()

    startTransition(() => {
      router.replace(nextQuery ? `?${nextQuery}` : '?')
    })
  }

  const handleDrawerPageChange = (page: number) => {
    replaceSearchParams((params) => {
      params.set('drawerPage', String(page))
      params.set('sessionPage', '1')
      params.delete('drawerId')
    })
  }

  const handleDrawerSelect = (drawerId: string) => {
    replaceSearchParams((params) => {
      params.set('drawerId', drawerId)
      params.set('sessionPage', '1')
    })
  }

  const handleSessionPageChange = (page: number) => {
    replaceSearchParams((params) => {
      params.set('sessionPage', String(page))
    })
  }

  const drawerColumns = [
    {
      key: 'drawerCode',
      header: t('columns.drawerCode'),
      render: (row: CashDrawerOverviewRow) => (
        <span className="font-mono text-xs font-semibold">{row.drawerCode}</span>
      ),
    },
    {
      key: 'drawerName',
      header: t('columns.drawer'),
      render: (row: CashDrawerOverviewRow) => (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            {row.drawerName}
          </div>
          {row.drawerName2 ? (
            <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {row.drawerName2}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'drawerType',
      header: t('columns.type'),
      render: (row: CashDrawerOverviewRow) => <CashDrawerTypeBadge drawerType={row.drawerType} />,
    },
    {
      key: 'branchName',
      header: tCommon('branch'),
      render: (row: CashDrawerOverviewRow) => row.branchName ?? row.branchId ?? '—',
    },
    {
      key: 'assignedTerminalName',
      header: t('columns.assignedTerminal'),
      render: (row: CashDrawerOverviewRow) =>
        row.assignedTerminalName
          ? row.assignedTerminalCode
            ? `${row.assignedTerminalName} (${row.assignedTerminalCode})`
            : row.assignedTerminalName
          : '—',
    },
    {
      key: 'currencyCode',
      header: tCommon('currency'),
      render: (row: CashDrawerOverviewRow) => (
        <span className="font-mono text-sm">{row.currencyCode}</span>
      ),
    },
    {
      key: 'requirements',
      header: t('columns.requirements'),
      render: (row: CashDrawerOverviewRow) => (
        <div className="flex flex-wrap gap-1">
          {row.requiresSession ? <Badge variant="secondary">{t('requiresSession')}</Badge> : null}
          {row.openingFloatRequired ? (
            <Badge variant="secondary">{t('openingFloatRequired')}</Badge>
          ) : null}
          {!row.requiresSession && !row.openingFloatRequired ? (
            <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'operationalStatus',
      header: t('columns.status'),
      render: (row: CashDrawerOverviewRow) => (
        <div className="space-y-1">
          <CashDrawerStatusBadge status={row.operationalStatus} />
          <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {statusText(row.operationalStatus)}
          </div>
        </div>
      ),
    },
    {
      key: 'sessionIndicator',
      header: t('columns.sessionIndicator'),
      render: (row: CashDrawerOverviewRow) => {
        const indicator = buildDrawerSessionIndicator(row.currentSession, row.latestSession)
        if (!indicator) {
          return <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">—</span>
        }

        return (
          <Badge variant={indicator.tone === 'open' ? 'default' : 'outline'}>
            {indicator.label}
          </Badge>
        )
      },
    },
    {
      key: 'drawerActions',
      header: tCommon('actions'),
      render: (row: CashDrawerOverviewRow) => (
        <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <CmxButton asChild variant="outline" size="sm">
            <Link href={`/dashboard/internal_fin/cash-drawers/${row.id}`}>
              {t('viewDrawer')}
            </Link>
          </CmxButton>
        </div>
      ),
      align: 'right' as const,
      sortable: false,
    },
  ]

  const sessionColumns = [
    {
      key: 'sessionNo',
      header: t('columns.sessionNo'),
      render: (row: CashDrawerSessionListRow) => (
        <span className="font-mono text-xs font-semibold">{row.sessionNo}</span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row: CashDrawerSessionListRow) => <CashDrawerStatusBadge status={row.status} />,
    },
    {
      key: 'openedAt',
      header: t('openedAt'),
      render: (row: CashDrawerSessionListRow) => fmtDateTime(row.openedAt),
    },
    {
      key: 'closedAt',
      header: t('closedAt'),
      render: (row: CashDrawerSessionListRow) => fmtDateTime(row.closedAt),
    },
    {
      key: 'openingFloatAmount',
      header: t('openingBalance'),
      render: (row: CashDrawerSessionListRow) =>
        money(row.openingFloatAmount, selectedDrawer?.currencyCode ?? null),
      align: 'right' as const,
    },
    {
      key: 'expectedCashAmount',
      header: t('expectedCash'),
      render: (row: CashDrawerSessionListRow) =>
        money(row.expectedCashAmount, selectedDrawer?.currencyCode ?? null),
      align: 'right' as const,
    },
    {
      key: 'countedCashAmount',
      header: t('physicalCount'),
      render: (row: CashDrawerSessionListRow) =>
        money(row.countedCashAmount, selectedDrawer?.currencyCode ?? null),
      align: 'right' as const,
    },
    {
      key: 'differenceAmount',
      header: t('variance'),
      render: (row: CashDrawerSessionListRow) =>
        money(row.differenceAmount, selectedDrawer?.currencyCode ?? null),
      align: 'right' as const,
    },
    {
      key: 'paymentCount',
      header: t('paymentCount'),
      render: (row: CashDrawerSessionListRow) => row.paymentCount,
      align: 'center' as const,
    },
    {
      key: 'movementCount',
      header: t('movementCount'),
      render: (row: CashDrawerSessionListRow) => row.movementCount,
      align: 'center' as const,
    },
    {
      key: 'sessionActions',
      header: tCommon('actions'),
      render: (row: CashDrawerSessionListRow) => (
        <div className="flex justify-end gap-2">
          <CmxButton asChild variant="outline" size="sm">
            <Link href={`/dashboard/internal_fin/cash-drawers/${selectedDrawer?.id}/session/${row.id}`}>
              {tCommon('view')}
            </Link>
          </CmxButton>
        </div>
      ),
      align: 'right' as const,
      sortable: false,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          {t('title')}
        </h1>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {t('description')}
        </p>
      </div>

      <CmxCard>
        <CmxCardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4" aria-hidden />
            <CmxCardTitle>{t('hub.masterTitle')}</CmxCardTitle>
          </div>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('hub.masterDescription')}
          </p>
        </CmxCardHeader>
        <CmxCardContent>
          {drawersQuery.isError ? (
            <CmxEmptyState
              icon={<WalletCards className="h-8 w-8" />}
              title={t('hub.loadDrawersFailedTitle')}
              description={t('hub.loadDrawersFailedDescription')}
            />
          ) : drawersQuery.data?.items.length === 0 && !drawersQuery.isLoading ? (
            <CmxEmptyState
              icon={<WalletCards className="h-8 w-8" />}
              title={t('noDrawers')}
              description={t('hub.emptyDescription')}
            />
          ) : (
            <CmxDataTable
              columns={drawerColumns}
              data={drawersQuery.data?.items ?? []}
              currentPage={drawerPage}
              pageSize={HUB_DRAWER_PAGE_SIZE}
              totalCount={drawersQuery.data?.total ?? 0}
              isLoading={drawersQuery.isLoading}
              onPageChange={handleDrawerPageChange}
              onPageSizeChange={() => undefined}
              pageSizeOptions={[HUB_DRAWER_PAGE_SIZE]}
              showPageSizeSelector={false}
              emptyStateTitle={t('noDrawers')}
              emptyStateDescription={t('hub.emptyDescription')}
              onRowClick={(row) => handleDrawerSelect(row.id)}
              getRowClassName={(row) =>
                row.id === selectedDrawer?.id
                  ? 'bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]'
                  : undefined
              }
            />
          )}
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4" aria-hidden />
                <CmxCardTitle>{t('hub.detailTitle')}</CmxCardTitle>
              </div>
              <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {selectedDrawer
                  ? t('hub.detailDescriptionSelected', { drawer: selectedDrawer.drawerName })
                  : t('hub.detailDescription')}
              </p>
            </div>
            {selectedDrawer ? (
              <div className="flex shrink-0 items-center gap-2">
                <CashDrawerStatusBadge status={selectedDrawer.operationalStatus} />
                <CashDrawerTypeBadge drawerType={selectedDrawer.drawerType} />
              </div>
            ) : null}
          </div>
        </CmxCardHeader>
        <CmxCardContent>
          {!selectedDrawer && !drawersQuery.isLoading ? (
            <CmxEmptyState
              icon={<WalletCards className="h-8 w-8" />}
              title={t('hub.noDrawerSelectedTitle')}
              description={t('hub.noDrawerSelectedDescription')}
            />
          ) : sessionsQuery.isError ? (
            <CmxEmptyState
              icon={<WalletCards className="h-8 w-8" />}
              title={t('hub.loadSessionsFailedTitle')}
              description={t('hub.loadSessionsFailedDescription')}
            />
          ) : (
            <CmxDataTable
              columns={sessionColumns}
              data={sessionsQuery.data?.items ?? []}
              currentPage={sessionPage}
              pageSize={HUB_SESSION_PAGE_SIZE}
              totalCount={sessionsQuery.data?.total ?? 0}
              isLoading={sessionsQuery.isLoading}
              onPageChange={handleSessionPageChange}
              onPageSizeChange={() => undefined}
              pageSizeOptions={[HUB_SESSION_PAGE_SIZE]}
              showPageSizeSelector={false}
              emptyStateTitle={t('hub.noSessionsTitle')}
              emptyStateDescription={t('hub.noSessionsDescription')}
            />
          )}
        </CmxCardContent>
      </CmxCard>
    </div>
  )
}
