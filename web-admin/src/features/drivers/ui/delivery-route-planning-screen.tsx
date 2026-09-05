'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { MapPin, Route, Truck } from 'lucide-react'
import { CmxDataTable, CmxEmptyState } from '@ui/data-display'
import { CmxConfirmDialog, CmxStatusBadge, CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import { CmxButton, CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxCheckbox, CmxSkeletonTable } from '@ui/primitives'
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens'
import { useAuth } from '@/lib/auth/auth-context'
import { useScreenOrders } from '@/lib/hooks/use-screen-orders'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { getDrivers } from '@/app/actions/drivers/drivers-actions'
import type { OrgDriver } from '@/lib/types/drivers'
import type { DeliveryRouteManifest } from '@/lib/services/delivery/delivery-route-query.service'
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
}

/** Badge tone for an order's live status in the ready-for-delivery list. */
function orderStatusVariant(status: string | null | undefined): 'success' | 'processing' | 'warning' | 'default' {
  if (status === 'delivered') return 'success'
  if (status === 'in_transit') return 'processing'
  if (status === 'out_for_delivery') return 'warning'
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
  // Scopes workspace data to the authenticated tenant and prevents cross-tenant route planning.
  const { currentTenant } = useAuth()
  const queryClient = useQueryClient()
  const canManageRoutes = useHasPermissionCode('delivery:routes')
  const canAssignDrivers = useHasPermissionCode('delivery:assign')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set())
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>()
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

  const routesQuery = useQuery({
    queryKey: ['delivery-routes', currentTenant?.tenant_id, 'planned'],
    // Prevent query before tenant is confirmed — planned routes are tenant-owned operational data.
    enabled: !!currentTenant,
    queryFn: () => listRoutes('planned'),
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
    const result = await createDeliveryRoute({ orderIds: selectedOrders.map((order) => order.id), driverId: selectedDriverId })
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
          <div className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-3 text-sm"><span className="font-medium">{t('routes.selectedCount', { count: selectedOrders.length })}</span>{selectedOrders.length > 0 ? <span className="ms-2 text-muted-foreground">{t('routes.preview', { orders: selectedOrders.map((order) => order.order_no).join(', ') })}</span> : null}</div>
        </CmxCardContent>
      </CmxCard>

      <section className="space-y-3" aria-labelledby="ready-orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="ready-orders-heading" className="text-lg font-semibold">{t('routes.readyOrders.title')}</h2><span className="text-sm text-muted-foreground">{t('routes.readyCount', { count: readyOrders.length })}</span></div>
        <CmxDataTable columns={readyColumns} data={readyOrders} loading={activeStopsQuery.isLoading} emptyStateTitle={t('routes.readyOrders.empty')} emptyStateDescription={t('routes.readyOrders.emptyDescription')} paginationFooter="never" />
      </section>

      <section className="space-y-3" aria-labelledby="planned-routes-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="planned-routes-heading" className="text-lg font-semibold">{t('routes.listTitle')}</h2>{canManageRoutes && addTargetRouteId ? <CmxButton onClick={addOrders} loading={isMutating} disabled={!selectedOrders.length}>{t('routes.actions.addSelected')}</CmxButton> : null}</div>
        {routes.length === 0 ? <CmxEmptyState icon={<Truck className="h-8 w-8" />} title={t('routes.empty')} description={t('routes.emptyDescription')} /> : <div className="grid gap-4 lg:grid-cols-2">{routes.map((route) => <RouteCard key={route.id} route={route} drivers={driversQuery.data ?? []} expanded={expandedRouteId === route.id} manifest={expandedRouteId === route.id ? manifestQuery.data : undefined} manifestLoading={expandedRouteId === route.id && manifestQuery.isLoading} addTarget={addTargetRouteId === route.id} isMutating={isMutating} canManageRoutes={canManageRoutes} canAssignDrivers={canAssignDrivers} t={t} onToggleManifest={() => setExpandedRouteId(expandedRouteId === route.id ? null : route.id)} onAddTarget={() => setAddTargetRouteId(addTargetRouteId === route.id ? null : route.id)} onAssignDriver={assignDriver} onRemoveStop={(stopId) => setRemoveTarget({ routeId: route.id, stopId })} onCancel={() => setCancelTargetRouteId(route.id)} />)}</div>}
      </section>

      <CmxConfirmDialog open={!!removeTarget} onCancel={() => setRemoveTarget(null)} title={t('routes.removeStopConfirm.title')} description={t('routes.removeStopConfirm.description')} confirmLabel={t('routes.actions.removeStop')} cancelLabel={tCommon('cancel')} onConfirm={removeStop} />
      <CmxConfirmDialog open={!!cancelTargetRouteId} onCancel={() => setCancelTargetRouteId(null)} title={t('routes.cancelRouteConfirm.title')} description={t('routes.cancelRouteConfirm.description')} confirmLabel={t('routes.actions.cancelRoute')} cancelLabel={tCommon('cancel')} onConfirm={cancelRoute} />
    </div>
  )
}

