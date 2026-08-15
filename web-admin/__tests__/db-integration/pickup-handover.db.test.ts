/**
 * Pickup handover DB integration tests.
 *
 * These tests intentionally use the real local Supabase database because the
 * atomic handover guarantee spans release rows, workflow status/history, and
 * the partial unique index added by migrations 0447/0448. Mocked Prisma tests
 * cannot prove those database invariants.
 *
 * Local DB only. The suite skips until 0447 and 0448 are applied locally.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  completePickup,
  PickupCompletionError,
} from '@/lib/services/pickup/pickup-completion.service';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR = '98ed3f07-7bbb-4af1-a5cc-c901c625ef2c';

let dbReady = false;

interface PickupSeed {
  customerId: string;
  orderId: string;
  idempotencyKey: string;
}

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT
        EXISTS (
          SELECT 1
          FROM public.sys_wf_statuses_cd
          WHERE status_code = 'ready_for_pickup'
            AND COALESCE(is_active, true) = true
        )
        AND to_regclass('public.uq_wf_rel_open_pickup') IS NOT NULL AS ready
    `;
    dbReady = readiness[0]?.ready === true;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[pickup-handover-db] Local DB is unavailable or 0447/0448 is not applied - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function seedOrder(currentStatus: 'ready' | 'ready_for_pickup'): Promise<PickupSeed> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${`Pickup DB test ${randomUUID()}`})
    RETURNING id
  `;
  const order = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (
      tenant_org_id,
      customer_id,
      order_no,
      currency_code,
      status,
      current_status,
      state_version,
      payment_type_code,
      total_amount,
      outstanding_amount
    ) VALUES (
      ${DEMO_TENANT}::uuid,
      ${customer[0].id}::uuid,
      ${`PICKUP-DB-${randomUUID()}`},
      'OMR',
      ${currentStatus},
      ${currentStatus},
      7,
      'PAY_IN_ADVANCE',
      1,
      0
    )
    RETURNING id
  `;
  return {
    customerId: customer[0].id,
    orderId: order[0].id,
    idempotencyKey: `pickup-db-${randomUUID()}`,
  };
}

async function cleanupSeed(seed: PickupSeed): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM public.org_idempotency_keys
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND key IN (${seed.idempotencyKey}, ${`pickup:${seed.idempotencyKey}`})
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_domain_events_outbox
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND aggregate_id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_order_history
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND order_id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_wf_release_ln
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND release_id IN (
        SELECT id
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND order_id = ${seed.orderId}::uuid
      )
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_wf_release_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND order_id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_orders_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_customers_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid
      AND id = ${seed.customerId}::uuid
  `;
}

async function createReleasedPickup(seed: PickupSeed): Promise<string> {
  const releases = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_wf_release_mst (
      tenant_org_id,
      order_id,
      release_type,
      release_status,
      released_at,
      released_by,
      state_version_at
    ) VALUES (
      ${DEMO_TENANT}::uuid,
      ${seed.orderId}::uuid,
      'pickup',
      'released',
      CURRENT_TIMESTAMP,
      ${ACTOR}::uuid,
      8
    )
    RETURNING id
  `;
  return releases[0].id;
}

describe('pickup handover - live database invariants', () => {
  dbit('direct counter handover atomically creates a versioned fulfilled release and delivers the order', async () => {
    const seed = await seedOrder('ready');
    try {
      const result = await completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Live direct counter handover test.',
      });

      expect(result.workflow).toMatchObject({ currentStatus: 'delivered', stateVersion: 8 });
      const release = await prisma.$queryRaw<Array<{
        release_status: string;
        state_version_at: bigint;
        fulfilled_by: string;
      }>>`
        SELECT release_status, state_version_at, fulfilled_by
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND order_id = ${seed.orderId}::uuid
          AND release_type = 'pickup'
      `;
      expect(release).toHaveLength(1);
      expect(release[0].release_status).toBe('fulfilled');
      expect(Number(release[0].state_version_at)).toBe(8);
      expect(release[0].fulfilled_by).toBe(ACTOR);

      const history = await prisma.$queryRaw<Array<{ handover_mode: string }>>`
        SELECT payload -> 'input' ->> 'handoverMode' AS handover_mode
        FROM public.org_order_history
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND order_id = ${seed.orderId}::uuid
          AND payload ->> 'actionCode' = 'CONFIRM_PICKUP'
      `;
      expect(history).toHaveLength(1);
      expect(history[0].handover_mode).toBe('direct');
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects ready_for_pickup without its release and writes no replacement audit record', async () => {
    const seed = await seedOrder('ready_for_pickup');
    try {
      await expect(completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
      })).rejects.toMatchObject<PickupCompletionError>({
        code: 'PICKUP_RELEASE_REQUIRED',
        httpStatus: 422,
      });

      const releaseCount = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND order_id = ${seed.orderId}::uuid
      `;
      expect(releaseCount[0].count).toBe(0);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('fulfils the existing release before delivering a staged pickup order', async () => {
    const seed = await seedOrder('ready_for_pickup');
    try {
      const releaseId = await createReleasedPickup(seed);
      const result = await completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Live released pickup handover test.',
      });

      expect(result).toMatchObject({
        releaseIds: [releaseId],
        workflow: { currentStatus: 'delivered', stateVersion: 8 },
      });
      const release = await prisma.$queryRaw<Array<{
        release_status: string;
        fulfilled_by: string;
      }>>`
        SELECT release_status, fulfilled_by
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND id = ${releaseId}::uuid
          AND order_id = ${seed.orderId}::uuid
      `;
      expect(release).toEqual([{ release_status: 'fulfilled', fulfilled_by: ACTOR }]);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('the database rejects duplicate active pickup releases for the same tenant order', async () => {
    const seed = await seedOrder('ready');
    try {
      await expect(prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO public.org_wf_release_mst (
            tenant_org_id, order_id, release_type, release_status, released_at, released_by
          ) VALUES (
            ${DEMO_TENANT}::uuid, ${seed.orderId}::uuid, 'pickup', 'released', CURRENT_TIMESTAMP, ${ACTOR}::uuid
          )
        `;
        await tx.$executeRaw`
          INSERT INTO public.org_wf_release_mst (
            tenant_org_id, order_id, release_type, release_status, released_at, released_by
          ) VALUES (
            ${DEMO_TENANT}::uuid, ${seed.orderId}::uuid, 'pickup', 'released', CURRENT_TIMESTAMP, ${ACTOR}::uuid
          )
        `;
      })).rejects.toThrow(/already exists|duplicate key/i);

      // A fulfilled release no longer occupies the partial unique-index slot.
      // This proves the invariant is scoped to open releases, not all history.
      const releaseId = await createReleasedPickup(seed);
      await prisma.$executeRaw`
        UPDATE public.org_wf_release_mst
        SET release_status = 'fulfilled',
            fulfilled_at = CURRENT_TIMESTAMP,
            fulfilled_by = ${ACTOR}::uuid
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND id = ${releaseId}::uuid
          AND order_id = ${seed.orderId}::uuid
          AND release_status = 'released'
      `;
      await createReleasedPickup(seed);

      const activeReleaseCount = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count
        FROM public.org_wf_release_mst
        WHERE tenant_org_id = ${DEMO_TENANT}::uuid
          AND order_id = ${seed.orderId}::uuid
          AND release_type = 'pickup'
          AND release_status = 'released'
          AND COALESCE(rec_status, 1) = 1
      `;
      expect(activeReleaseCount[0].count).toBe(1);
    } finally {
      await cleanupSeed(seed);
    }
  });
});
