'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Route, Truck } from 'lucide-react'
import { CmxDataTable, CmxDataGrid, CmxEmptyState, type AuditExtraRow } from '@ui/data-display'
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxCheckbox, CmxInput, CmxSkeletonTable } from '@ui/primitives'
import { formatDateTime } from '@/lib/utils/rtl'
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens'
import { useAuth } from '@/lib/auth/auth-context'
import { useScreenOrders } from '@/lib/hooks/use-screen-orders'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { getDrivers } from '@/app/actions/drivers/drivers-actions'
import { getBranchesAction } from '@/app/actions/inventory/inventory-actions'
import type { OrgDriver } from '@/lib/types/drivers'
import {
  addOrdersToDeliveryRoute,
  assignDeliveryDriver,
  cancelDeliveryRoute,
  createDeliveryRoute,
  getRouteManifest,
  listRoutes,
  removeStopFromDeliveryRoute,
  type RouteListItem,
} from '../api/delivery-route-command-api'
import { DriverPicker } from './driver-picker'

/**
 * Delivery-eligible order fields needed to plan a route without coupling the
 * dispatcher UI to the full order detail read model.
 */
interface DeliveryQueueOrder {
  id: string
  order_no: string
  branch_id?: string | null
  current_status?: string | null
  customer?: { name?: string | null; phone?: string | null }
  delivery_address?: string | null
  address?: string | null
  received_at?: string | null
  ready_by?: string | null
  ready_at?: string | null
  ready_by_override?: string | null
  ready_by_at_new?: string | null
  delivered_at?: string | null
  preparation_status?: string | null
  physical_intake_status?: string | null
  physical_intake_at?: string | null
  physical_intake_by?: string | null
  physical_intake_info?: string | null
}

/** Badge tone for an order's live status in the ready-for-delivery list. */
function orderStatusVariant(status: string | null | undefined): 'success' | 'processing' | 'warning' | 'default' {
  if (status === 'delivered') return 'success'
  if (status === 'in_transit') return 'processing'
  if (status === 'out_for_delivery') return 'warning'
  return 'default'
}

/** Parses a timestamp for the audit dialog; CmxAuditInfoCard formats Date values itself. */
function toAuditDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Badge tone for a route's lifecycle status. */
function routeStatusVariant(status: string): 'success' | 'processing' | 'warning' | 'default' {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'processing'
  if (status === 'planned') return 'warning'
  return 'default'
}

/**
 * Minimal active-stop response used to keep orders already claimed by another
 * route out of the dispatcher selection set.
 */
interface ActiveStopResponse {
  success: boolean
  data?: { stop: { id: string } | null }
}

/**
 * Dispatcher workspace for building routes from the live delivery queue.
 * The server remains the final authority for stop ownership and branch safety;
 * this screen pre-filters active stops to prevent avoidable dispatcher mistakes.
 */
