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

interface LivePolicyBinding {
  profileId: string;
  versionNo: number;
  versionId: string;
}

const SIMPLE_LIVE: LivePolicyBinding = {
  profileId: 'a1000000-0000-4000-8000-000000000011',
  versionNo: 2,
  versionId: 'a1000000-0000-4000-8000-000000000013',
};

const STANDARD_LIVE: LivePolicyBinding = {
  profileId: 'a1000000-0000-4000-8000-000000000001',
  versionNo: 2,
  versionId: 'a1000000-0000-4000-8000-000000000003',
};

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

async function seedOrder(
  currentStatus: 'ready' | 'ready_for_pickup',
  binding?: LivePolicyBinding,
): Promise<PickupSeed> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${`Pickup DB test ${randomUUID()}`})
    RETURNING id
  `;
  const order = binding
    ? await prisma.$queryRaw<Array<{ id: string }>>`
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
          outstanding_amount,
          wf_profile_id,
          wf_version_no,
          wf_profile_version_id
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
          0,
          ${binding.profileId}::uuid,
          ${binding.versionNo},
          ${binding.versionId}::uuid
        )
        RETURNING id
      `
    : await prisma.$queryRaw<Array<{ id: string }>>`
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
  dbit('direct counter handover fails closed when the order has no live profile binding', async () => {
    const seed = await seedOrder('ready');
    try {
      await expect(completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Live direct counter handover test.',
      })).rejects.toMatchObject<PickupCompletionError>({
        code: 'PICKUP_POLICY_UNAVAILABLE',
        httpStatus: 422,
      });
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects ready_for_pickup without a live profile before manufacturing a replacement release', async () => {
    const seed = await seedOrder('ready_for_pickup');
    try {
      await expect(completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
      })).rejects.toMatchObject<PickupCompletionError>({
        code: 'PICKUP_POLICY_UNAVAILABLE',
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

  dbit('staged pickup fails closed when the order has no live profile binding', async () => {
    const seed = await seedOrder('ready_for_pickup');
    try {
      await createReleasedPickup(seed);
      await expect(completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Live released pickup handover test.',
      })).rejects.toMatchObject<PickupCompletionError>({
        code: 'PICKUP_POLICY_UNAVAILABLE',
        httpStatus: 422,
      });
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('direct counter handover from ready is rejected when live policy has the switch off', async () => {
    const seed = await seedOrder('ready', STANDARD_LIVE);
    try {
      await expect(completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Standard plant must stage pickup.',
      })).rejects.toMatchObject<PickupCompletionError>({
        code: 'PICKUP_DIRECT_NOT_ALLOWED',
        httpStatus: 422,
      });
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('direct counter handover from ready uses SIMPLE live policy instead of failing unbound', async () => {
    const seed = await seedOrder('ready', SIMPLE_LIVE);
    try {
      const result = await completePickup({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        actorUserId: ACTOR,
        actorName: 'Pickup DB Test',
        expectedStateVersion: 7,
        idempotencyKey: seed.idempotencyKey,
        handoverNotes: 'Lean counter direct handover.',
      });
      expect(result.releaseIds.length).toBeGreaterThan(0);
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
