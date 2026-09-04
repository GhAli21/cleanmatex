/**
 * Delivery route-planning command DB integration tests.
 *
 * Proves branch consistency, tenant isolation, order eligibility, the
 * NOT-NULL address fallback, idempotent replay, add/remove/cancel lifecycle,
 * driver assignment, and the double-booking backstop (both the app-level
 * check under real concurrency and the partial unique index itself) against
 * the real local database.
 *
 * Local DB only. The suite skips until migration 0490's objects exist.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  createRoute,
  addOrdersToRoute,
  removeStopFromRoute,
  cancelRoute,
  assignDriver,
  DeliveryRouteCommandError,
} from '@/lib/services/delivery/delivery-route-command.service';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR = '98ed3f07-7bbb-4af1-a5cc-c901c625ef2c';
const NO_ADDRESS_ON_FILE = 'No address on file — contact customer for pickup/delivery location';

let dbReady = false;
let otherTenantId: string | null = null;
let branchIds: string[] = [];

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[delivery-route-command-db] Local DB is unavailable or migration 0490 objects are missing - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT
        to_regclass('public.org_drivers_mst') IS NOT NULL
        AND to_regclass('public.org_dlv_route_seq_cf') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'uq_dlv_stops_active_order'
        ) AS ready
    `;
    dbReady = readiness[0]?.ready === true;
    if (dbReady) {
      const other = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_tenants_mst WHERE id <> ${DEMO_TENANT}::uuid LIMIT 1
      `;
      otherTenantId = other[0]?.id ?? null;

      const branches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_branches_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid LIMIT 2
      `;
      branchIds = branches.map((b) => b.id);
    }
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

interface SeededOrder {
  customerId: string;
  orderId: string;
}

async function seedOrder(opts?: {
  branchId?: string | null;
  currentStatus?: string;
  withAddress?: boolean;
}): Promise<SeededOrder> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name, phone)
    VALUES (${DEMO_TENANT}::uuid, ${`Route DB test ${randomUUID()}`}, '99999999')
    RETURNING id
  `;
  if (opts?.withAddress !== false) {
    await prisma.$executeRaw`
      INSERT INTO public.org_customer_addresses (
        tenant_org_id, customer_id, label, city, is_active, is_default
      ) VALUES (
        ${DEMO_TENANT}::uuid, ${customer[0].id}::uuid, 'Home', 'Muscat', true, true
      )
    `;
  }
  const status = opts?.currentStatus ?? 'out_for_delivery';
  const branchId = opts?.branchId ?? null;
  const order = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (
      tenant_org_id, customer_id, branch_id, order_no, currency_code,
      status, current_status, state_version, payment_type_code, total_amount, outstanding_amount
    ) VALUES (
      ${DEMO_TENANT}::uuid, ${customer[0].id}::uuid, ${branchId}::uuid,
      ${`RTC-DB-${randomUUID()}`}, 'OMR', ${status}, ${status}, 1, 'PAY_IN_ADVANCE', 12, 0
    )
    RETURNING id
  `;
  return { customerId: customer[0].id, orderId: order[0].id };
}

async function seedDriver(opts?: { isActive?: boolean }): Promise<string> {
  const driver = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_drivers_mst (tenant_org_id, name, is_active)
    VALUES (${DEMO_TENANT}::uuid, ${`Driver DB test ${randomUUID()}`}, ${opts?.isActive ?? true})
    RETURNING id
  `;
  return driver[0].id;
}

async function cleanupOrders(orders: SeededOrder[]): Promise<void> {
  const orderIds = orders.map((o) => o.orderId);
  const customerIds = orders.map((o) => o.customerId);
  if (orderIds.length === 0) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_dlv_stops_dtl WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND order_id = ANY(${orderIds}::uuid[])
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_orders_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ANY(${orderIds}::uuid[])
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_customer_addresses WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND customer_id = ANY(${customerIds}::uuid[])
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_customers_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ANY(${customerIds}::uuid[])
  `;
}

async function cleanupRoutes(routeIds: string[]): Promise<void> {
  if (routeIds.length === 0) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_dlv_stops_dtl WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND route_id = ANY(${routeIds}::uuid[])
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_dlv_routes_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ANY(${routeIds}::uuid[])
  `;
}

async function cleanupDrivers(driverIds: string[]): Promise<void> {
  if (driverIds.length === 0) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_drivers_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ANY(${driverIds}::uuid[])
  `;
}

async function cleanupIdempotencyKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await prisma.$executeRaw`
    DELETE FROM public.org_idempotency_keys WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND key = ANY(${keys}::text[])
  `;
}

describe('delivery route-planning command database invariants', () => {
  dbit('creates a route with stops in sequence and resolves the customer address', async () => {
    const a = await seedOrder();
    const b = await seedOrder({ withAddress: false });
    const key = `route-db-${randomUUID()}`;
    let result: Awaited<ReturnType<typeof createRoute>> | undefined;
    try {
      result = await createRoute({
        tenantId: DEMO_TENANT,
        orderIds: [a.orderId, b.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      });
      expect(result.stopIds).toHaveLength(2);

      const stops = await prisma.org_dlv_stops_dtl.findMany({
        where: { route_id: result.routeId, tenant_org_id: DEMO_TENANT },
        orderBy: { sequence: 'asc' },
        select: { order_id: true, sequence: true, address: true, stop_status_code: true },
      });
      expect(stops.map((s) => s.order_id)).toEqual([a.orderId, b.orderId]);
      expect(stops[0].sequence).toBe(1);
      expect(stops[0].address).not.toBe(NO_ADDRESS_ON_FILE);
      expect(stops[1].address).toBe(NO_ADDRESS_ON_FILE);
      expect(stops.every((s) => s.stop_status_code === 'pending')).toBe(true);

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: result.routeId, tenant_org_id: DEMO_TENANT },
        select: { total_stops: true, route_status_code: true },
      });
      expect(route?.total_stops).toBe(2);
      expect(route?.route_status_code).toBe('planned');
    } finally {
      await cleanupIdempotencyKeys([key]);
      if (result) await cleanupRoutes([result.routeId]);
      await cleanupOrders([a, b]);
    }
  });

  dbit('rejects a mixed-branch batch and creates nothing', async () => {
    if (branchIds.length < 2) {
      console.warn('[delivery-route-command-db] Fewer than 2 branches on the demo tenant - skipping branch-mismatch case');
      return;
    }
    const a = await seedOrder({ branchId: branchIds[0] });
    const b = await seedOrder({ branchId: branchIds[1] });
    const key = `route-db-${randomUUID()}`;
    try {
      await expect(createRoute({
        tenantId: DEMO_TENANT,
        orderIds: [a.orderId, b.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      })).rejects.toMatchObject<Partial<DeliveryRouteCommandError>>({ code: 'BRANCH_MISMATCH' });

      const routeCount = await prisma.org_dlv_routes_mst.count({
        where: { tenant_org_id: DEMO_TENANT, org_dlv_stops_dtl: { some: { order_id: { in: [a.orderId, b.orderId] } } } },
      });
      expect(routeCount).toBe(0);
    } finally {
      await cleanupIdempotencyKeys([key]);
      await cleanupOrders([a, b]);
    }
  });

  dbit('rejects an order that is not out_for_delivery', async () => {
    const a = await seedOrder({ currentStatus: 'processing' });
    const key = `route-db-${randomUUID()}`;
    try {
      await expect(createRoute({
        tenantId: DEMO_TENANT,
        orderIds: [a.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      })).rejects.toMatchObject<Partial<DeliveryRouteCommandError>>({ code: 'ORDER_NOT_ELIGIBLE' });
    } finally {
      await cleanupIdempotencyKeys([key]);
      await cleanupOrders([a]);
    }
  });

  dbit('does not let one tenant create a route from another tenant order', async () => {
    if (!otherTenantId) {
      console.warn('[delivery-route-command-db] No second tenant available - skipping isolation case');
      return;
    }
    const a = await seedOrder();
    const key = `route-db-${randomUUID()}`;
    try {
      await expect(createRoute({
        tenantId: otherTenantId,
        orderIds: [a.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      })).rejects.toMatchObject<Partial<DeliveryRouteCommandError>>({ code: 'ORDER_NOT_FOUND' });
    } finally {
      await cleanupIdempotencyKeys([key]);
      await cleanupOrders([a]);
    }
  });

  dbit('replays the same idempotency key without a second route', async () => {
    const a = await seedOrder();
    const key = `route-db-${randomUUID()}`;
    let routeId: string | undefined;
    try {
      const first = await createRoute({
        tenantId: DEMO_TENANT,
        orderIds: [a.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      });
      routeId = first.routeId;
      const replay = await createRoute({
        tenantId: DEMO_TENANT,
        orderIds: [a.orderId],
        actorUserId: ACTOR,
        idempotencyKey: key,
      });
      expect(replay.routeId).toBe(first.routeId);
      expect(replay.stopIds).toEqual(first.stopIds);

      const stopCount = await prisma.org_dlv_stops_dtl.count({
        where: { tenant_org_id: DEMO_TENANT, order_id: a.orderId },
      });
      expect(stopCount).toBe(1);
    } finally {
      await cleanupIdempotencyKeys([key]);
      if (routeId) await cleanupRoutes([routeId]);
      await cleanupOrders([a]);
    }
  });

  dbit('serializes two concurrent routes racing over the same order', async () => {
    const shared = await seedOrder();
    const onlyA = await seedOrder();
    const onlyB = await seedOrder();
    const keyA = `route-db-${randomUUID()}`;
    const keyB = `route-db-${randomUUID()}`;
    let routeIdA: string | undefined;
    let routeIdB: string | undefined;
    try {
      const settled = await Promise.allSettled([
        createRoute({ tenantId: DEMO_TENANT, orderIds: [onlyA.orderId, shared.orderId], actorUserId: ACTOR, idempotencyKey: keyA }),
        createRoute({ tenantId: DEMO_TENANT, orderIds: [onlyB.orderId, shared.orderId], actorUserId: ACTOR, idempotencyKey: keyB }),
      ]);

      const wins = settled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createRoute>>> => r.status === 'fulfilled');
      const losses = settled.filter((r) => r.status === 'rejected');
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      if (losses[0].status === 'rejected') {
        expect(losses[0].reason).toBeInstanceOf(DeliveryRouteCommandError);
        expect((losses[0].reason as DeliveryRouteCommandError).code).toBe('ORDER_ALREADY_ON_ROUTE');
      }
      if (wins[0]) routeIdA = wins[0].value.routeId;

      const activeStops = await prisma.org_dlv_stops_dtl.count({
        where: {
          tenant_org_id: DEMO_TENANT,
          order_id: shared.orderId,
          stop_status_code: { notIn: ['cancelled', 'failed'] },
        },
      });
      expect(activeStops).toBe(1);
    } finally {
      await cleanupIdempotencyKeys([keyA, keyB]);
      await cleanupRoutes([routeIdA, routeIdB].filter((id): id is string => Boolean(id)));
      await cleanupOrders([shared, onlyA, onlyB]);
    }
  });

  dbit('rejects a second active stop for the same order at the database layer', async () => {
    const a = await seedOrder();
    const route = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.org_dlv_routes_mst (tenant_org_id, route_number, route_status_code, total_stops, completed_stops)
      VALUES (${DEMO_TENANT}::uuid, ${`RT-DB-${randomUUID()}`}, 'planned', 1, 0)
      RETURNING id
    `;
    try {
      await prisma.$executeRaw`
        INSERT INTO public.org_dlv_stops_dtl (tenant_org_id, route_id, order_id, sequence, address, stop_status_code)
        VALUES (${DEMO_TENANT}::uuid, ${route[0].id}::uuid, ${a.orderId}::uuid, 1, 'Stop 1', 'pending')
      `;
      await expect(prisma.$executeRaw`
        INSERT INTO public.org_dlv_stops_dtl (tenant_org_id, route_id, order_id, sequence, address, stop_status_code)
        VALUES (${DEMO_TENANT}::uuid, ${route[0].id}::uuid, ${a.orderId}::uuid, 2, 'Stop 2 (duplicate)', 'pending')
      `).rejects.toMatchObject({ code: 'P2010' });
    } finally {
      await cleanupRoutes([route[0].id]);
      await cleanupOrders([a]);
    }
  });

  dbit('adds orders to a planned route and rejects once the route is no longer planned', async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const c = await seedOrder();
    const driverId = await seedDriver();
    const keyPlanned = `route-db-${randomUUID()}`;
    const keyAdd = `route-db-${randomUUID()}`;
    const keyStarted = `route-db-${randomUUID()}`;
    let plannedRouteId: string | undefined;
    let startedRouteId: string | undefined;
    try {
      const created = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [a.orderId], actorUserId: ACTOR, idempotencyKey: keyPlanned,
      });
      plannedRouteId = created.routeId;

      const added = await addOrdersToRoute({
        tenantId: DEMO_TENANT, routeId: plannedRouteId, orderIds: [b.orderId], actorUserId: ACTOR, idempotencyKey: keyAdd,
      });
      expect(added.stopIds).toHaveLength(1);

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: plannedRouteId, tenant_org_id: DEMO_TENANT },
        select: { total_stops: true },
      });
      expect(route?.total_stops).toBe(2);

      // A driver assigned at creation time puts the route straight into
      // in_progress (createRoute's own rule) — the route is no longer editable.
      const started = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [c.orderId], driverId, actorUserId: ACTOR, idempotencyKey: keyStarted,
      });
      startedRouteId = started.routeId;
      const startedRoute = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: startedRouteId, tenant_org_id: DEMO_TENANT },
        select: { route_status_code: true },
      });
      expect(startedRoute?.route_status_code).toBe('in_progress');

      const d = await seedOrder();
      try {
        await expect(addOrdersToRoute({
          tenantId: DEMO_TENANT, routeId: startedRouteId, orderIds: [d.orderId], actorUserId: ACTOR, idempotencyKey: `route-db-${randomUUID()}`,
        })).rejects.toMatchObject<Partial<DeliveryRouteCommandError>>({ code: 'ROUTE_NOT_PLANNED' });
      } finally {
        await cleanupOrders([d]);
      }
    } finally {
      await cleanupIdempotencyKeys([keyPlanned, keyAdd, keyStarted]);
      await cleanupRoutes([plannedRouteId, startedRouteId].filter((id): id is string => Boolean(id)));
      await cleanupDrivers([driverId]);
      await cleanupOrders([a, b, c]);
    }
  });

  dbit('removes a stop from a planned route and decrements total_stops', async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const key = `route-db-${randomUUID()}`;
    let routeId: string | undefined;
    try {
      const created = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [a.orderId, b.orderId], actorUserId: ACTOR, idempotencyKey: key,
      });
      routeId = created.routeId;

      await removeStopFromRoute({
        tenantId: DEMO_TENANT, routeId, stopId: created.stopIds[0], actorUserId: ACTOR,
      });

      const removedStop = await prisma.org_dlv_stops_dtl.findFirst({
        where: { id: created.stopIds[0], tenant_org_id: DEMO_TENANT },
        select: { stop_status_code: true, is_active: true },
      });
      expect(removedStop?.stop_status_code).toBe('cancelled');
      expect(removedStop?.is_active).toBe(false);

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: routeId, tenant_org_id: DEMO_TENANT },
        select: { total_stops: true },
      });
      expect(route?.total_stops).toBe(1);
    } finally {
      await cleanupIdempotencyKeys([key]);
      if (routeId) await cleanupRoutes([routeId]);
      await cleanupOrders([a, b]);
    }
  });

  dbit('cancels a route, releasing non-delivered stops but leaving delivered ones untouched', async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const key = `route-db-${randomUUID()}`;
    let routeId: string | undefined;
    try {
      const created = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [a.orderId, b.orderId], actorUserId: ACTOR, idempotencyKey: key,
      });
      routeId = created.routeId;

      await prisma.$executeRaw`
        UPDATE public.org_dlv_stops_dtl SET stop_status_code = 'delivered'
        WHERE id = ${created.stopIds[0]}::uuid AND tenant_org_id = ${DEMO_TENANT}::uuid
      `;

      await cancelRoute({ tenantId: DEMO_TENANT, routeId, actorUserId: ACTOR, reason: 'DB test cancel' });

      const stops = await prisma.org_dlv_stops_dtl.findMany({
        where: { route_id: routeId, tenant_org_id: DEMO_TENANT },
        select: { id: true, stop_status_code: true },
      });
      const delivered = stops.find((s) => s.id === created.stopIds[0]);
      const pending = stops.find((s) => s.id === created.stopIds[1]);
      expect(delivered?.stop_status_code).toBe('delivered');
      expect(pending?.stop_status_code).toBe('cancelled');

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: routeId, tenant_org_id: DEMO_TENANT },
        select: { route_status_code: true },
      });
      expect(route?.route_status_code).toBe('cancelled');
    } finally {
      await cleanupIdempotencyKeys([key]);
      if (routeId) await cleanupRoutes([routeId]);
      await cleanupOrders([a, b]);
    }
  });

  dbit('assigns an active driver and rejects an inactive one', async () => {
    const a = await seedOrder();
    const key = `route-db-${randomUUID()}`;
    const activeDriver = await seedDriver({ isActive: true });
    const inactiveDriver = await seedDriver({ isActive: false });
    let routeId: string | undefined;
    try {
      const created = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [a.orderId], actorUserId: ACTOR, idempotencyKey: key,
      });
      routeId = created.routeId;

      const assigned = await assignDriver({ tenantId: DEMO_TENANT, routeId, driverId: activeDriver, actorUserId: ACTOR });
      expect(assigned.driverId).toBe(activeDriver);

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: routeId, tenant_org_id: DEMO_TENANT },
        select: { driver_id: true },
      });
      expect(route?.driver_id).toBe(activeDriver);

      await expect(assignDriver({
        tenantId: DEMO_TENANT, routeId, driverId: inactiveDriver, actorUserId: ACTOR,
      })).rejects.toMatchObject<Partial<DeliveryRouteCommandError>>({ code: 'DRIVER_INACTIVE' });
    } finally {
      await cleanupIdempotencyKeys([key]);
      if (routeId) await cleanupRoutes([routeId]);
      await cleanupDrivers([activeDriver, inactiveDriver]);
      await cleanupOrders([a]);
    }
  });

  dbit('warns instead of blocking when a driver already runs an in-progress route', async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const keyA = `route-db-${randomUUID()}`;
    const keyB = `route-db-${randomUUID()}`;
    const driverId = await seedDriver();
    let routeIdA: string | undefined;
    let routeIdB: string | undefined;
    try {
      const routeA = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [a.orderId], driverId, actorUserId: ACTOR, idempotencyKey: keyA,
      });
      routeIdA = routeA.routeId;
      await prisma.$executeRaw`
        UPDATE public.org_dlv_routes_mst SET route_status_code = 'in_progress'
        WHERE id = ${routeIdA}::uuid AND tenant_org_id = ${DEMO_TENANT}::uuid
      `;

      const routeB = await createRoute({
        tenantId: DEMO_TENANT, orderIds: [b.orderId], actorUserId: ACTOR, idempotencyKey: keyB,
      });
      routeIdB = routeB.routeId;

      const assigned = await assignDriver({ tenantId: DEMO_TENANT, routeId: routeIdB, driverId, actorUserId: ACTOR });
      expect(assigned.driverWarning).toBeDefined();

      const route = await prisma.org_dlv_routes_mst.findFirst({
        where: { id: routeIdB, tenant_org_id: DEMO_TENANT },
        select: { driver_id: true },
      });
      expect(route?.driver_id).toBe(driverId);
    } finally {
      await cleanupIdempotencyKeys([keyA, keyB]);
      await cleanupRoutes([routeIdA, routeIdB].filter((id): id is string => Boolean(id)));
      await cleanupDrivers([driverId]);
      await cleanupOrders([a, b]);
    }
  });
});
