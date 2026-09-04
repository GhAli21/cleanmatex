import { getCSRFToken, getCSRFTokenHeaderName } from '@/lib/utils/csrf-token';
import type { DeliveryRouteManifest } from '@/lib/services/delivery/delivery-route-query.service';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface RouteListItem {
  id: string;
  routeNumber: string;
  statusCode: string;
  driverId: string | null;
  totalStops: number;
  completedStops: number;
  createdAt: string | null;
}

export interface RouteCommandResult {
  routeId: string;
  routeNumber: string;
  stopIds: string[];
  driverWarning?: string;
}

export interface AssignDriverResult {
  routeId: string;
  driverId: string;
  driverWarning?: string;
}

/** Stable client error that preserves the server's command error code and details for the UI. */
export class DeliveryRouteApiError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DeliveryRouteApiError';
    this.code = code;
    this.details = details;
  }
}

async function csrfHeaders(): Promise<Record<string, string>> {
  const token = await getCSRFToken();
  if (!token) {
    throw new DeliveryRouteApiError('CSRF_UNAVAILABLE', 'Unable to verify this request.');
  }
  return { [getCSRFTokenHeaderName()]: token };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success) {
    throw new DeliveryRouteApiError(
      payload?.code ?? 'DELIVERY_ROUTE_REQUEST_FAILED',
      payload?.error ?? 'Delivery route request failed.',
      payload?.details,
    );
  }
  return (payload.data as T) ?? (undefined as T);
}

function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Lists tenant-scoped delivery routes, newest first. */
export async function listRoutes(status?: string): Promise<{ routes: RouteListItem[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`/api/v1/delivery/routes${query}`, { method: 'GET', credentials: 'include' });
  return readEnvelope<{ routes: RouteListItem[] }>(response);
}

/** Loads one route's full manifest (stops, order, and customer detail). */
export async function getRouteManifest(routeId: string): Promise<DeliveryRouteManifest> {
  const response = await fetch(`/api/v1/delivery/routes/${routeId}`, { method: 'GET', credentials: 'include' });
  return readEnvelope<DeliveryRouteManifest>(response);
}

/** Creates a route from ready orders, optionally assigning a driver at creation. */
export async function createDeliveryRoute(input: { orderIds: string[]; driverId?: string | null }): Promise<RouteCommandResult> {
  const response = await fetch('/api/v1/delivery/routes', {
    method: 'POST',
    credentials: 'include',
    headers: { ...(await csrfHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderIds: input.orderIds,
      driverId: input.driverId ?? undefined,
      idempotencyKey: newIdempotencyKey('route-create'),
    }),
  });
  return readEnvelope<RouteCommandResult>(response);
}

/** Adds ready orders to a route that has not started yet. */
export async function addOrdersToDeliveryRoute(routeId: string, orderIds: string[]): Promise<RouteCommandResult> {
  const response = await fetch(`/api/v1/delivery/routes/${routeId}/orders`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...(await csrfHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds, idempotencyKey: newIdempotencyKey('route-add-orders') }),
  });
  return readEnvelope<RouteCommandResult>(response);
}

/** Removes one stop from a route that has not started yet. */
export async function removeStopFromDeliveryRoute(routeId: string, stopId: string): Promise<void> {
  const response = await fetch(`/api/v1/delivery/routes/${routeId}/stops/${stopId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: await csrfHeaders(),
  });
  await readEnvelope<Record<string, never>>(response);
}

/** Cancels a planned or in-progress route; delivered stops are left untouched. */
export async function cancelDeliveryRoute(routeId: string, reason?: string): Promise<void> {
  const response = await fetch(`/api/v1/delivery/routes/${routeId}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...(await csrfHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await readEnvelope<Record<string, never>>(response);
}

/** Assigns or reassigns a driver on a route. A driver double-booking returns a non-blocking warning. */
export async function assignDeliveryDriver(routeId: string, driverId: string): Promise<AssignDriverResult> {
  const response = await fetch(`/api/v1/delivery/routes/${routeId}/assign`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...(await csrfHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId }),
  });
  return readEnvelope<AssignDriverResult>(response);
}
