import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useScreenContract, type ScreenContract } from './use-screen-contract';

export interface OrdersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrdersListResponse<TOrder = any> {
  success: boolean;
  data?: {
    orders: TOrder[];
    pagination: OrdersPagination;
  };
  error?: string;
  message?: string;
}

export interface NormalizedCustomer {
  name: string;
  phone: string;
}

function normalizeCustomerFromOrder(order: any): NormalizedCustomer {
  // Handle different customer shapes coming from API
  let customer = order?.customer ?? null;

  if (!customer && order?.org_customers_mst) {
    const orgCustomer = Array.isArray(order.org_customers_mst)
      ? order.org_customers_mst[0]
      : order.org_customers_mst;

    if (orgCustomer) {
      const sysCustomer = orgCustomer.sys_customers_mst;
      customer = {
        name: sysCustomer?.name || orgCustomer.name || 'Unknown Customer',
        phone: sysCustomer?.phone || orgCustomer.phone || 'N/A',
      };
    }
  }

  if (!customer) {
    return { name: 'Unknown Customer', phone: 'N/A' };
  }

  return {
    name: customer.name || 'Unknown Customer',
    phone: customer.phone || 'N/A',
  };
}

export interface UseScreenOrdersOptions {
  page?: number;
  limit?: number;
  additionalFilters?: Record<string, string | number | boolean | undefined | null>;
  /** Search by order #, customer name, phone, email */
  search?: string;
  /** Sort by: order_no, received_at, ready_by, created_at, total */
  sortBy?: string;
  /** asc or desc */
  sortOrder?: 'asc' | 'desc';
  /** ISO date strings for date range filters */
  receivedFrom?: string;
  receivedTo?: string;
  readyByFrom?: string;
  readyByTo?: string;
  enabled?: boolean;
  /**
   * Gradual migration flag.
   * Semantics (per migration plan):
   * - `false` => force OLD workflow behavior
   * - `true` or `undefined` => use NEW workflow behavior (screen contract)
   */
  useOldWfCodeOrNew?: boolean;
  /**
   * Fallback statuses used when the screen contract is missing/unavailable.
   * This keeps screens usable even before DB contract entries are added.
   */
  fallbackStatuses?: string[];
}

/**
 * Hook to get orders filtered by screen contract pre-conditions.
 * It fetches the screen contract and then uses its status list to query `/api/v1/orders`.
 */
export function useScreenOrders<TOrder = any>(
  screen: string,
  options: UseScreenOrdersOptions = {}
): {
  contract?: ScreenContract;
  contractLoading: boolean;
  statusFilter: string;
  orders: (TOrder & { customer?: NormalizedCustomer })[];
  pagination: OrdersPagination;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const {
    data: contract,
    isLoading: contractLoading,
    error: contractError,
  } = useScreenContract(screen);

  const statusFilter = useMemo(() => {
    const useNewWorkflow = options.useOldWfCodeOrNew !== false;

    // Old workflow: ignore screen contracts and use legacy/hardcoded statuses.
    if (!useNewWorkflow) {
      const legacyByScreen: Record<string, string[]> = {
        preparation: ['intake', 'preparing'],
        processing: ['processing'],
        assembly: ['ready', 'assembly'],
        qa: ['ready', 'qa'],
        packing: ['packing'],
        ready: ['ready'],
        delivery: ['out_for_delivery'],
      };

      const legacy = legacyByScreen[screen];
      if (legacy && legacy.length > 0) return legacy.join(',');

      const fallback = options.fallbackStatuses;
      if (fallback && fallback.length > 0) return fallback.join(',');

      return '';
    }

    // New workflow: use screen contract pre-conditions; fallback if missing.
    const statuses = contract?.preConditions?.statuses;
    if (statuses && statuses.length > 0) return statuses.join(',');

    const fallback = options.fallbackStatuses;
    if (fallback && fallback.length > 0) return fallback.join(',');

    return '';
  }, [contract, options.fallbackStatuses, options.useOldWfCodeOrNew, screen]);

  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const enabled = (options.enabled ?? true) && !contractLoading;

  const { data, isLoading, error, refetch, isFetching } = useQuery<OrdersListResponse<TOrder>>({
    queryKey: [
      'orders',
      'screen',
      screen,
      {
        statusFilter,
        page,
        limit,
        search: options.search,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        receivedFrom: options.receivedFrom,
        receivedTo: options.receivedTo,
        readyByFrom: options.readyByFrom,
        readyByTo: options.readyByTo,
        ...options.additionalFilters,
      },
    ],
    enabled: enabled && statusFilter.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status_filter', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));

      if (options.search?.trim()) {
        params.set('search', options.search.trim());
      }
      if (options.sortBy) {
        params.set('sort_by', options.sortBy);
      }
      if (options.sortOrder) {
        params.set('sort_order', options.sortOrder);
      }
      if (options.receivedFrom) {
        params.set('received_from', options.receivedFrom);
      }
      if (options.receivedTo) {
        params.set('received_to', options.receivedTo);
      }
      if (options.readyByFrom) {
        params.set('ready_by_from', options.readyByFrom);
      }
      if (options.readyByTo) {
        params.set('ready_by_to', options.readyByTo);
      }

      const additionalFilters = options.additionalFilters ?? {};
      for (const [key, value] of Object.entries(additionalFilters)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
      }

      // NOTE: `/api/v1/orders` is tenant-scoped on the server side.
      const res = await fetch(`/api/v1/orders?${params.toString()}`);
      const json = (await res.json()) as OrdersListResponse<TOrder>;

      if (!res.ok || !json.success) {
        const msg = json.error || json.message || `Failed to load orders (${res.status})`;
        throw new Error(msg);
      }

      return json;
    },
  });

  const orders = useMemo(() => {
    const raw = data?.data?.orders ?? [];
    return raw.map((o: any) => ({ ...o, customer: normalizeCustomerFromOrder(o) }));
  }, [data]);

  const pagination: OrdersPagination = data?.data?.pagination ?? {
    page,
    limit,
    total: 0,
    totalPages: 0,
  };

  const mergedError =
    (contractError instanceof Error ? contractError.message : null) ??
    (error instanceof Error ? error.message : null);

  return {
    contract,
    contractLoading,
    statusFilter,
    orders,
    isLoading: contractLoading || isLoading,
    isFetching,
    error: mergedError,
    pagination,
    refetch: async () => {
      await refetch();
    },
  };
}


