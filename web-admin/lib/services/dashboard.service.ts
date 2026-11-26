/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * Dashboard Service
 *
 * Handles fetching dashboard KPI data with caching and performance monitoring
 */

import { createClient } from '@/lib/supabase/client'
import { tenantSettingsService } from '@/lib/services/tenant-settings.service'
import { civilDateInZone, civilDayBounds, shiftCivilDate } from '@/lib/utils/operational-time'

const CLOSED_INSTANT = '9999-01-01T00:00:00.000Z'

function shopWindow(zone: string | null | undefined, now = new Date()) {
  const todayCivil = civilDateInZone(now, zone)
  if (!zone || !todayCivil) return null
  return {
    todayStart: civilDayBounds(todayCivil, zone).start,
    todayEnd: civilDayBounds(todayCivil, zone).end,
    monthStart: civilDayBounds(`${todayCivil.slice(0, 7)}-01`, zone).start,
    last30Start: civilDayBounds(shiftCivilDate(todayCivil, -30), zone).start,
    sevenStart: civilDayBounds(shiftCivilDate(todayCivil, -7), zone).start,
    fourteenStart: civilDayBounds(shiftCivilDate(todayCivil, -14), zone).start,
  }
}

// ========================
// Type Definitions
// ========================

export interface KPIOverview {
  orders: {
    today: number
    inProcess: number
    ready: number
    outForDelivery: number
    deltaToday?: number // Percentage change from yesterday
  }
  revenue: {
    today: number
    mtd: number // Month-to-date
    last30d: number
    currency: string
    deltaToday?: number
  }
  sla: {
    avgTATHours: number // Average turnaround time
    onTimePct: number // On-time delivery percentage
    /** Week-over-week % change in avg TAT (negative is improvement). */
    trendPct: number
  }
  issues: {
    open: number
    last7d: number
    critical: number
    resolved: number
  }
  payments: {
    cashPct: number
    onlinePct: number
    cardPct: number
    otherPct: number
  }
  drivers: {
    activePct: number
    totalDrivers: number
    activeDrivers: number
    avgDeliveriesPerDriver: number
  }
  delivery: {
    successRate: number
    totalDeliveries: number
    pendingDeliveries: number
    failedDeliveries: number
  }
  /** Dashboard alerts (i18n keys under `dashboard`). */
  alerts: DashboardAlertItem[]
  topServices: Array<{
    name: string
    amount: number
  }>
}

/** Serialized alert row for KPI payload (client maps `messageAt` to Date). */
export interface DashboardAlertItem {
  id: string
  type: 'critical' | 'warning' | 'info'
  category: 'order' | 'payment' | 'system' | 'delivery'
  titleKey: string
  messageKey: string
  messageValues?: Record<string, string | number>
  messageAt: string
  actionUrl?: string
}

export interface OrdersTrendData {
  date: string
  count: number
}

export interface RevenueTrendData {
  date: string
  amount: number
}

// ========================
// Cache Implementation
// ========================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class DashboardCache {
  private cache = new Map<string, CacheEntry<any>>()
  private ttl = 60 * 1000 // 60 seconds default TTL

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || this.ttl),
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.timestamp) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
}

const cache = new DashboardCache()

function paymentMethodBucket(raw: string | null | undefined): 'cash' | 'online' | 'card' | 'other' {
  const m = (raw || '').toUpperCase()
  if (!m) return 'other'
  if (m.includes('CASH')) return 'cash'
  if (m.includes('CARD') || m.includes('CREDIT') || m.includes('DEBIT')) return 'card'
  if (
    m.includes('ONLINE') ||
    m.includes('WIRE') ||
    m.includes('TRANSFER') ||
    m.includes('LINK')
  ) {
    return 'online'
  }
  return 'other'
}

// ========================
// Dashboard Service
// ========================

export class DashboardService {
  private supabase = createClient()

