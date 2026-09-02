/**
 * Gate-decision ledger (0473): live version id is enough; artifact id is optional.
 *
 * Local DB only. Skips when 0473 is not present.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const SIMPLE_PROFILE = 'a1000000-0000-4000-8000-000000000011';
const SIMPLE_V2 = 'a1000000-0000-4000-8000-000000000013';
const FINGERPRINT = 'a'.repeat(64);

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'org_wf_gate_decision_mst'
          AND column_name = 'profile_version_id'
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
      console.warn(`[wf-gate-decision-version-db] 0473 not applied locally - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function seedOrder(): Promise<{ customerId: string; orderId: string }> {
  const customer = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name)
    VALUES (${DEMO_TENANT}::uuid, ${`Gate decision DB ${randomUUID()}`})
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
      ${`WFGD-${randomUUID()}`},
      'OMR',
      'ready',
      'ready',
      1,
      'PAY_IN_ADVANCE',
      1,
      0,
      ${SIMPLE_PROFILE}::uuid,
      2,
      ${SIMPLE_V2}::uuid
    )
    RETURNING id
  `;
  return { customerId: customer[0].id, orderId: order[0].id };
}

async function cleanup(seed: { customerId: string; orderId: string }): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM public.org_wf_gate_decision_mst
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

describe('0473 gate decision live version ledger', () => {
  dbit('accepts a warning acknowledgement bound only to the live profile version', async () => {
    const seed = await seedOrder();
    try {
      const rows = await prisma.$queryRaw<Array<{ decision_id: string }>>`
        INSERT INTO public.org_wf_gate_decision_mst (
          tenant_org_id, order_id, profile_artifact_id, profile_version_id,
          workflow_action_code, workflow_screen_key, gate_code,
          evaluator_version, input_schema_version, decision_mode, channel_code,
          actor_subject, idempotency_key, request_correlation_id,
          evaluation_fingerprint, ack_challenge_hash, override_reason_min_length
        ) VALUES (
          ${DEMO_TENANT}::uuid,
          ${seed.orderId}::uuid,
          NULL,
          ${SIMPLE_V2}::uuid,
          'CONFIRM_PICKUP',
          'pickup_handover',
          'rack_required',
          1,
          1,
          'soft_warning_acknowledged',
          'staff_web',
          'Gate decision DB test',
          ${`wfgd-${randomUUID()}`},
          ${`corr-${randomUUID()}`},
          ${FINGERPRINT},
          ${FINGERPRINT},
          0
        )
        RETURNING decision_id::text
      `;
      expect(rows[0]?.decision_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      await cleanup(seed);
    }
  });

  dbit('rejects a ledger row that names neither a live version nor an artifact', async () => {
    const seed = await seedOrder();
    try {
      await expect(prisma.$executeRaw`
        INSERT INTO public.org_wf_gate_decision_mst (
          tenant_org_id, order_id, profile_artifact_id, profile_version_id,
          workflow_action_code, workflow_screen_key, gate_code,
          evaluator_version, input_schema_version, decision_mode, channel_code,
          actor_subject, idempotency_key, request_correlation_id,
          evaluation_fingerprint, ack_challenge_hash, override_reason_min_length
        ) VALUES (
          ${DEMO_TENANT}::uuid,
          ${seed.orderId}::uuid,
          NULL,
          NULL,
          'CONFIRM_PICKUP',
          'pickup_handover',
          'rack_required',
          1,
          1,
          'soft_warning_acknowledged',
          'staff_web',
          'Gate decision DB test',
          ${`wfgd-${randomUUID()}`},
          ${`corr-${randomUUID()}`},
          ${FINGERPRINT},
          ${FINGERPRINT},
          0
        )
      `).rejects.toThrow(/chk_wfgd_policy_ref|check constraint/i);
    } finally {
      await cleanup(seed);
    }
  });
});
