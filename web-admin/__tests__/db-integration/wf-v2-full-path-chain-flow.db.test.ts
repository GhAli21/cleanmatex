/**
 * T01 — Walk-in happy path to ready, full plant chain.
 *
 * Proves the real engine walks a quick-drop staff order end to end against
 * `WF_V2_FULL_PATH` v1 (0495 seed + 0496 ownership/hold/reachability fix):
 * draft -> intake -> preparing -> processing -> assembly -> qa -> packing ->
 * ready, one `executeAction` call per real configured transition, each
 * advancing `state_version` and writing `org_order_history`. Closes the T01
 * gap noted in `12_Test_Plan.md` — until now no single test followed an order
 * through the whole plant chain; each stage had only its own isolated test.
 *
 * Local DB only. Skips when WF_V2_FULL_PATH v1 (0495/0496) is not applied
 * locally.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { executeAction, listAvailableActions } from '@/lib/services/workflow/workflow-engine.service';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR = '98ed3f07-7bbb-4af1-a5cc-c901c625ef2c';

// WF_V2_FULL_PATH v1 (PILOT) — seeded by 0495, fixed by 0496 (single-owner
// per status, draft->intake reachability, HOLD_ORDER_WORK from every claimed
// plant status). See docs/features/Workflow_Order_Advance/current_status.md.
const FULL_PATH_PROFILE_ID = 'a1000000-0000-4000-8000-000000000075';
const FULL_PATH_VERSION_NO = 1;
const FULL_PATH_VERSION_ID = 'a1000000-0000-4000-8000-000000000076';

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM public.sys_wf_profile_ver_mst
        WHERE version_id = ${FULL_PATH_VERSION_ID}::uuid
      ) AS ready
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
      console.warn(`[wf-v2-full-path-chain-flow] WF_V2_FULL_PATH v1 (0495/0496) not applied locally - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

interface ChainSeed {
  customerId: string;
  orderId: string;
}

async function seedOrder(): Promise<ChainSeed> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${`Full path chain DB test ${randomUUID()}`})
    RETURNING id
  `;
  const order = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (
      tenant_org_id, customer_id, order_no, currency_code, status, current_status,
      state_version, payment_type_code, total_amount, outstanding_amount,
      wf_profile_id, wf_version_no, wf_profile_version_id
    ) VALUES (
      ${DEMO_TENANT}::uuid,
      ${customer[0].id}::uuid,
      ${`FP-DB-${randomUUID()}`},
      'OMR',
      'draft',
      'draft',
      1,
      'PAY_IN_ADVANCE',
      10,
      0,
      ${FULL_PATH_PROFILE_ID}::uuid,
      ${FULL_PATH_VERSION_NO},
      ${FULL_PATH_VERSION_ID}::uuid
    )
    RETURNING id
  `;
  return { customerId: customer[0].id, orderId: order[0].id };
}

async function cleanup(seed: ChainSeed): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM public.org_order_history
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND order_id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_orders_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ${seed.orderId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.org_customers_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND id = ${seed.customerId}::uuid
  `;
}

/** One real chain step: discover via the owning screen, then execute. */
async function step(params: {
  orderId: string;
  screen: string;
  actionCode: string;
  expectToStatus: string;
}): Promise<void> {
  const available = await listAvailableActions({
    tenantId: DEMO_TENANT,
    orderId: params.orderId,
    screen: params.screen,
    channel: 'staff_web',
    actorUserId: ACTOR,
  });

  const matching = available.actions.find((action) => action.actionCode === params.actionCode);
  expect(matching).toBeDefined();

  const result = await executeAction({
    tenantId: DEMO_TENANT,
    orderId: params.orderId,
    screen: params.screen,
    actionCode: params.actionCode,
    expectedStateVersion: available.stateVersion,
    actorUserId: ACTOR,
    actorName: 'T01 Chain Test',
    channel: 'staff_web',
    idempotencyKey: `wf-v2-full-path-chain:${params.orderId}:${params.actionCode}:${params.expectToStatus}`,
  });

  expect(result.ok).toBe(true);
  expect(result.currentStatus).toBe(params.expectToStatus);
  expect(result.stateVersion).toBe(available.stateVersion + 1);
}

describe('WF_V2_FULL_PATH v1 — full plant chain (T01)', () => {
  dbit('walks draft -> intake -> preparing -> processing -> assembly -> qa -> packing -> ready', async () => {
    const seed = await seedOrder();
    try {
      await step({ orderId: seed.orderId, screen: 'new_order', actionCode: 'CONFIRM_PHYSICAL_INTAKE', expectToStatus: 'intake' });
      await step({ orderId: seed.orderId, screen: 'new_order', actionCode: 'CONFIRM_PHYSICAL_INTAKE', expectToStatus: 'preparing' });
      await step({ orderId: seed.orderId, screen: 'preparation', actionCode: 'COMPLETE_PREPARATION', expectToStatus: 'processing' });
      await step({ orderId: seed.orderId, screen: 'processing', actionCode: 'COMPLETE_PROCESSING', expectToStatus: 'assembly' });
      await step({ orderId: seed.orderId, screen: 'assembly', actionCode: 'COMPLETE_ASSEMBLY', expectToStatus: 'qa' });
      await step({ orderId: seed.orderId, screen: 'qa', actionCode: 'PASS_QA', expectToStatus: 'packing' });
      await step({ orderId: seed.orderId, screen: 'packing', actionCode: 'COMPLETE_PACKING', expectToStatus: 'ready' });

      const finalOrder = await prisma.org_orders_mst.findFirst({
        where: { id: seed.orderId, tenant_org_id: DEMO_TENANT },
        select: { current_status: true, state_version: true },
      });
      expect(finalOrder?.current_status).toBe('ready');
      expect(finalOrder?.state_version).toBe(8);

      // A DB trigger writes one ORDER_CREATED row on insert; the engine writes
      // one STATUS_CHANGE row per executed transition (7 here).
      const historyRows = await prisma.org_order_history.findMany({
        where: { tenant_org_id: DEMO_TENANT, order_id: seed.orderId },
        select: { action_type: true, from_value: true, to_value: true },
        orderBy: { done_at: 'asc' },
      });
      expect(historyRows).toEqual([
        { action_type: 'ORDER_CREATED', from_value: null, to_value: 'draft' },
        { action_type: 'STATUS_CHANGE', from_value: 'draft', to_value: 'intake' },
        { action_type: 'STATUS_CHANGE', from_value: 'intake', to_value: 'preparing' },
        { action_type: 'STATUS_CHANGE', from_value: 'preparing', to_value: 'processing' },
        { action_type: 'STATUS_CHANGE', from_value: 'processing', to_value: 'assembly' },
        { action_type: 'STATUS_CHANGE', from_value: 'assembly', to_value: 'qa' },
        { action_type: 'STATUS_CHANGE', from_value: 'qa', to_value: 'packing' },
        { action_type: 'STATUS_CHANGE', from_value: 'packing', to_value: 'ready' },
      ]);
    } finally {
      await cleanup(seed);
    }
  });
});