  /**
   * Get KPI overview data
   * @param tenantId - Tenant organization ID
   * @param options - Optional branch and date range filters
   */
  async getKPIOverview(
    tenantId: string,
    options?: {
      branchId?: string
      from?: Date
      to?: Date
      timeZone?: string | null
    }
  ): Promise<KPIOverview> {
    const cacheKey = `kpi-overview-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<KPIOverview>(cacheKey)
    if (cached) return cached

    try {
      const branchId = options?.branchId
      const window = shopWindow(options?.timeZone)
      const todayStart = window?.todayStart.toISOString() ?? CLOSED_INSTANT
      const todayEnd = window?.todayEnd.toISOString() ?? CLOSED_INSTANT
      const monthStart = window?.monthStart.toISOString() ?? CLOSED_INSTANT
      const last30StartStr = window?.last30Start.toISOString() ?? CLOSED_INSTANT
      const sevenDaysAgoStr = window?.sevenStart.toISOString() ?? CLOSED_INSTANT
      const fourteenDaysAgoStr = window?.fourteenStart.toISOString() ?? CLOSED_INSTANT

      let ordersQuery = this.supabase
        .from('org_orders_mst')
        .select('id, status, total:total_amount, created_at')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("CANCELLED","CLOSED")')
      if (branchId) ordersQuery = ordersQuery.eq('branch_id', branchId)

      const { data: orders } = await ordersQuery
      const ordersList = orders || []

      const todayOrders = ordersList.filter((o) => {
        const createdAt = (o as { created_at: string }).created_at
        return createdAt >= todayStart && createdAt < todayEnd
      })
      const mtdOrders = ordersList.filter(
        (o) => (o as { created_at: string }).created_at >= monthStart
      )
      const last30Orders = ordersList.filter(
        (o) => (o as { created_at: string }).created_at >= last30StartStr
      )

      const statusCounts: Record<string, number> = {}
      todayOrders.forEach((o) => {
        const s = (o as { status: string }).status || 'unknown'
        statusCounts[s] = (statusCounts[s] || 0) + 1
      })

      const revenueToday = todayOrders.reduce(
        (sum, o) => sum + Number((o as { total?: number }).total || 0),
        0
      )
      const revenueMtd = mtdOrders.reduce(
        (sum, o) => sum + Number((o as { total?: number }).total || 0),
        0
      )
      const revenue30d = last30Orders.reduce(
        (sum, o) => sum + Number((o as { total?: number }).total || 0),
        0
      )

      const { currencyCode } = await tenantSettingsService.getCurrencyConfig(
        tenantId,
        branchId,
        null
      )

      const buildDeliveredQuery = (select: string, fromIso: string, toIso?: string) => {
        let q = this.supabase
          .from('org_orders_mst')
          .select(select)
          .eq('tenant_org_id', tenantId)
          .not('delivered_at', 'is', null)
          .not('status', 'in', '("CANCELLED")')
          .gte('created_at', fromIso)
        if (toIso) q = q.lt('created_at', toIso)
        if (branchId) q = q.eq('branch_id', branchId)
        return q
      }

      const recentOrderIdsPromise = (async () => {
        let q = this.supabase
          .from('org_orders_mst')
          .select('id')
          .eq('tenant_org_id', tenantId)
          .gte('created_at', last30StartStr)
        if (branchId) q = q.eq('branch_id', branchId)
        const { data, error } = await q
        if (error) return [] as { id: string }[]
        return (data || []) as { id: string }[]
      })()

      const [
        { data: deliveredLast30 },
        { data: deliveredWeekPrev },
        { data: deliveredWeekCurr },
        { data: paymentsLast30 },
        { data: issuesRows },
        { data: routesRows },
        { data: stopsRows },
        { data: overdueOrders },
        recentOrderIds,
      ] = await Promise.all([
        buildDeliveredQuery('created_at, delivered_at, ready_by_at', last30StartStr),
        buildDeliveredQuery(
          'created_at, delivered_at',
          fourteenDaysAgoStr,
          sevenDaysAgoStr
        ),
        buildDeliveredQuery('created_at, delivered_at', sevenDaysAgoStr),
        this.supabase
          .from('org_fin_voucher_trx_lines_dtl')
          .select('payment_method_code, amount')
          .eq('tenant_org_id', tenantId)
          .eq('direction', 'IN')
          .gte('created_at', last30StartStr),
        this.supabase
          .from('org_order_issues')
          .select('priority, created_at, solved_at, rec_status')
          .eq('tenant_org_id', tenantId),
        this.supabase
          .from('org_dlv_routes_mst')
          .select('driver_id, route_status_code, started_at, created_at')
          .eq('tenant_org_id', tenantId)
          .gte('created_at', last30StartStr),
        this.supabase
          .from('org_dlv_stops_dtl')
          .select('stop_status_code, actual_time, created_at')
          .eq('tenant_org_id', tenantId)
          .gte('created_at', last30StartStr),
        branchId
          ? this.supabase
              .from('org_orders_mst')
              .select('id, order_no')
              .eq('tenant_org_id', tenantId)
              .eq('branch_id', branchId)
              .not('status', 'in', '("DELIVERED","CLOSED","CANCELLED")')
              .not('ready_by_at', 'is', null)
              .lt('ready_by_at', new Date().toISOString())
              .limit(25)
          : this.supabase
              .from('org_orders_mst')
              .select('id, order_no')
              .eq('tenant_org_id', tenantId)
              .not('status', 'in', '("DELIVERED","CLOSED","CANCELLED")')
              .not('ready_by_at', 'is', null)
              .lt('ready_by_at', new Date().toISOString())
              .limit(25),
        recentOrderIdsPromise,
      ])

      const deliveredLast30List = (deliveredLast30 || []) as unknown as Array<{
        created_at: string
        delivered_at: string
        ready_by_at: string | null
      }>

      const avgTat = (rows: Array<{ created_at: string; delivered_at: string }>): number => {
        if (!rows.length) return 0
        let sum = 0
        let n = 0
        for (const r of rows) {
          const c = new Date(r.created_at).getTime()
          const d = new Date(r.delivered_at).getTime()
          if (d > c) {
            sum += (d - c) / 3600000
            n++
          }
        }
        return n ? sum / n : 0
      }

      const onTimePct = (rows: typeof deliveredLast30List): number => {
        const eligible = rows.filter((r) => r.ready_by_at && r.delivered_at)
        if (!eligible.length) return 0
        let ok = 0
        for (const r of eligible) {
          if (new Date(r.delivered_at!).getTime() <= new Date(r.ready_by_at!).getTime()) ok++
        }
        return (ok / eligible.length) * 100
      }

      const avgTatLast30 = avgTat(deliveredLast30List)
      const avgTatPrev = avgTat(
        (deliveredWeekPrev || []) as unknown as Array<{ created_at: string; delivered_at: string }>
      )
      const avgTatCurr = avgTat(
        (deliveredWeekCurr || []) as unknown as Array<{ created_at: string; delivered_at: string }>
      )
      let trendPct = 0
      if (avgTatPrev > 0) {
        trendPct = Math.round(((avgTatCurr - avgTatPrev) / avgTatPrev) * 100)
      }

      const payBuckets = { cash: 0, online: 0, card: 0, other: 0 }
      for (const p of paymentsLast30 || []) {
        const row = p as { payment_method_code?: string | null; amount?: number | null }
        const w = Number(row.amount || 0)
        if (w <= 0) continue
        const b = paymentMethodBucket(row.payment_method_code ?? null)
        payBuckets[b] += w
      }
      const paySum =
        payBuckets.cash + payBuckets.online + payBuckets.card + payBuckets.other
      const payTotal = paySum > 0 ? paySum : 1
      const cashPct = (payBuckets.cash / payTotal) * 100
      const onlinePct = (payBuckets.online / payTotal) * 100
      const cardPct = (payBuckets.card / payTotal) * 100
      const otherPct = (payBuckets.other / payTotal) * 100

      const issueList = (issuesRows || []) as Array<{
        priority: string | null
        created_at: string
        solved_at: string | null
        rec_status: number | null
      }>
      const activeIssues = issueList.filter((i) => i.rec_status == null || i.rec_status === 1)
      const openIssues = activeIssues.filter((i) => !i.solved_at)
      const criticalOpen = openIssues.filter((i) =>
        ['high', 'urgent'].includes((i.priority || '').toLowerCase())
      ).length
      const resolvedLast30 = issueList.filter(
        (i) =>
          i.solved_at &&
          i.solved_at >= last30StartStr &&
          (i.rec_status == null || i.rec_status === 1)
      ).length

      const routes = (routesRows || []) as Array<{
        driver_id: string | null
        route_status_code: string | null
        started_at: string | null
        created_at: string
      }>
      const driverSet = new Set<string>()
      const todayStartMs = window?.todayStart.getTime() ?? Number.POSITIVE_INFINITY
      const todayEndMs = window?.todayEnd.getTime() ?? Number.NEGATIVE_INFINITY
      for (const r of routes) {
        if (!r.driver_id) continue
        driverSet.add(r.driver_id)
      }
      const totalDrivers = driverSet.size
      let activeDrivers = 0
      const activeDriverIds = new Set<string>()
      for (const r of routes) {
        if (r.route_status_code === 'in_progress' && r.driver_id) {
          activeDriverIds.add(r.driver_id)
        }
        if (r.started_at && r.driver_id) {
          const st = new Date(r.started_at).getTime()
          if (st >= todayStartMs && st < todayEndMs) {
            activeDriverIds.add(r.driver_id)
          }
        }
      }
      activeDrivers = activeDriverIds.size
      const stops = (stopsRows || []) as Array<{
        stop_status_code: string | null
        actual_time: string | null
        created_at: string
      }>
      const deliveredStops = stops.filter((s) => s.stop_status_code === 'delivered').length
      const failedStops = stops.filter((s) => s.stop_status_code === 'failed').length
      const pendingStops = stops.filter((s) =>
        ['pending', 'in_transit'].includes((s.stop_status_code || '').toLowerCase())
      ).length
      const fin = deliveredStops + failedStops
      const successRate = fin > 0 ? (deliveredStops / fin) * 100 : 0
      const avgDeliveriesPerDriver =
        totalDrivers > 0 ? deliveredStops / totalDrivers : 0
      const activePct = totalDrivers > 0 ? (activeDrivers / totalDrivers) * 100 : 0

      const alerts: DashboardAlertItem[] = []
      const overdueCount = (overdueOrders || []).length
      if (overdueCount > 0) {
        alerts.push({
          id: `overdue-${tenantId}`,
          type: 'warning',
          category: 'order',
          titleKey: 'alertOverdueTitle',
          messageKey: 'alertOverdueMessage',
          messageValues: { count: overdueCount },
          messageAt: new Date().toISOString(),
          actionUrl: '/dashboard/orders',
        })
      }
      if (criticalOpen > 0) {
        alerts.push({
          id: `critical-issues-${tenantId}`,
          type: 'critical',
          category: 'order',
          titleKey: 'alertCriticalIssuesTitle',
          messageKey: 'alertCriticalIssuesMessage',
          messageValues: { count: criticalOpen },
          messageAt: new Date().toISOString(),
          actionUrl: '/dashboard/issues',
        })
      }
      if (failedStops > 0) {
        alerts.push({
          id: `failed-stops-${tenantId}`,
          type: 'warning',
          category: 'delivery',
          titleKey: 'alertFailedStopsTitle',
          messageKey: 'alertFailedStopsMessage',
          messageValues: { count: failedStops },
          messageAt: new Date().toISOString(),
        })
      }

      let topServices: Array<{ name: string; amount: number }> = []
      const orderIdList = (recentOrderIds || []).map((o) => o.id)
      if (orderIdList.length > 0) {
        const chunkSize = 400
        const agg: Record<string, number> = {}
        for (let i = 0; i < orderIdList.length; i += chunkSize) {
          const chunk = orderIdList.slice(i, i + chunkSize)
          const { data: lines } = await this.supabase
            .from('org_order_items_dtl')
            .select('service_category_code, total_price, net_amount')
            .eq('tenant_org_id', tenantId)
            .in('order_id', chunk)
          for (const line of lines || []) {
            const l = line as { service_category_code?: string | null; total_price?: number | null; net_amount?: number | null }
            const key = (l.service_category_code || 'unknown').trim() || 'unknown'
            // Revenue is after line discounts; an older line has only its gross.
            agg[key] = (agg[key] || 0) + Number(l.net_amount ?? l.total_price ?? 0)
          }
        }
        topServices = Object.entries(agg)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
      }

      const data: KPIOverview = {
        orders: {
          today: todayOrders.length,
          inProcess:
            (statusCounts['INTAKE'] || 0) +
            (statusCounts['PREPARATION'] || 0) +
            (statusCounts['PROCESSING'] || 0),
          ready: statusCounts['READY'] || 0,
          outForDelivery: statusCounts['OUT_FOR_DELIVERY'] || 0,
          deltaToday: 0,
        },
        revenue: {
          today: revenueToday,
          mtd: revenueMtd,
          last30d: revenue30d,
          currency: currencyCode,
          deltaToday: 0,
        },
        sla: {
          avgTATHours: avgTatLast30,
          onTimePct: onTimePct(deliveredLast30List),
          trendPct,
        },
        issues: {
          open: openIssues.length,
          last7d: issueList.filter(
            (i) =>
              (i.rec_status == null || i.rec_status === 1) &&
              i.created_at >= sevenDaysAgoStr
          ).length,
          critical: criticalOpen,
          resolved: resolvedLast30,
        },
        payments: {
          cashPct,
          onlinePct,
          cardPct,
          otherPct,
        },
        drivers: {
          activePct,
          totalDrivers,
          activeDrivers,
          avgDeliveriesPerDriver,
        },
        delivery: {
          successRate,
          totalDeliveries: deliveredStops,
          pendingDeliveries: pendingStops,
          failedDeliveries: failedStops,
        },
        alerts,
        topServices,
      }

      cache.set(cacheKey, data)
      return data
    } catch (error) {
      console.error('Error fetching KPI overview:', error)
      throw new Error('Failed to fetch dashboard data')
    }
  }

  /**
   * Get orders trend data
   */
  async getOrdersTrend(
    tenantId: string,
    options?: {
      interval?: 'day' | 'week' | 'month'
      from?: Date
      to?: Date
      branchId?: string
      timeZone?: string | null
    }
  ): Promise<OrdersTrendData[]> {
    const cacheKey = `orders-trend-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<OrdersTrendData[]>(cacheKey)
    if (cached) return cached

    try {
      const zone = options?.timeZone
      const to = options?.to || new Date()
      const toCivil = civilDateInZone(to, zone)
      if (!zone || !toCivil) return []
      const from = options?.from || civilDayBounds(shiftCivilDate(toCivil, -7), zone).start
      let query = this.supabase
        .from('org_orders_mst')
        .select('created_at')
        .eq('tenant_org_id', tenantId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
      if (options?.branchId) query = query.eq('branch_id', options.branchId)
      const { data } = await query
      const byDate: Record<string, number> = {}
      ;(data || []).forEach((o) => {
        const d = civilDateInZone((o as { created_at: string }).created_at, zone)
        if (d) byDate[d] = (byDate[d] || 0) + 1
      })
      const result = Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
      cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Error fetching orders trend:', error)
      throw new Error('Failed to fetch orders trend')
    }
  }

  /**
   * Get revenue trend data
   */
  async getRevenueTrend(
    tenantId: string,
    options?: {
      interval?: 'day' | 'week' | 'month'
      from?: Date
      to?: Date
      branchId?: string
      timeZone?: string | null
    }
  ): Promise<RevenueTrendData[]> {
    const cacheKey = `revenue-trend-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<RevenueTrendData[]>(cacheKey)
    if (cached) return cached

    try {
      const zone = options?.timeZone
      const to = options?.to || new Date()
      const toCivil = civilDateInZone(to, zone)
      if (!zone || !toCivil) return []
      const from = options?.from || civilDayBounds(shiftCivilDate(toCivil, -7), zone).start
      let query = this.supabase
        .from('org_orders_mst')
        .select('created_at, total:total_amount')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("CANCELLED")')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
      if (options?.branchId) query = query.eq('branch_id', options.branchId)
      const { data } = await query
      const byDate: Record<string, number> = {}
      ;(data || []).forEach((o) => {
        const d = civilDateInZone((o as { created_at: string }).created_at, zone)
        const amount = Number((o as { total?: number }).total || 0)
        if (d) byDate[d] = (byDate[d] || 0) + amount
      })
      const result = Object.entries(byDate)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date))
      cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Error fetching revenue trend:', error)
      throw new Error('Failed to fetch revenue trend')
    }
  }

  /**
   * Get orders count for a specific date
   */
  async getOrdersCountForCivilDay(
    tenantId: string,
    civilDay: string,
    timeZone: string | null,
    branchId?: string
  ): Promise<number> {
    if (!timeZone || !/^\d{4}-\d{2}-\d{2}$/.test(civilDay)) return 0
    const bounds = civilDayBounds(civilDay, timeZone)
    let query = this.supabase
      .from('org_orders_mst')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_org_id', tenantId)
      .gte('created_at', bounds.start.toISOString())
      .lt('created_at', bounds.end.toISOString())
    if (branchId) query = query.eq('branch_id', branchId)
    const { count, error } = await query
    if (error) return 0
    return count || 0
  }

  /**
   * Get today's orders count in the operations zone.
   */
  async getTodayOrdersCount(tenantId: string, timeZone: string | null, branchId?: string): Promise<number> {
    const day = civilDateInZone(new Date(), timeZone)
    if (!day) return 0
    return this.getOrdersCountForCivilDay(tenantId, day, timeZone, branchId)
  }

  /**
   * Get recent orders for dashboard
   */
  async getRecentOrders(
    tenantId: string,
    limit = 5
  ): Promise<Array<{ id: string; order_no: string; status: string; created_at: string }>> {
    const { data, error } = await this.supabase
      .from('org_orders_mst')
      .select('id, order_no, status, created_at')
      .eq('tenant_org_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data || []) as Array<{ id: string; order_no: string; status: string; created_at: string }>
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(
    tenantId: string,
    branchId?: string
  ): Promise<Record<string, number>> {
    try {
      let query = this.supabase
        .from('org_orders_mst')
        .select('status')
        .eq('tenant_org_id', tenantId)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query

      if (error) throw error

      // Count orders by status
      const statusCounts: Record<string, number> = {}
      data?.forEach((order) => {
        const status = (order as any).status || 'unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      return statusCounts
    } catch (error) {
      console.error('Error fetching orders by status:', error)
      return {}
    }
  }

  /**
   * Clear cache for a tenant
   */
  clearCache(tenantId: string): void {
    cache.invalidate(tenantId)
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    cache.clear()
  }
}

// Export singleton instance
export const dashboardService = new DashboardService()
