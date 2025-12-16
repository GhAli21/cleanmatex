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
      // TODO: Replace with actual API call
      // For now, return mock data
      const data: KPIOverview = {
        orders: {
          today: 0,
          inProcess: 0,
          ready: 0,
          outForDelivery: 0,
          deltaToday: 0,
        },
        revenue: {
          today: 0,
          mtd: 0,
          last30d: 0,
          currency: 'OMR',
          deltaToday: 0,
        },
        sla: {
          avgTATHours: 0,
          onTimePct: 0,
        },
        issues: {
          open: 0,
          last7d: 0,
        },
        payments: {
          cashPct: 0,
          onlinePct: 0,
        },
        drivers: {
          activePct: 0,
        },
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
      // TODO: Implement actual query
      const data: OrdersTrendData[] = []
      cache.set(cacheKey, data)
      return data
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
      // TODO: Implement actual query
      const data: RevenueTrendData[] = []
      cache.set(cacheKey, data)
      return data
    } catch (error) {
      console.error('Error fetching revenue trend:', error)
      throw new Error('Failed to fetch revenue trend')
    }
  }

  /**
   * Get today's orders count
   */
  async getTodayOrdersCount(tenantId: string, branchId?: string): Promise<number> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let query = this.supabase
        .from('org_orders_mst')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_org_id', tenantId)
        .gte('created_at', today.toISOString())

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { count, error } = await query

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error fetching today orders count:', error)
      return 0
    }
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
