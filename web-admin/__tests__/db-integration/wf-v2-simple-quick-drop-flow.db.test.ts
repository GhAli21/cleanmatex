/**
 * T04 — Quick drop -> prep complete, against the tenant's real live profile.
 *
 * `12_Test_Plan.md`'s T04 gap: the only existing coverage
 * (`workflow-engine.gates.test.ts` `'does not include sorting as an action'`)
 * proves `sorting` isn't a valid action code catalog-wide — it says nothing
 * about what a quick-drop order actually does. This test closes that with two
 * things neither prior test had:
 *
 * 1. Feeds `resolveInitialStatusFromSemanticRules` the REAL seeded
 *    `sys_wf_prof_ver_init_cf` rows for `WF_V2_SIMPLE` v4 (the tenant's real
 *    live/active profile — same version used by the S10 delivery canary),
 *    not a hand-written rule table. After `0499`, quick-drop resolves to
 *    `preparing` (bag is in hand; itemization is Preparation + Edit order).
 *    Typed staff orders still start at `processing`.
 * 2. Drives the real engine (`executeAction`) through the resolved chain —
 *    `preparing -> processing` (`COMPLETE_PREPARATION`) then
 *    `processing -> ready` (`COMPLETE_PROCESSING`) — on a quick-drop order
 *    pinned to the real `WF_V2_SIMPLE` v4 profile version, proving the real
 *    "prep complete" endpoint for this profile.
 *
 * Local DB only. Skips when `WF_V2_SIMPLE` v4 is not present locally.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { resolveInitialStatusFromSemanticRules } from '@/lib/services/workflow/initial-status-resolver.service';
import { executeAction, listAvailableActions } from '@/lib/services/workflow/workflow-engine.service';
import type { ResolvedWorkflowInitialRule } from '@/lib/services/workflow/workflow-profile-resolution.service';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR = '98ed3f07-7bbb-4af1-a5cc-c901c625ef2c';

// WF_V2_SIMPLE v4 (PILOT) — the tenant's real live profile assignment (S10
// canary reference). See docs/features/Workflow_Order_Advance/current_status.md.
const SIMPLE_PROFILE_ID = 'a1000000-0000-4000-8000-000000000011';
const SIMPLE_VERSION_NO = 4;
const SIMPLE_VERSION_ID = 'a1000000-0000-4000-8000-000000000014';

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM public.sys_wf_profile_ver_mst WHERE version_id = ${SIMPLE_VERSION_ID}::uuid
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
      console.warn(`[wf-v2-simple-quick-drop-flow] WF_V2_SIMPLE v4 not applied locally - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function loadRealInitRules(): Promise<ResolvedWorkflowInitialRule[]> {
  return prisma.$queryRaw<ResolvedWorkflowInitialRule[]>`
    SELECT
      rule_code, order_source_code, order_type_id, is_retail, is_quick_drop,
      initial_status, priority, create_preset_code
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = ${SIMPLE_VERSION_ID}::uuid
    ORDER BY priority, rule_code
  `;
}

interface OrderSeed {
  customerId: string;
  orderId: string;
}

async function seedOrder(initialStatus: string): Promise<OrderSeed> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${`Quick drop DB test ${randomUUID()}`})
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
      ${`QD-DB-${randomUUID()}`},
      'OMR',
      ${initialStatus},
      ${initialStatus},
      1,
      'PAY_IN_ADVANCE',
      10,
      0,
      ${SIMPLE_PROFILE_ID}::uuid,
      ${SIMPLE_VERSION_NO},
      ${SIMPLE_VERSION_ID}::uuid
    )
    RETURNING id
  `;
  return { customerId: customer[0].id, orderId: order[0].id };
}

async function cleanup(seed: OrderSeed): Promise<void> {
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

describe('WF_V2_SIMPLE v4 — quick drop real flow (T04)', () => {
  dbit('resolves a real quick-drop staff order to preparing, not processing, against the live seed', async () => {
    const rules = await loadRealInitRules();

    const quickDrop = resolveInitialStatusFromSemanticRules(rules, {
      orderSourceCode: 'web_admin',
      isRetail: false,
      isQuickDrop: true,
    });
    expect(quickDrop.initialStatus).toBe('preparing');
    expect(quickDrop.ruleCode).toBe('INIT_STAFF_QUICK_DROP');

    const standard = resolveInitialStatusFromSemanticRules(rules, {
      orderSourceCode: 'web_admin',
      isRetail: false,
      isQuickDrop: false,
    });
    expect(standard.initialStatus).toBe('processing');
    expect(standard.ruleCode).toBe('INIT_STAFF_PROCESSING');
  });

  dbit('drives a quick-drop order from preparing to ready via the real engine (prep complete)', async () => {
    const seed = await seedOrder('preparing');
    try {
      const toProcessing = await listAvailableActions({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'preparation',
        channel: 'staff_web',
        actorUserId: ACTOR,
      });
      const prepResult = await executeAction({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'preparation',
        actionCode: 'COMPLETE_PREPARATION',
        expectedStateVersion: toProcessing.stateVersion,
        actorUserId: ACTOR,
        actorName: 'T04 Quick Drop Test',
        channel: 'staff_web',
        idempotencyKey: `wf-v2-simple-quick-drop:${seed.orderId}:complete-prep`,
      });
      expect(prepResult.currentStatus).toBe('processing');

      const toReady = await listAvailableActions({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'processing',
        channel: 'staff_web',
        actorUserId: ACTOR,
      });
      const processingResult = await executeAction({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'processing',
        actionCode: 'COMPLETE_PROCESSING',
        expectedStateVersion: toReady.stateVersion,
        actorUserId: ACTOR,
        actorName: 'T04 Quick Drop Test',
        channel: 'staff_web',
        idempotencyKey: `wf-v2-simple-quick-drop:${seed.orderId}:complete-processing`,
      });
      expect(processingResult.currentStatus).toBe('ready');

      const finalOrder = await prisma.org_orders_mst.findFirst({
        where: { id: seed.orderId, tenant_org_id: DEMO_TENANT },
        select: { current_status: true },
      });
      expect(finalOrder?.current_status).toBe('ready');
    } finally {
      await cleanup(seed);
    }
  });

  dbit('lists leftover-intake CONFIRM_PHYSICAL_INTAKE on new_order and executes the compiled destination', async () => {
    const destination = await prisma.$queryRaw<Array<{ to_status: string }>>`
      SELECT to_status
      FROM public.sys_wf_prof_ver_exec_cf
      WHERE version_id = ${SIMPLE_VERSION_ID}::uuid
        AND screen_key = 'new_order'
        AND action_code = 'CONFIRM_PHYSICAL_INTAKE'
        AND from_status = 'intake'
        AND is_active = true
        AND rec_status = 1
    `;
    expect(destination).toHaveLength(1);

    const seed = await seedOrder('intake');
    try {
      const available = await listAvailableActions({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'new_order',
        channel: 'staff_web',
        actorUserId: ACTOR,
      });
      expect(available.actions.map((action) => action.actionCode)).toContain(
        'CONFIRM_PHYSICAL_INTAKE',
      );

      const result = await executeAction({
        tenantId: DEMO_TENANT,
        orderId: seed.orderId,
        screen: 'new_order',
        actionCode: 'CONFIRM_PHYSICAL_INTAKE',
        expectedStateVersion: available.stateVersion,
        actorUserId: ACTOR,
        actorName: 'SIMPLE leftover intake ActionBar',
        channel: 'staff_web',
        idempotencyKey: `wf-v2-simple-intake-new-order:${seed.orderId}`,
      });
      expect(result.currentStatus).toBe(destination[0].to_status);
    } finally {
      await cleanup(seed);
    }
  });
});
