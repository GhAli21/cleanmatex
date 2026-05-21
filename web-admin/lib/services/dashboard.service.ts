/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
/**
 * Dashboard Service
 *
 * Handles fetching dashboard KPI data with caching and performance monitoring
 */

import { createClient } from '@/lib/supabase/client'
import { tenantSettingsService } from '@/lib/services/tenant-settings.service'

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
   * @param branchId - Optional branch filter
   * @param dateRange - Optional date range
   */
  async getKPIOverview(
    tenantId: string,
    options?: {
      branchId?: string
      from?: Date
      to?: Date
    }
  ): Promise<KPIOverview> {
    const cacheKey = `kpi-overview-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<KPIOverview>(cacheKey)
    if (cached) return cached

    try {
      const branchId = options?.branchId
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStart = today.toISOString()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
      const last30Start = new Date(today)
      last30Start.setDate(last30Start.getDate() - 30)
      const last30StartStr = last30Start.toISOString()

      let ordersQuery = this.supabase
        .from('org_orders_mst')
        .select('id, status, total, created_at')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("CANCELLED","CLOSED")')
      if (branchId) ordersQuery = ordersQuery.eq('branch_id', branchId)

      const { data: orders } = await ordersQuery
      const ordersList = orders || []

      const todayOrders = ordersList.filter(
        (o) => (o as { created_at: string }).created_at >= todayStart
      )
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

      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()
      const fourteenDaysAgo = new Date(today)
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

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
        buildDeliveredQuery('created_at, delivered_at, ready_by', last30StartStr),
        buildDeliveredQuery(
          'created_at, delivered_at',
          fourteenDaysAgo.toISOString(),
          sevenDaysAgo.toISOString()
        ),
        buildDeliveredQuery('created_at, delivered_at', sevenDaysAgoStr),
        this.supabase
          .from('org_fin_voucher_trx_lines_dtl')
          .select('payment_method_code, amount')
          .eq('tenant_org_id', tenantId)
          .eq('direction', 'IN')
          .gte('created_at', last30StartStr),
        this.supabase
          .from('org_order_item_issues')
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
              .not('ready_by', 'is', null)
              .lt('ready_by', new Date().toISOString())
              .limit(25)
          : this.supabase
              .from('org_orders_mst')
              .select('id, order_no')
              .eq('tenant_org_id', tenantId)
              .not('status', 'in', '("DELIVERED","CLOSED","CANCELLED")')
              .not('ready_by', 'is', null)
              .lt('ready_by', new Date().toISOString())
              .limit(25),
        recentOrderIdsPromise,
      ])

      const deliveredLast30List = (deliveredLast30 || []) as unknown as Array<{
        created_at: string
        delivered_at: string
        ready_by: string | null
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
        const eligible = rows.filter((r) => r.ready_by && r.delivered_at)
        if (!eligible.length) return 0
        let ok = 0
        for (const r of eligible) {
          if (new Date(r.delivered_at!).getTime() <= new Date(r.ready_by!).getTime()) ok++
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
      const todayStartMs = today.getTime()
      const endToday = new Date(today)
      endToday.setHours(23, 59, 59, 999)
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
          if (st >= todayStartMs && st <= endToday.getTime()) {
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
          actionUrl: '/issues',
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
            .select('service_category_code, total_price')
            .eq('tenant_org_id', tenantId)
            .in('order_id', chunk)
          for (const line of lines || []) {
            const l = line as { service_category_code?: string | null; total_price?: number | null }
            const key = (l.service_category_code || 'unknown').trim() || 'unknown'
            agg[key] = (agg[key] || 0) + Number(l.total_price || 0)
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
    }
  ): Promise<OrdersTrendData[]> {
    const cacheKey = `orders-trend-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<OrdersTrendData[]>(cacheKey)
    if (cached) return cached

    try {
      const to = options?.to || new Date()
      const from = options?.from || new Date(to)
      from.setDate(from.getDate() - 7)
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
        const d = (o as { created_at: string }).created_at?.slice(0, 10)
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
    }
  ): Promise<RevenueTrendData[]> {
    const cacheKey = `revenue-trend-${tenantId}-${JSON.stringify(options)}`
    const cached = cache.get<RevenueTrendData[]>(cacheKey)
    if (cached) return cached

    try {
      const to = options?.to || new Date()
      const from = options?.from || new Date(to)
      from.setDate(from.getDate() - 7)
      let query = this.supabase
        .from('org_orders_mst')
        .select('created_at, total')
        .eq('tenant_org_id', tenantId)
        .not('status', 'in', '("CANCELLED")')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
      if (options?.branchId) query = query.eq('branch_id', options.branchId)
      const { data } = await query
      const byDate: Record<string, number> = {}
      ;(data || []).forEach((o) => {
        const d = (o as { created_at: string }).created_at?.slice(0, 10)
        const t = Number((o as { total?: number }).total || 0)
        if (d) byDate[d] = (byDate[d] || 0) + t
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
  async getOrdersCountForDate(
    tenantId: string,
    date: Date,
    branchId?: string
  ): Promise<number> {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    let query = this.supabase
      .from('org_orders_mst')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_org_id', tenantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    if (branchId) query = query.eq('branch_id', branchId)
    const { count, error } = await query
    if (error) return 0
    return count || 0
  }

  /**
   * Get today's orders count
   */
  async getTodayOrdersCount(tenantId: string, branchId?: string): Promise<number> {
    return this.getOrdersCountForDate(tenantId, new Date(), branchId)
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
