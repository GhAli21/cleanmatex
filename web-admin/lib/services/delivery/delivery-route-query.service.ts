import 'server-only';

import { prisma } from '@/lib/db/prisma';

export interface DeliveryStopView {
  id: string;
  routeId: string;
  sequence: number;
  statusCode: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  scheduledTime: string | null;
  estimatedArrival: string | null;
  actualTime: string | null;
  order: {
    id: string;
    orderNo: string;
    currentStatus: string | null;
    stateVersion: number;
    paymentTypeCode: string | null;
    outstandingAmount: number;
    currencyCode: string | null;
    totalItems: number;
    customerName: string | null;
    customerPhone: string | null;
  };
}

export interface DeliveryRouteManifest {
  id: string;
  routeNumber: string;
  statusCode: string;
  driverId: string | null;
  totalStops: number;
  completedStops: number;
  startedAt: string | null;
  completedAt: string | null;
  stops: DeliveryStopView[];
}

export interface DeliveryRouteListItem {
  id: string;
  routeNumber: string;
  statusCode: string;
  driverId: string | null;
  branchId: string | null;
  totalStops: number;
  completedStops: number;
  createdAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface ListRoutesParams {
  tenantId: string;
  page?: number;
  limit?: number;
  /** One status code, or several (e.g. the dispatcher's active-work view: planned + in_progress). */
  status?: string | string[];
}

export interface ListRoutesResult {
  routes: DeliveryRouteListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function toNumber(value: { toString(): string } | number | null): number {
  return value === null ? 0 : Number(value);
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function mapStop(stop: {
  id: string;
  route_id: string;
  sequence: number;
  stop_status_code: string | null;
  address: string;
  address_lat: { toString(): string } | null;
  address_lng: { toString(): string } | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  scheduled_time: Date | null;
  estimated_arrival: Date | null;
  actual_time: Date | null;
  org_orders_mst: {
    id: string;
    order_no: string;
    current_status: string | null;
    state_version: number;
    payment_type_code: string | null;
    outstanding_amount: { toString(): string } | null;
    currency_code: string | null;
    total_items: number | null;
    org_customers_mst: { name: string | null; phone: string | null };
  };
}): DeliveryStopView {
  return {
    id: stop.id,
    routeId: stop.route_id,
    sequence: stop.sequence,
    statusCode: stop.stop_status_code ?? 'pending',
    address: stop.address,
    latitude: stop.address_lat === null ? null : toNumber(stop.address_lat),
    longitude: stop.address_lng === null ? null : toNumber(stop.address_lng),
    contactName: stop.contact_name,
    contactPhone: stop.contact_phone,
    notes: stop.notes,
    scheduledTime: toIso(stop.scheduled_time),
    estimatedArrival: toIso(stop.estimated_arrival),
    actualTime: toIso(stop.actual_time),
    order: {
      id: stop.org_orders_mst.id,
      orderNo: stop.org_orders_mst.order_no,
      currentStatus: stop.org_orders_mst.current_status,
      stateVersion: stop.org_orders_mst.state_version,
      paymentTypeCode: stop.org_orders_mst.payment_type_code,
      outstandingAmount: toNumber(stop.org_orders_mst.outstanding_amount),
      currencyCode: stop.org_orders_mst.currency_code,
      totalItems: stop.org_orders_mst.total_items ?? 0,
      customerName: stop.org_orders_mst.org_customers_mst.name,
      customerPhone: stop.org_orders_mst.org_customers_mst.phone,
    },
  };
}

const stopSelect = {
  id: true,
  route_id: true,
  sequence: true,
  stop_status_code: true,
  address: true,
  address_lat: true,
  address_lng: true,
  contact_name: true,
  contact_phone: true,
  notes: true,
  scheduled_time: true,
  estimated_arrival: true,
  actual_time: true,
  org_orders_mst: {
    select: {
      id: true,
      order_no: true,
      current_status: true,
      state_version: true,
      payment_type_code: true,
      outstanding_amount: true,
      currency_code: true,
      total_items: true,
      org_customers_mst: { select: { name: true, phone: true } },
    },
  },
} as const;

/**
 * Read delivery operational data through one tenant-filtered contract so every
 * channel sees the same route, stop, payment, and proof state.
 */
export class DeliveryRouteQueryService {
  static async getRouteManifest(
    tenantId: string,
    routeId: string,
  ): Promise<DeliveryRouteManifest | null> {
    const route = await prisma.org_dlv_routes_mst.findFirst({
      where: { id: routeId, tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: {
        id: true,
        route_number: true,
        route_status_code: true,
        driver_id: true,
        total_stops: true,
        completed_stops: true,
        started_at: true,
        completed_at: true,
        org_dlv_stops_dtl: {
          where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
          orderBy: { sequence: 'asc' },
          select: stopSelect,
        },
      },
    });

    if (!route) return null;

    return {
      id: route.id,
      routeNumber: route.route_number,
      statusCode: route.route_status_code ?? 'planned',
      driverId: route.driver_id,
      totalStops: route.total_stops ?? route.org_dlv_stops_dtl.length,
      completedStops: route.completed_stops ?? 0,
      startedAt: toIso(route.started_at),
      completedAt: toIso(route.completed_at),
      stops: route.org_dlv_stops_dtl.map(mapStop),
    };
  }

  static async getStop(tenantId: string, stopId: string): Promise<DeliveryStopView | null> {
    const stop = await prisma.org_dlv_stops_dtl.findFirst({
      where: { id: stopId, tenant_org_id: tenantId, is_active: true, rec_status: 1 },
      select: stopSelect,
    });
    return stop ? mapStop(stop) : null;
  }

  /**
   * Returns the current pending/in-transit stop for an order, if the profile
   * is using a planned route. Floor completion uses this to choose the writer.
   */
  static async getActiveStopForOrder(
    tenantId: string,
    orderId: string,
  ): Promise<DeliveryStopView | null> {
    const stop = await prisma.org_dlv_stops_dtl.findFirst({
      where: {
        order_id: orderId,
        tenant_org_id: tenantId,
        is_active: true,
        rec_status: 1,
        stop_status_code: { in: ['pending', 'in_transit'] },
        org_dlv_routes_mst: { is_active: true, rec_status: 1 },
      },
      orderBy: { updated_at: 'desc' },
      select: stopSelect,
    });
    return stop ? mapStop(stop) : null;
  }

  /** Paginated route list for the dispatcher workspace and route-planning UI. */
  static async listRoutes(params: ListRoutesParams): Promise<ListRoutesResult> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;

    const statusFilter = Array.isArray(params.status)
      ? (params.status.length > 0 ? { route_status_code: { in: params.status } } : {})
      : (params.status ? { route_status_code: params.status } : {});

    const where = {
      tenant_org_id: params.tenantId,
      is_active: true,
      rec_status: 1,
      ...statusFilter,
    };

    const [rows, total] = await Promise.all([
      prisma.org_dlv_routes_mst.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          route_number: true,
          route_status_code: true,
          driver_id: true,
          branch_id: true,
          total_stops: true,
          completed_stops: true,
          created_at: true,
          completed_at: true,
          rec_notes: true,
        },
      }),
      prisma.org_dlv_routes_mst.count({ where }),
    ]);

    return {
      routes: rows.map((route) => ({
        id: route.id,
        routeNumber: route.route_number,
        statusCode: route.route_status_code ?? 'planned',
        driverId: route.driver_id,
        branchId: route.branch_id,
        totalStops: route.total_stops ?? 0,
        completedStops: route.completed_stops ?? 0,
        createdAt: toIso(route.created_at),
        completedAt: toIso(route.completed_at),
        notes: route.rec_notes,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