/**
 * Route-card inputs and callbacks owned by the planning workspace so all
 * mutations continue through its single refresh and error-handling boundary.
 */
interface RouteCardProps {
  route: RouteListItem
  drivers: OrgDriver[]
  expanded: boolean
  manifest?: DeliveryRouteManifest
  manifestLoading: boolean
  addTarget: boolean
  isMutating: boolean
  canManageRoutes: boolean
  canAssignDrivers: boolean
  t: ReturnType<typeof useTranslations>
  onToggleManifest: () => void
  onAddTarget: () => void
  onAssignDriver: (routeId: string, driverId: string | undefined) => void
  onRemoveStop: (stopId: string) => void
  onCancel: () => void
}

/** Compact operational card so dispatchers can inspect and amend a planned route without leaving the queue. */
function RouteCard({ route, drivers, expanded, manifest, manifestLoading, addTarget, isMutating, canManageRoutes, canAssignDrivers, t, onToggleManifest, onAddTarget, onAssignDriver, onRemoveStop, onCancel }: RouteCardProps) {
  const [driverId, setDriverId] = useState<string | undefined>(route.driverId ?? undefined)
  return <CmxCard><CmxCardHeader><div className="flex items-start justify-between gap-3"><div><CmxCardTitle>{route.routeNumber}</CmxCardTitle><p className="mt-1 text-sm text-muted-foreground">{t('routes.fields.stops')}: {route.completedStops}/{route.totalStops}</p></div><CmxStatusBadge label={t(`routeStatus.${route.statusCode}`, { default: route.statusCode })} variant="warning" size="sm" /></div></CmxCardHeader><CmxCardContent className="space-y-4">{canAssignDrivers ? <div className="space-y-2"><p className="text-sm font-medium">{t('routes.fields.driverId')}</p><div className="flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><DriverPicker drivers={drivers} value={driverId} onChange={setDriverId} disabled={isMutating} /></div><CmxButton variant="outline" onClick={() => onAssignDriver(route.id, driverId)} disabled={isMutating || !driverId}>{t('routes.actions.assignDriver')}</CmxButton></div></div> : null}<div className="flex flex-wrap gap-2"><CmxButton variant="outline" size="sm" onClick={onToggleManifest}>{expanded ? t('routes.actions.hideStops') : t('routes.actions.showStops')}</CmxButton>{canManageRoutes ? <><CmxButton variant={addTarget ? 'secondary' : 'outline'} size="sm" onClick={onAddTarget}>{addTarget ? t('routes.actions.stopAdding') : t('routes.actions.addSelected')}</CmxButton><CmxButton variant="destructive" size="sm" onClick={onCancel} disabled={isMutating}>{t('routes.actions.cancelRoute')}</CmxButton></> : null}</div>{manifestLoading ? <div className="text-sm text-muted-foreground">{t('routes.loadingStops')}</div> : expanded && manifest ? <div className="space-y-2 border-t pt-3">{manifest.stops.map((stop) => <div key={stop.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div className="min-w-0"><span className="font-medium">{stop.order.orderNo}</span><span className="ms-2 text-muted-foreground">{stop.address}</span></div>{canManageRoutes ? <CmxButton variant="ghost" size="sm" onClick={() => onRemoveStop(stop.id)} disabled={isMutating}>{t('routes.actions.removeStop')}</CmxButton> : null}</div>)}</div> : null}</CmxCardContent></CmxCard>
}