export function DeliveryRoutePlanningScreen() {
  const t = useTranslations('workflow.delivery')
  const tCommon = useTranslations('common')
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  // Scopes workspace data to the authenticated tenant and prevents cross-tenant route planning.
  const { currentTenant } = useAuth()
  const queryClient = useQueryClient()
  const canManageRoutes = useHasPermissionCode('delivery:routes')
  const canAssignDrivers = useHasPermissionCode('delivery:assign')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set())
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>()
  const [plannedStartedAt, setPlannedStartedAt] = useState('')
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState('')
  const [plannedDistanceKm, setPlannedDistanceKm] = useState('')
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null)
  const [addTargetRouteId, setAddTargetRouteId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ routeId: string; stopId: string } | null>(null)
  const [cancelTargetRouteId, setCancelTargetRouteId] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  const ordersQuery = useScreenOrders<DeliveryQueueOrder>(WORKFLOW_SCREENS.DRIVER_DELIVERY, {
    page: 1,
    limit: 50,
    // Prevent query before tenant is confirmed — avoids an unauthenticated delivery-queue request.
    enabled: !!currentTenant,
    fallbackStatuses: ['out_for_delivery'],
  })

  const driversQuery = useQuery({
    queryKey: ['drivers', currentTenant?.tenant_id],
    // Prevent query before tenant is confirmed — driver choices must match the dispatcher tenant.
    enabled: !!currentTenant,
    queryFn: async (): Promise<OrgDriver[]> => {
      const result = await getDrivers()
      if (!result.success) throw new Error('DRIVERS_LOAD_FAILED')
      return result.data ?? []
    },
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', currentTenant?.tenant_id],
    enabled: !!currentTenant,
    queryFn: async (): Promise<Array<{ id: string; branch_name: string }>> => {
      const result = await getBranchesAction()
      return (result.data ?? []) as Array<{ id: string; branch_name: string }>
    },
  })

  const routesQuery = useQuery({
    queryKey: ['delivery-routes', currentTenant?.tenant_id, 'all'],
    // Prevent query before tenant is confirmed — route history is tenant-owned operational data.
    enabled: !!currentTenant,
    // No status filter: dispatchers need to see every route (planned, in_progress,
    // completed, cancelled) — the grid's own Status column and sort make the
    // active ones easy to find without hiding the rest.
    queryFn: () => listRoutes({ limit: 100 }),
  })

  const activeStopsQuery = useQuery({
    queryKey: ['delivery-route-active-stops', currentTenant?.tenant_id, ordersQuery.orders.map((order) => order.id).join(',')],
    // Avoid requesting ownership checks until both the tenant and a concrete queue are available.
    enabled: !!currentTenant && ordersQuery.orders.length > 0,
    queryFn: async (): Promise<Set<string>> => {
      const results = await Promise.all(ordersQuery.orders.map(async (order) => {
        const response = await fetch(`/api/v1/delivery/orders/${order.id}/active-stop`, { credentials: 'include' })
        const payload = await response.json().catch(() => null) as ActiveStopResponse | null
        if (!response.ok || !payload?.success) throw new Error('ACTIVE_STOP_LOAD_FAILED')
        return payload.data?.stop ? order.id : null
      }))
      return new Set(results.filter((id): id is string => Boolean(id)))
    },
  })

  const manifestQuery = useQuery({
    queryKey: ['delivery-route-manifest', expandedRouteId],
    enabled: !!expandedRouteId,
    queryFn: () => getRouteManifest(expandedRouteId!),
  })

  const readyOrders = useMemo(
    () => ordersQuery.orders.filter((order) =>
      // The driver_delivery/delivery floor screen also carries in_transit and
      // delivered orders (it's a lifecycle worklist, not a "ready to route"
      // filter) — a delivered order has no *active* stop either, so it must be
      // excluded explicitly or it slips through as if it were unbooked.
      (order.current_status ?? '').trim().toLowerCase() === 'out_for_delivery'
      && !activeStopsQuery.data?.has(order.id),
    ),
    [activeStopsQuery.data, ordersQuery.orders],
  )
  const selectedOrders = useMemo(
    () => readyOrders.filter((order) => selectedOrderIds.has(order.id)),
    [readyOrders, selectedOrderIds],
  )
  const routes = routesQuery.data?.routes ?? []

  const refreshWorkspace = async () => {
    setSelectedOrderIds(new Set())
    setAddTargetRouteId(null)
    await Promise.all([
      ordersQuery.refetch(),
      activeStopsQuery.refetch(),
      routesQuery.refetch(),
      driversQuery.refetch(),
      branchesQuery.refetch(),
    ])
    if (expandedRouteId) await queryClient.invalidateQueries({ queryKey: ['delivery-route-manifest', expandedRouteId] })
  }

  const toggleOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((previous) => {
      const next = new Set(previous)
      if (checked) next.add(orderId)
      else next.delete(orderId)
      return next
    })
  }

  const runCommand = async (operation: () => Promise<void>) => {
    try {
      setIsMutating(true)
      await operation()
      await refreshWorkspace()
    } catch {
      cmxMessage.error(t('routes.messages.operationFailed'))
    } finally {
      setIsMutating(false)
    }
  }

  const createRoute = () => void runCommand(async () => {
    if (!selectedOrders.length) {
      cmxMessage.warning(t('routes.messages.selectionRequired'))
      return
    }
    const result = await createDeliveryRoute({
      orderIds: selectedOrders.map((order) => order.id),
      driverId: selectedDriverId,
      startedAt: plannedStartedAt || undefined,
      estimatedDurationMinutes: plannedDurationMinutes ? Number(plannedDurationMinutes) : undefined,
      totalDistanceKm: plannedDistanceKm ? Number(plannedDistanceKm) : undefined,
    })
    setPlannedStartedAt('')
    setPlannedDurationMinutes('')
    setPlannedDistanceKm('')
    cmxMessage.success(t('routes.messages.created', { routeId: result.routeNumber }))
  })

  const addOrders = () => void runCommand(async () => {
    if (!addTargetRouteId || !selectedOrders.length) {
      cmxMessage.warning(t('routes.messages.selectionRequired'))
      return
    }
    await addOrdersToDeliveryRoute(addTargetRouteId, selectedOrders.map((order) => order.id))
    cmxMessage.success(t('routes.messages.ordersAdded'))
  })

  const assignDriver = (routeId: string, driverId: string | undefined) => void runCommand(async () => {
    if (!driverId) {
      cmxMessage.warning(t('routes.messages.driverRequired'))
      return
    }
    const result = await assignDeliveryDriver(routeId, driverId)
    cmxMessage.success(t('routes.messages.driverAssigned'))
    if (result.driverWarning) cmxMessage.warning(t('routes.messages.driverWarning'))
  })

  const removeStop = async () => {
    if (!removeTarget) return
    await runCommand(async () => {
      await removeStopFromDeliveryRoute(removeTarget.routeId, removeTarget.stopId)
      cmxMessage.success(t('routes.messages.stopRemoved'))
    })
    setRemoveTarget(null)
  }

  const cancelRoute = async () => {
    if (!cancelTargetRouteId) return
    await runCommand(async () => {
      await cancelDeliveryRoute(cancelTargetRouteId)
      cmxMessage.success(t('routes.messages.routeCancelled'))
    })
    setCancelTargetRouteId(null)
  }

  const readyOrderAuditExtras = (order: DeliveryQueueOrder): AuditExtraRow[] => [
    { key: 'receivedAt', label: t('routes.auditExtras.receivedAt'), value: toAuditDate(order.received_at), hideWhenEmpty: true },
    { key: 'readyBy', label: t('routes.auditExtras.readyBy'), value: toAuditDate(order.ready_by), hideWhenEmpty: true },
    { key: 'readyAt', label: t('routes.auditExtras.readyAt'), value: toAuditDate(order.ready_at), hideWhenEmpty: true },
    { key: 'readyByOverride', label: t('routes.auditExtras.readyByOverride'), value: toAuditDate(order.ready_by_override), hideWhenEmpty: true },
    { key: 'readyByAtNew', label: t('routes.auditExtras.readyByAtNew'), value: toAuditDate(order.ready_by_at_new), hideWhenEmpty: true },
    { key: 'deliveredAt', label: t('routes.auditExtras.deliveredAt'), value: toAuditDate(order.delivered_at), hideWhenEmpty: true },
    { key: 'preparationStatus', label: t('routes.auditExtras.preparationStatus'), value: order.preparation_status, hideWhenEmpty: true },
    { key: 'physicalIntakeStatus', label: t('routes.auditExtras.physicalIntakeStatus'), value: order.physical_intake_status, hideWhenEmpty: true },
    { key: 'physicalIntakeAt', label: t('routes.auditExtras.physicalIntakeAt'), value: toAuditDate(order.physical_intake_at), hideWhenEmpty: true },
    { key: 'physicalIntakeBy', label: t('routes.auditExtras.physicalIntakeBy'), value: order.physical_intake_by, hideWhenEmpty: true },
    { key: 'physicalIntakeInfo', label: t('routes.auditExtras.physicalIntakeInfo'), value: order.physical_intake_info, hideWhenEmpty: true },
  ]

  const driverNameById = useMemo(
    () => new Map((driversQuery.data ?? []).map((driver) => [driver.id, driver.name])),
    [driversQuery.data],
  )
  const branchNameById = useMemo(
    () => new Map((branchesQuery.data ?? []).map((branch) => [branch.id, branch.branch_name])),
    [branchesQuery.data],
  )

  const routeColumns = useMemo<ColumnDef<RouteListItem, unknown>[]>(() => [
    {
      accessorKey: 'routeNumber',
      header: t('routes.fields.routeNumber'),
      cell: ({ row }) => <span className="font-medium">{row.original.routeNumber}</span>,
    },
    {
      accessorKey: 'statusCode',
      header: t('routes.fields.status'),
      cell: ({ row }) => (
        <CmxStatusBadge
          label={t(`routeStatus.${row.original.statusCode}`, { default: row.original.statusCode })}
          variant={routeStatusVariant(row.original.statusCode)}
          size="sm"
        />
      ),
    },
    {
      id: 'driver',
      accessorFn: (route) => (route.driverId ? driverNameById.get(route.driverId) ?? route.driverId : ''),
      header: t('routes.fields.driverId'),
      cell: ({ row }) => row.original.driverId
        ? (driverNameById.get(row.original.driverId) ?? row.original.driverId)
        : <span className="text-muted-foreground">{t('routes.fields.unassigned')}</span>,
    },
    {
      id: 'branch',
      accessorFn: (route) => (route.branchId ? branchNameById.get(route.branchId) ?? route.branchId : ''),
      header: t('routes.fields.branch'),
      cell: ({ row }) => row.original.branchId
        ? (branchNameById.get(row.original.branchId) ?? row.original.branchId)
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'stops',
      accessorFn: (route) => route.totalStops,
      header: t('routes.fields.stops'),
      enableSorting: false,
      cell: ({ row }) => `${row.original.completedStops}/${row.original.totalStops}`,
    },
    {
      accessorKey: 'startedAt',
      header: t('routes.fields.startedAt'),
      cell: ({ row }) => row.original.startedAt ? formatDateTime(row.original.startedAt, locale) : '—',
    },
    {
      accessorKey: 'createdAt',
      header: t('routes.fields.created'),
      cell: ({ row }) => row.original.createdAt ? formatDateTime(row.original.createdAt, locale) : '—',
    },
    {
      accessorKey: 'completedAt',
      header: t('routes.fields.completedAt'),
      cell: ({ row }) => row.original.completedAt ? formatDateTime(row.original.completedAt, locale) : '—',
    },
    {
      accessorKey: 'estimatedDurationMinutes',
      header: t('routes.fields.estimatedDurationMinutes'),
      cell: ({ row }) => row.original.estimatedDurationMinutes != null ? t('routes.fields.minutesValue', { count: row.original.estimatedDurationMinutes }) : '—',
    },
    {
      accessorKey: 'totalDistanceKm',
      header: t('routes.fields.totalDistanceKm'),
      cell: ({ row }) => row.original.totalDistanceKm != null ? t('routes.fields.kmValue', { count: row.original.totalDistanceKm }) : '—',
    },
    {
      accessorKey: 'notes',
      header: t('routes.fields.notes'),
      cell: ({ row }) => row.original.notes || <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <RouteActionsCell
          route={row.original}
          drivers={driversQuery.data ?? []}
          expanded={expandedRouteId === row.original.id}
          addTarget={addTargetRouteId === row.original.id}
          isMutating={isMutating}
          canManageRoutes={canManageRoutes}
          canAssignDrivers={canAssignDrivers}
          t={t}
          onToggleManifest={() => setExpandedRouteId(expandedRouteId === row.original.id ? null : row.original.id)}
          onAddTarget={() => setAddTargetRouteId(addTargetRouteId === row.original.id ? null : row.original.id)}
          onAssignDriver={assignDriver}
          onCancel={() => setCancelTargetRouteId(row.original.id)}
        />
      ),
    },
  ], [addTargetRouteId, assignDriver, branchNameById, canAssignDrivers, canManageRoutes, driverNameById, driversQuery.data, expandedRouteId, isMutating, locale, t])

  const allReadySelected = readyOrders.length > 0 && readyOrders.every((order) => selectedOrderIds.has(order.id))
  const readyColumns = [
    {
      key: 'select',
      header: <CmxCheckbox aria-label={t('routes.selectAll')} checked={allReadySelected} onChange={(event) => {
        setSelectedOrderIds(event.target.checked ? new Set(readyOrders.map((order) => order.id)) : new Set())
      }} />,
      sortable: false,
      render: (order: DeliveryQueueOrder) => <CmxCheckbox aria-label={t('routes.selectOrder')} checked={selectedOrderIds.has(order.id)} onChange={(event) => toggleOrder(order.id, event.target.checked)} />,
    },
    { key: 'orderNo', header: t('routes.fields.orderNumber'), render: (order: DeliveryQueueOrder) => <span className="font-medium">{order.order_no}</span> },
    { key: 'customer', header: t('routes.fields.customer'), render: (order: DeliveryQueueOrder) => order.customer?.name ?? t('fallbacks.unknownCustomer') },
    { key: 'address', header: t('routes.fields.address'), render: (order: DeliveryQueueOrder) => order.delivery_address ?? order.address ?? t('routes.fields.addressUnavailable') },
    {
      key: 'status',
      header: t('routes.fields.status'),
      render: (order: DeliveryQueueOrder) => (
        <CmxStatusBadge
          label={t(`routes.orderStatus.${order.current_status}`, { default: order.current_status ?? '' })}
          variant={orderStatusVariant(order.current_status)}
          size="sm"
        />
      ),
    },
    {
      key: 'view',
      header: '',
      sortable: false,
      render: (order: DeliveryQueueOrder) => (
        <Link href={`/dashboard/orders/${order.id}`} className="text-primary hover:underline">
          {tCommon('view')}
        </Link>
      ),
    },
  ]

  if (ordersQuery.isLoading || driversQuery.isLoading) {
    return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6"><CmxSkeletonTable rows={6} columns={4} showHeader /></div>
  }

  if (ordersQuery.error || driversQuery.error || activeStopsQuery.error || routesQuery.error) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <CmxSummaryMessage type="error" title={tCommon('error')} items={[t('routes.messages.loadFailed')]} />
        <CmxButton variant="outline" onClick={() => void refreshWorkspace()}>{t('routes.actions.refresh')}</CmxButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><Route className="h-7 w-7" aria-hidden="true" /><h1 className="text-2xl font-bold">{t('routes.workspaceTitle')}</h1></div>
          <p className="text-sm text-muted-foreground">{t('routes.createHint')}</p>
        </div>
        <CmxButton variant="outline" onClick={() => void refreshWorkspace()} disabled={isMutating}>{t('routes.actions.refresh')}</CmxButton>
      </header>

      <CmxCard>
        <CmxCardHeader><CmxCardTitle>{t('routes.createTitle')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2"><p className="text-sm font-medium">{t('routes.driverLabel')}</p><DriverPicker drivers={driversQuery.data ?? []} value={selectedDriverId} onChange={setSelectedDriverId} disabled={isMutating || !canManageRoutes} /></div>
            {canManageRoutes ? <CmxButton onClick={createRoute} loading={isMutating} disabled={!selectedOrders.length}>{t('routes.actions.create')}</CmxButton> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="route-started-at">{t('routes.fields.startedAt')}</label>
              <CmxInput id="route-started-at" type="datetime-local" value={plannedStartedAt} onChange={(e) => setPlannedStartedAt(e.target.value)} disabled={isMutating || !canManageRoutes} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="route-duration">{t('routes.fields.estimatedDurationMinutes')}</label>
              <CmxInput id="route-duration" type="number" min={1} max={1440} value={plannedDurationMinutes} onChange={(e) => setPlannedDurationMinutes(e.target.value)} disabled={isMutating || !canManageRoutes} placeholder={t('routes.fields.minutesPlaceholder')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="route-distance">{t('routes.fields.totalDistanceKm')}</label>
              <CmxInput id="route-distance" type="number" min={0.1} step={0.1} max={5000} value={plannedDistanceKm} onChange={(e) => setPlannedDistanceKm(e.target.value)} disabled={isMutating || !canManageRoutes} placeholder={t('routes.fields.kmPlaceholder')} />
            </div>
          </div>
          <div className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-3 text-sm"><span className="font-medium">{t('routes.selectedCount', { count: selectedOrders.length })}</span>{selectedOrders.length > 0 ? <span className="ms-2 text-muted-foreground">{t('routes.preview', { orders: selectedOrders.map((order) => order.order_no).join(', ') })}</span> : null}</div>
        </CmxCardContent>
      </CmxCard>

      <section className="space-y-3" aria-labelledby="ready-orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="ready-orders-heading" className="text-lg font-semibold">{t('routes.readyOrders.title')}</h2><span className="text-sm text-muted-foreground">{t('routes.readyCount', { count: readyOrders.length })}</span></div>
        <CmxDataTable
          columns={readyColumns}
          data={readyOrders}
          loading={activeStopsQuery.isLoading}
          emptyStateTitle={t('routes.readyOrders.empty')}
          emptyStateDescription={t('routes.readyOrders.emptyDescription')}
          paginationFooter="never"
          auditConfig={{ getExtras: readyOrderAuditExtras }}
        />
      </section>

      <section className="space-y-3" aria-labelledby="planned-routes-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="planned-routes-heading" className="text-lg font-semibold">{t('routes.listTitle')}</h2>{canManageRoutes && addTargetRouteId ? <CmxButton onClick={addOrders} loading={isMutating} disabled={!selectedOrders.length}>{t('routes.actions.addSelected')}</CmxButton> : null}</div>
        {routes.length === 0 && !routesQuery.isLoading ? (
          <CmxEmptyState icon={<Truck className="h-8 w-8" />} title={t('routes.empty')} description={t('routes.emptyDescription')} />
        ) : (
          <CmxDataGrid
            columns={routeColumns}
            data={routes}
            isLoading={routesQuery.isLoading}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            enableGlobalSearch
            enableColumnBorders
            initialPageSize={10}
            auditConfig={true}
          />
        )}
        {expandedRouteId ? (
          <CmxCard>
            <CmxCardHeader><CmxCardTitle>{t('routes.stopsFor', { routeNumber: routes.find((r) => r.id === expandedRouteId)?.routeNumber ?? '' })}</CmxCardTitle></CmxCardHeader>
            <CmxCardContent>
              {manifestQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">{t('routes.loadingStops')}</div>
              ) : (
                <div className="space-y-2">
                  {manifestQuery.data?.stops.map((stop) => (
                    <div key={stop.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] pb-2 text-sm last:border-b-0">
                      <div className="min-w-0"><span className="font-medium">{stop.order.orderNo}</span><span className="ms-2 text-muted-foreground">{stop.address}</span></div>
                      {canManageRoutes && routes.find((r) => r.id === expandedRouteId)?.statusCode === 'planned' ? (
                        <CmxButton variant="ghost" size="sm" onClick={() => setRemoveTarget({ routeId: expandedRouteId, stopId: stop.id })} disabled={isMutating}>{t('routes.actions.removeStop')}</CmxButton>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CmxCardContent>
          </CmxCard>
        ) : null}
      </section>

      <CmxConfirmDialog open={!!removeTarget} onCancel={() => setRemoveTarget(null)} title={t('routes.removeStopConfirm.title')} description={t('routes.removeStopConfirm.description')} confirmLabel={t('routes.actions.removeStop')} cancelLabel={tCommon('cancel')} onConfirm={removeStop} />
      <CmxConfirmDialog open={!!cancelTargetRouteId} onCancel={() => setCancelTargetRouteId(null)} title={t('routes.cancelRouteConfirm.title')} description={t('routes.cancelRouteConfirm.description')} confirmLabel={t('routes.actions.cancelRoute')} cancelLabel={tCommon('cancel')} onConfirm={cancelRoute} />
    </div>
  )
}

/**
 * Actions-cell inputs and callbacks owned by the planning workspace so all
 * mutations continue through its single refresh and error-handling boundary.
 */
interface RouteActionsCellProps {
  route: RouteListItem
  drivers: OrgDriver[]
  expanded: boolean
  addTarget: boolean
  isMutating: boolean
  canManageRoutes: boolean
  canAssignDrivers: boolean
  t: ReturnType<typeof useTranslations>
  onToggleManifest: () => void
  onAddTarget: () => void
  onAssignDriver: (routeId: string, driverId: string | undefined) => void
  onCancel: () => void
}

/** Compact per-row controls so dispatchers can amend a route without leaving the grid. */
function RouteActionsCell({ route, drivers, expanded, addTarget, isMutating, canManageRoutes, canAssignDrivers, t, onToggleManifest, onAddTarget, onAssignDriver, onCancel }: RouteActionsCellProps) {
  const [driverId, setDriverId] = useState<string | undefined>(route.driverId ?? undefined)
  // Add-orders is only valid on a route that hasn't started yet; the server
  // rejects it otherwise (ROUTE_NOT_PLANNED) — the UI mirrors that here.
  const isPlanned = route.statusCode === 'planned'
  const isCancellable = route.statusCode === 'planned' || route.statusCode === 'in_progress'
  return (
    <div className="flex min-w-[16rem] flex-col gap-2">
      {canAssignDrivers ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><DriverPicker drivers={drivers} value={driverId} onChange={setDriverId} disabled={isMutating} /></div>
          <CmxButton variant="outline" size="sm" onClick={() => onAssignDriver(route.id, driverId)} disabled={isMutating || !driverId}>{t('routes.actions.assignDriver')}</CmxButton>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <CmxButton variant="outline" size="sm" onClick={onToggleManifest}>{expanded ? t('routes.actions.hideStops') : t('routes.actions.showStops')}</CmxButton>
        {canManageRoutes && isPlanned ? <CmxButton variant={addTarget ? 'secondary' : 'outline'} size="sm" onClick={onAddTarget}>{addTarget ? t('routes.actions.stopAdding') : t('routes.actions.addSelected')}</CmxButton> : null}
        {canManageRoutes && isCancellable ? <CmxButton variant="destructive" size="sm" onClick={onCancel} disabled={isMutating}>{t('routes.actions.cancelRoute')}</CmxButton> : null}
      </div>
    </div>
  )
}
