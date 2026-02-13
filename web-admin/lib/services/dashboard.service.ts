/**
 * Dashboard Service
 *
 * Handles fetching dashboard KPI data with caching and performance monitoring
 */

import { createClient } from '@/lib/supabase/client'

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
  }
  issues: {
    open: number
    last7d: number
  }
  payments: {
    cashPct: number
    onlinePct: number
  }
  drivers: {
    activePct: number
  }
  topServices: Array<{
    name: string
    amount: number
  }>
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
          currency: 'OMR',
          deltaToday: 0,
        },
        sla: { avgTATHours: 0, onTimePct: 0 },
        issues: { open: 0, last7d: 0 },
        payments: { cashPct: 0, onlinePct: 0 },
        drivers: { activePct: 0 },
        topServices: [],
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
