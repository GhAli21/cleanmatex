/**
 * Prisma Performance Monitoring
 * 
 * Tracks query performance, connection pool usage, and tenant context overhead
 */

import { PrismaClient } from '@prisma/client';

export interface QueryMetrics {
  model: string;
  action: string;
  duration: number;
  tenantId: string | null;
  timestamp: Date;
}

export interface ConnectionPoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  timestamp: Date;
}

export interface TenantContextMetrics {
  tenantId: string;
  operationCount: number;
  totalDuration: number;
  averageDuration: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private tenantContextMetrics: Map<string, TenantContextMetrics> = new Map();
  private maxMetricsHistory = 1000; // Keep last 1000 queries

  /**
   * Record query performance metrics
   */
  recordQuery(
    model: string,
    action: string,
    duration: number,
    tenantId: string | null
  ): void {
    const metric: QueryMetrics = {
      model,
      action,
      duration,
      tenantId,
      timestamp: new Date(),
    };

    this.queryMetrics.push(metric);

    // Keep only last N metrics
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics.shift();
    }

    // Track tenant-specific metrics
    if (tenantId) {
      this.updateTenantMetrics(tenantId, duration);
    }

    // Log slow queries (> 1000ms)
    if (duration > 1000 && process.env.NODE_ENV === 'development') {
      console.warn(
        `[Prisma Performance] Slow query detected: ${model}.${action} took ${duration}ms (tenant: ${tenantId || 'none'})`
      );
    }
  }

  /**
   * Update tenant-specific performance metrics
   */
  private updateTenantMetrics(tenantId: string, duration: number): void {
    const existing = this.tenantContextMetrics.get(tenantId);
    
    if (existing) {
      existing.operationCount++;
      existing.totalDuration += duration;
      existing.averageDuration = existing.totalDuration / existing.operationCount;
      existing.timestamp = new Date();
    } else {
      this.tenantContextMetrics.set(tenantId, {
        tenantId,
        operationCount: 1,
        totalDuration: duration,
        averageDuration: duration,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    queriesByModel: Record<string, number>;
    queriesByAction: Record<string, number>;
  } {
    if (this.queryMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: 0,
        queriesByModel: {},
        queriesByAction: {},
      };
    }

    const totalDuration = this.queryMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalDuration / this.queryMetrics.length;
    const slowQueries = this.queryMetrics.filter(m => m.duration > 1000).length;

    const queriesByModel: Record<string, number> = {};
    const queriesByAction: Record<string, number> = {};

    this.queryMetrics.forEach(metric => {
      queriesByModel[metric.model] = (queriesByModel[metric.model] || 0) + 1;
      queriesByAction[metric.action] = (queriesByAction[metric.action] || 0) + 1;
    });

    return {
      totalQueries: this.queryMetrics.length,
      averageDuration,
      slowQueries,
      queriesByModel,
      queriesByAction,
    };
  }

  /**
   * Get tenant-specific performance metrics
   */
  getTenantMetrics(tenantId: string): TenantContextMetrics | null {
    return this.tenantContextMetrics.get(tenantId) || null;
  }

  /**
   * Get all tenant metrics
   */
  getAllTenantMetrics(): TenantContextMetrics[] {
    return Array.from(this.tenantContextMetrics.values());
  }

  /**
   * Get connection pool metrics
   * Note: Prisma doesn't expose connection pool metrics directly,
   * but we can estimate based on active queries
   */
  getConnectionPoolMetrics(): ConnectionPoolMetrics {
    // Estimate based on active queries (simplified)
    // In production, you might want to use Prisma's query engine metrics
    const activeQueries = this.queryMetrics.filter(
      m => Date.now() - m.timestamp.getTime() < 5000 // Queries in last 5 seconds
    ).length;

    return {
      activeConnections: Math.min(activeQueries, 10), // Estimate
      idleConnections: Math.max(0, 10 - activeQueries), // Estimate
      totalConnections: 10, // Default Prisma pool size
      timestamp: new Date(),
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.queryMetrics = [];
    this.tenantContextMetrics.clear();
  }

  /**
   * Get recent slow queries
   */
  getSlowQueries(threshold: number = 1000, limit: number = 10): QueryMetrics[] {
    return this.queryMetrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Apply performance monitoring middleware to Prisma client
 */
export function applyPerformanceMiddleware(prisma: PrismaClient): void {
  (prisma as any).$use(async (params: any, next: any) => {
    const startTime = Date.now();
    const { getTenantId } = await import('./tenant-context');
    const tenantId = getTenantId();

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      // Record metrics
      performanceMonitor.recordQuery(
        params.model || 'unknown',
        params.action || 'unknown',
        duration,
        tenantId
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record metrics even for errors
      performanceMonitor.recordQuery(
        params.model || 'unknown',
        params.action || 'unknown',
        duration,
        tenantId
      );

      throw error;
    }
  });
}

/**
 * Get performance report
 */
export function getPerformanceReport(): {
  queryStats: ReturnType<typeof performanceMonitor.getQueryStats>;
  connectionPool: ConnectionPoolMetrics;
  tenantMetrics: TenantContextMetrics[];
  slowQueries: QueryMetrics[];
} {
  return {
    queryStats: performanceMonitor.getQueryStats(),
    connectionPool: performanceMonitor.getConnectionPoolMetrics(),
    tenantMetrics: performanceMonitor.getAllTenantMetrics(),
    slowQueries: performanceMonitor.getSlowQueries(),
  };
}

