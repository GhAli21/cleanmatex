'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchCustomers, fetchCustomerStats } from '@/lib/api/customers';
import type {
  CustomerListItem,
  CustomerSearchParams,
  CustomerStatistics,
} from '@/lib/types/customer';

export interface UseCustomersOptions {
  tenantId: string | null;
  initialPageSize?: number;
}

export function useCustomers(options: UseCustomersOptions) {
  const { tenantId, initialPageSize = 20 } = options;
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [stats, setStats] = useState<CustomerStatistics | null>(null);
  const [filters, setFilters] = useState<CustomerSearchParams>({
    search: '',
    type: undefined,
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: initialPageSize,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: CustomerSearchParams = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };
      const { customers: list, pagination: pag } = await fetchCustomers(params);
      setCustomers(list ?? []);
      setPagination((prev) => ({
        ...prev,
        total: pag?.total ?? 0,
        totalPages: pag?.totalPages ?? 0,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, pagination.page, pagination.limit, filters]);

  const loadStats = useCallback(async () => {
    try {
      const statistics = await fetchCustomerStats();
      setStats(statistics);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    if (tenantId) loadCustomers();
    else setLoading(false);
  }, [tenantId, loadCustomers]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleFilterChange = useCallback((newFilters: Partial<CustomerSearchParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  return {
    customers,
    stats,
    filters,
    pagination,
    loading,
    error,
    loadCustomers,
    loadStats,
    handleFilterChange,
    setPage,
    setPageSize,
  };
}
