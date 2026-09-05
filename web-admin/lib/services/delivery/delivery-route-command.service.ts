import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import {
  claimIdempotencyKey,
  deleteIdempotencyHash,
  hashPayload,
} from '@/lib/utils/idempotency';
import type { PrismaTransactionClient } from '@/lib/services/workflow/workflow-engine.service';

const ROUTE_CREATE_RESOURCE = 'delivery_route_create';
const ROUTE_ADD_ORDERS_RESOURCE = 'delivery_route_add_orders';
const NO_ADDRESS_ON_FILE = 'No address on file — contact customer for pickup/delivery location';

/** Error codes returned by the delivery route-planning commands. */
export type DeliveryRouteCommandErrorCode =
  | 'NO_ORDERS_SELECTED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_ELIGIBLE'
  | 'ORDER_ALREADY_ON_ROUTE'
  | 'BRANCH_MISMATCH'
  | 'DRIVER_NOT_FOUND'
  | 'DRIVER_INACTIVE'
  | 'ROUTE_NOT_FOUND'
  | 'ROUTE_NOT_PLANNED'
  | 'ROUTE_NOT_EDITABLE'
  | 'STOP_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDEMPOTENCY_IN_FLIGHT';

/** Stable application error used by the API adapter without leaking database details. */
export class DeliveryRouteCommandError extends Error {
  readonly code: DeliveryRouteCommandErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DeliveryRouteCommandErrorCode,
    message: string,
    httpStatus: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DeliveryRouteCommandError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

interface LockedOrder {
  id: string;
  order_no: string;
  current_status: string | null;
  branch_id: string | null;
  customer_id: string | null;
}

interface LockedRoute {
  id: string;
  route_number: string;
  route_status_code: string | null;
  branch_id: string | null;
  driver_id: string | null;
  total_stops: number | null;
}

interface LockedDriver {
  id: string;
  is_active: boolean;
}

interface ResolvedAddress {
  address: string;
  contactName: string | null;
  contactPhone: string | null;
}

/** Command input shared by staff web and any future dispatch channel. */
export interface CreateRouteCommand {
  tenantId: string;
  orderIds: string[];
  driverId?: string | null;
  /** Optional operational planning fields — dispatcher-entered, not system-derived. */
  startedAt?: Date | null;
  estimatedDurationMinutes?: number | null;
  totalDistanceKm?: number | null;
  actorUserId: string;
  actorName?: string;
  idempotencyKey: string;
}

export interface RouteCommandResult {
  routeId: string;
  routeNumber: string;
  stopIds: string[];
  driverWarning?: string;
}

export interface AddOrdersToRouteCommand {
  tenantId: string;
  routeId: string;
  orderIds: string[];
  actorUserId: string;
  idempotencyKey: string;
}

export interface RemoveStopFromRouteCommand {
  tenantId: string;
  routeId: string;
  stopId: string;
  actorUserId: string;
}

export interface CancelRouteCommand {
  tenantId: string;
  routeId: string;
  actorUserId: string;
  reason?: string;
}

export interface AssignDriverCommand {
  tenantId: string;
  routeId: string;
  driverId: string;
  actorUserId: string;
}

export interface AssignDriverResult {
  routeId: string;
  driverId: string;
  /** Non-blocking — the caller decides whether to proceed anyway. */
  driverWarning?: string;
}

async function loadReplay(
  tenantId: string,
  idempotencyKey: string,
  resourceType: string,
): Promise<RouteCommandResult | null> {
  const row = await prisma.org_idempotency_keys.findFirst({
    where: { tenant_org_id: tenantId, key: idempotencyKey, resource_type: resourceType },
    select: { response_cache: true },
  });
  const cached = row?.response_cache as { result?: RouteCommandResult } | null;
  return cached?.result ?? null;
}

// ── Row locking (raw SQL: Prisma has no SELECT ... FOR UPDATE API) ─────────

async function lockCandidateOrders(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderIds: readonly string[],
): Promise<LockedOrder[]> {
  return tx.$queryRaw<LockedOrder[]>`
    SELECT id, order_no, current_status, branch_id, customer_id
    FROM public.org_orders_mst
    WHERE id = ANY(${orderIds}::uuid[])
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
}

async function lockRoute(
  tx: PrismaTransactionClient,
  tenantId: string,
  routeId: string,
): Promise<LockedRoute> {
  const rows = await tx.$queryRaw<LockedRoute[]>`
    SELECT id, route_number, route_status_code, branch_id, driver_id, total_stops
    FROM public.org_dlv_routes_mst
    WHERE id = ${routeId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
      AND is_active = true
      AND COALESCE(rec_status, 1) = 1
    FOR UPDATE
  `;
  const route = rows[0];
  if (!route) {
    throw new DeliveryRouteCommandError('ROUTE_NOT_FOUND', 'Delivery route was not found.', 404);
  }
  return route;
}

/** No Prisma model exists for org_drivers_mst yet (schema not regenerated) — raw SQL is the only option, not a style choice. */
async function lockDriver(
  tx: PrismaTransactionClient,
  tenantId: string,
  driverId: string,
): Promise<LockedDriver> {
  const rows = await tx.$queryRaw<LockedDriver[]>`
    SELECT id, is_active
    FROM public.org_drivers_mst
    WHERE id = ${driverId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const driver = rows[0];
  if (!driver) {
    throw new DeliveryRouteCommandError('DRIVER_NOT_FOUND', 'Driver was not found.', 404);
  }
  if (!driver.is_active) {
    throw new DeliveryRouteCommandError('DRIVER_INACTIVE', 'This driver is deactivated.', 422);
  }
  return driver;
}

/** No Prisma model for org_dlv_route_seq_cf yet; the atomic UPSERT-increment-RETURNING also has no clean Prisma equivalent. */
async function nextRouteNumber(tx: PrismaTransactionClient, tenantId: string): Promise<string> {
  const yearCode = String(new Date().getFullYear());
  const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
    INSERT INTO public.org_dlv_route_seq_cf (tenant_org_id, year_code, last_seq)
    VALUES (${tenantId}::uuid, ${yearCode}, 1)
    ON CONFLICT (tenant_org_id, year_code)
    DO UPDATE SET last_seq = org_dlv_route_seq_cf.last_seq + 1, updated_at = now()
    RETURNING last_seq
  `;
  const seq = rows[0]?.last_seq ?? 1;
  return `RT-${yearCode}-${String(seq).padStart(3, '0')}`;
}

// ── Validation (typed Prisma reads — no locking needed) ────────────────────

/** Fails closed and lists exactly which orders are wrong, not a generic error. */
function assertOrdersEligible(
  requestedIds: readonly string[],
  locked: readonly LockedOrder[],
  expectExistingBranchId?: string | null,
): { branchId: string } {
  const found = new Map(locked.map((o) => [o.id, o]));
  const missing = requestedIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new DeliveryRouteCommandError(
      'ORDER_NOT_FOUND',
      'Some selected orders were not found for this tenant.',
      404,
      { orderIds: missing },
    );
  }

  const notEligible = locked.filter(
    (o) => (o.current_status ?? '').trim().toLowerCase() !== 'out_for_delivery',
  );
  if (notEligible.length > 0) {
    throw new DeliveryRouteCommandError(
      'ORDER_NOT_ELIGIBLE',
      'Only orders that are out for delivery and unassigned can be added to a route.',
      422,
      { orders: notEligible.map((o) => ({ orderId: o.id, orderNo: o.order_no, status: o.current_status })) },
    );
  }

  const branches = new Set(locked.map((o) => o.branch_id ?? null));
  if (expectExistingBranchId !== undefined) branches.add(expectExistingBranchId ?? null);
  if (branches.size > 1) {
    throw new DeliveryRouteCommandError(
      'BRANCH_MISMATCH',
      'All orders on a route must belong to the same branch.',
      422,
      { orders: locked.map((o) => ({ orderId: o.id, orderNo: o.order_no, branchId: o.branch_id })) },
    );
  }

  return { branchId: [...branches][0] ?? null };
}

/** Backstop before insert; the DB partial unique index is the real guarantee under concurrency. */
async function assertOrdersNotAlreadyBooked(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderIds: readonly string[],
): Promise<void> {
  const booked = await tx.org_dlv_stops_dtl.findMany({
    where: {
      tenant_org_id: tenantId,
      order_id: { in: [...orderIds] },
      stop_status_code: { notIn: ['cancelled', 'failed'] },
    },
    select: { order_id: true },
  });
  if (booked.length > 0) {
    throw new DeliveryRouteCommandError(
      'ORDER_ALREADY_ON_ROUTE',
      'Some selected orders are already on another active delivery stop.',
      409,
      { orderIds: booked.map((row) => row.order_id) },
    );
  }
}

/** Non-blocking — the dispatcher decides whether a driver already on an active route is fine. */
async function checkDriverActiveRouteWarning(
  tx: PrismaTransactionClient,
  tenantId: string,
  driverId: string,
): Promise<string | undefined> {
  const active = await tx.org_dlv_routes_mst.findFirst({
    where: { tenant_org_id: tenantId, driver_id: driverId, route_status_code: 'in_progress' },
    select: { route_number: true },
  });
  return active ? `Driver is already running route ${active.route_number}.` : undefined;
}

/** Tenant's default/most recent active address for the order's customer. Always returns a non-empty address (DB column is NOT NULL). */
async function resolveOrderAddress(
  tx: PrismaTransactionClient,
  tenantId: string,
  customerId: string | null,
): Promise<ResolvedAddress> {
  if (!customerId) return { address: NO_ADDRESS_ON_FILE, contactName: null, contactPhone: null };

  const [addr, customer] = await Promise.all([
    tx.org_customer_addresses.findFirst({
      where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      select: {
        label: true, building: true, floor: true, apartment: true,
        street: true, area: true, city: true, country: true,
        postal_code: true, delivery_notes: true,
      },
    }),
    tx.org_customers_mst.findFirst({
      where: { id: customerId, tenant_org_id: tenantId },
      select: { name: true, phone: true },
    }),
  ]);

  const contactName = customer?.name ?? null;
  const contactPhone = customer?.phone ?? null;
  if (!addr) return { address: NO_ADDRESS_ON_FILE, contactName, contactPhone };

  const parts = [
    addr.label, addr.building,
    addr.floor ? `Floor ${addr.floor}` : null,
    addr.apartment ? `Apt ${addr.apartment}` : null,
    addr.street, addr.area, addr.city, addr.country, addr.postal_code,
  ].filter(Boolean);
  const base = parts.join(', ');
  const address = addr.delivery_notes ? `${base}${base ? ' — ' : ''}${addr.delivery_notes}` : base;
  return { address: address || NO_ADDRESS_ON_FILE, contactName, contactPhone };
}

/**
 * Create a delivery route from ready orders in one tenant-scoped transaction.
 * Mirrors delivery-completion.service.ts's shape: idempotency claim/replay,
 * row locking, fail-closed validation naming the exact offending orders.
 *
 * @example
 * await createRoute({ tenantId, orderIds: [...], driverId, actorUserId, idempotencyKey });
 */
export async function createRoute(params: CreateRouteCommand): Promise<RouteCommandResult> {
  const orderIds = [...new Set(params.orderIds)];
  if (orderIds.length === 0) {
    throw new DeliveryRouteCommandError('NO_ORDERS_SELECTED', 'Select at least one order.', 400);
  }

  const payloadHash = hashPayload({
    orderIds: [...orderIds].sort(),
    driverId: params.driverId ?? null,
    startedAt: params.startedAt ? params.startedAt.toISOString() : null,
    estimatedDurationMinutes: params.estimatedDurationMinutes ?? null,
    totalDistanceKm: params.totalDistanceKm ?? null,
  });
  const claim = await claimIdempotencyKey(params.tenantId, params.idempotencyKey, ROUTE_CREATE_RESOURCE, payloadHash);

  if (claim.status === 'CONFLICT') {
    throw new DeliveryRouteCommandError('IDEMPOTENCY_CONFLICT', 'This idempotency key belongs to a different request.', 409);
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new DeliveryRouteCommandError('IDEMPOTENCY_IN_FLIGHT', 'Route creation is already being processed. Retry shortly.', 409);
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey, ROUTE_CREATE_RESOURCE);
    if (replay) return replay;
    throw new DeliveryRouteCommandError('IDEMPOTENCY_IN_FLIGHT', 'Route creation is still finalizing. Retry shortly.', 409);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await lockCandidateOrders(tx, params.tenantId, orderIds);
      const { branchId } = assertOrdersEligible(orderIds, locked);
      await assertOrdersNotAlreadyBooked(tx, params.tenantId, orderIds);

      let driverWarning: string | undefined;
      if (params.driverId) {
        await lockDriver(tx, params.tenantId, params.driverId);
        driverWarning = await checkDriverActiveRouteWarning(tx, params.tenantId, params.driverId);
      }

      const routeNumber = await nextRouteNumber(tx, params.tenantId);
      const now = new Date();

      const route = await tx.org_dlv_routes_mst.create({
        data: {
          tenant_org_id: params.tenantId,
          branch_id: branchId,
          route_number: routeNumber,
          driver_id: params.driverId ?? null,
          route_status_code: params.driverId ? 'in_progress' : 'planned',
          total_stops: orderIds.length,
          completed_stops: 0,
          started_at: params.startedAt ?? null,
          estimated_duration_minutes: params.estimatedDurationMinutes ?? null,
          total_distance_km: params.totalDistanceKm ?? null,
          created_at: now,
          created_by: params.actorUserId,
        },
        select: { id: true },
      });

      const stopIds: string[] = [];
      for (let i = 0; i < orderIds.length; i += 1) {
        const order = locked.find((o) => o.id === orderIds[i])!;
        const resolved = await resolveOrderAddress(tx, params.tenantId, order.customer_id);
        const stop = await tx.org_dlv_stops_dtl.create({
          data: {
            tenant_org_id: params.tenantId,
            route_id: route.id,
            order_id: order.id,
            branch_id: branchId,
            sequence: i + 1,
            address: resolved.address,
            contact_name: resolved.contactName,
            contact_phone: resolved.contactPhone,
            stop_status_code: 'pending',
            created_at: now,
            created_by: params.actorUserId,
          },
          select: { id: true },
        });
        stopIds.push(stop.id);
      }

      const commandResult: RouteCommandResult = { routeId: route.id, routeNumber, stopIds, driverWarning };
      await tx.org_idempotency_keys.updateMany({
        where: { tenant_org_id: params.tenantId, key: params.idempotencyKey, resource_type: ROUTE_CREATE_RESOURCE },
        data: {
          resource_id: route.id,
          response_cache: { payload_hash: payloadHash, result: commandResult } as unknown as Prisma.InputJsonValue,
        },
      });
      return commandResult;
    });

    logger.info('Delivery route created', {
      tenantId: params.tenantId, routeId: result.routeId, orderCount: orderIds.length,
      feature: 'delivery', action: 'create_route',
    });
    return result;
  } catch (error) {
    await deleteIdempotencyHash(params.tenantId, params.idempotencyKey, ROUTE_CREATE_RESOURCE);
    throw error;
  }
}

/**
 * Add more ready orders to a not-yet-started route. Same eligibility and
 * branch-consistency rules as create; sequence continues from the route's max.
 */
export async function addOrdersToRoute(params: AddOrdersToRouteCommand): Promise<RouteCommandResult> {
  const orderIds = [...new Set(params.orderIds)];
  if (orderIds.length === 0) {
    throw new DeliveryRouteCommandError('NO_ORDERS_SELECTED', 'Select at least one order.', 400);
  }

  const payloadHash = hashPayload({ routeId: params.routeId, orderIds: [...orderIds].sort() });
  const claim = await claimIdempotencyKey(params.tenantId, params.idempotencyKey, ROUTE_ADD_ORDERS_RESOURCE, payloadHash);
  if (claim.status === 'CONFLICT') {
    throw new DeliveryRouteCommandError('IDEMPOTENCY_CONFLICT', 'This idempotency key belongs to a different request.', 409);
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new DeliveryRouteCommandError('IDEMPOTENCY_IN_FLIGHT', 'This request is already being processed. Retry shortly.', 409);
  }
  if (claim.status === 'COMPLETED') {
    const replay = await loadReplay(params.tenantId, params.idempotencyKey, ROUTE_ADD_ORDERS_RESOURCE);
    if (replay) return replay;
    throw new DeliveryRouteCommandError('IDEMPOTENCY_IN_FLIGHT', 'This request is still finalizing. Retry shortly.', 409);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const route = await lockRoute(tx, params.tenantId, params.routeId);
      if ((route.route_status_code ?? '').trim().toLowerCase() !== 'planned') {
        throw new DeliveryRouteCommandError('ROUTE_NOT_PLANNED', 'Orders can only be added to a route that has not started yet.', 422);
      }

      const locked = await lockCandidateOrders(tx, params.tenantId, orderIds);
      assertOrdersEligible(orderIds, locked, route.branch_id);
      await assertOrdersNotAlreadyBooked(tx, params.tenantId, orderIds);

      const maxSeq = await tx.org_dlv_stops_dtl.aggregate({
        where: { route_id: params.routeId, tenant_org_id: params.tenantId },
        _max: { sequence: true },
      });
      let nextSeq = (maxSeq._max.sequence ?? 0) + 1;
      const now = new Date();

      const stopIds: string[] = [];
      for (const order of locked) {
        const resolved = await resolveOrderAddress(tx, params.tenantId, order.customer_id);
        const stop = await tx.org_dlv_stops_dtl.create({
          data: {
            tenant_org_id: params.tenantId,
            route_id: params.routeId,
            order_id: order.id,
            branch_id: route.branch_id,
            sequence: nextSeq,
            address: resolved.address,
            contact_name: resolved.contactName,
            contact_phone: resolved.contactPhone,
            stop_status_code: 'pending',
            created_at: now,
            created_by: params.actorUserId,
          },
          select: { id: true },
        });
        stopIds.push(stop.id);
        nextSeq += 1;
      }

      await tx.org_dlv_routes_mst.update({
        where: { id_tenant_org_id: { id: params.routeId, tenant_org_id: params.tenantId } },
        data: {
          total_stops: (route.total_stops ?? 0) + orderIds.length,
          updated_at: now,
          updated_by: params.actorUserId,
        },
      });

      const commandResult: RouteCommandResult = { routeId: params.routeId, routeNumber: route.route_number, stopIds };
      await tx.org_idempotency_keys.updateMany({
        where: { tenant_org_id: params.tenantId, key: params.idempotencyKey, resource_type: ROUTE_ADD_ORDERS_RESOURCE },
        data: {
          resource_id: params.routeId,
          response_cache: { payload_hash: payloadHash, result: commandResult } as unknown as Prisma.InputJsonValue,
        },
      });
      return commandResult;
    });

    logger.info('Orders added to delivery route', {
      tenantId: params.tenantId, routeId: params.routeId, orderCount: orderIds.length,
      feature: 'delivery', action: 'add_orders_to_route',
    });
    return result;
  } catch (error) {
    await deleteIdempotencyHash(params.tenantId, params.idempotencyKey, ROUTE_ADD_ORDERS_RESOURCE);
    throw error;
  }
}

/** Remove one not-yet-delivered stop from a not-yet-started route; its order returns to the unassigned pool. */
export async function removeStopFromRoute(params: RemoveStopFromRouteCommand): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const route = await lockRoute(tx, params.tenantId, params.routeId);
    if ((route.route_status_code ?? '').trim().toLowerCase() !== 'planned') {
      throw new DeliveryRouteCommandError('ROUTE_NOT_PLANNED', 'Stops can only be removed from a route that has not started yet.', 422);
    }

    const now = new Date();
    const updated = await tx.org_dlv_stops_dtl.updateMany({
      where: {
        id: params.stopId,
        tenant_org_id: params.tenantId,
        route_id: params.routeId,
        stop_status_code: { notIn: ['cancelled', 'delivered'] },
      },
      data: { stop_status_code: 'cancelled', is_active: false, updated_at: now, updated_by: params.actorUserId },
    });
    if (updated.count !== 1) {
      throw new DeliveryRouteCommandError('STOP_NOT_FOUND', 'Delivery stop was not found or already resolved.', 404);
    }

    await tx.org_dlv_routes_mst.update({
      where: { id_tenant_org_id: { id: params.routeId, tenant_org_id: params.tenantId } },
      data: { total_stops: Math.max((route.total_stops ?? 1) - 1, 0), updated_at: now, updated_by: params.actorUserId },
    });
  });

  logger.info('Stop removed from delivery route', {
    tenantId: params.tenantId, routeId: params.routeId, stopId: params.stopId,
    feature: 'delivery', action: 'remove_stop_from_route',
  });
}

/**
 * Cancel a route that has not fully completed. Every non-delivered stop is
 * cancelled and its order returns to the unassigned pool; already-delivered
 * stops are untouched — a route can't un-deliver an order.
 */
export async function cancelRoute(params: CancelRouteCommand): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const route = await lockRoute(tx, params.tenantId, params.routeId);
    const status = (route.route_status_code ?? '').trim().toLowerCase();
    if (!['planned', 'in_progress'].includes(status)) {
      throw new DeliveryRouteCommandError('ROUTE_NOT_EDITABLE', 'Only a planned or in-progress route can be cancelled.', 422);
    }

    const now = new Date();
    await tx.org_dlv_stops_dtl.updateMany({
      where: {
        route_id: params.routeId,
        tenant_org_id: params.tenantId,
        stop_status_code: { notIn: ['cancelled', 'delivered'] },
      },
      data: { stop_status_code: 'cancelled', is_active: false, updated_at: now, updated_by: params.actorUserId },
    });
    await tx.org_dlv_routes_mst.update({
      where: { id_tenant_org_id: { id: params.routeId, tenant_org_id: params.tenantId } },
      data: {
        route_status_code: 'cancelled',
        rec_notes: params.reason?.slice(0, 200) ?? null,
        updated_at: now,
        updated_by: params.actorUserId,
      },
    });
  });

  logger.info('Delivery route cancelled', {
    tenantId: params.tenantId, routeId: params.routeId, feature: 'delivery', action: 'cancel_route',
  });
}

/** Assign or reassign a driver. Not blocked by an existing active route for that driver — surfaced as a warning instead. */
export async function assignDriver(params: AssignDriverCommand): Promise<AssignDriverResult> {
  const result = await prisma.$transaction(async (tx) => {
    const route = await lockRoute(tx, params.tenantId, params.routeId);
    const status = (route.route_status_code ?? '').trim().toLowerCase();
    if (['completed', 'cancelled'].includes(status)) {
      throw new DeliveryRouteCommandError('ROUTE_NOT_EDITABLE', 'This route is already completed or cancelled.', 422);
    }

    await lockDriver(tx, params.tenantId, params.driverId);
    const driverWarning = await checkDriverActiveRouteWarning(tx, params.tenantId, params.driverId);

    const now = new Date();
    await tx.org_dlv_routes_mst.update({
      where: { id_tenant_org_id: { id: params.routeId, tenant_org_id: params.tenantId } },
      data: { driver_id: params.driverId, updated_at: now, updated_by: params.actorUserId },
    });

    return { routeId: params.routeId, driverId: params.driverId, driverWarning };
  });

  logger.info('Driver assigned to delivery route', {
    tenantId: params.tenantId, routeId: params.routeId, driverId: params.driverId,
    feature: 'delivery', action: 'assign_driver',
  });
  return result;
}
