/**
 * Real local PostgreSQL proof that Review signs the exact facts Apply stores.
 * Every fixture is discarded; a mismatched post-write snapshot rolls back to an
 * Apply savepoint before the fixture transaction itself is discarded.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// Apply imports discount-service (promo reversal), whose settings service builds a browser client at load.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));
import type { OrderChangeContext } from '@/lib/types/order-change';
import { readSettlementFingerprint, type SettlementFingerprintDb } from '@/lib/services/order-change/order-change-settlement-fingerprint';
import { previewOrderChange, type OrderChangePreviewSuccess } from '@/lib/services/order-change/order-change-preview.service';
import { applyOrderChange, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';
import { revalidateLockedOrderChangePolicy } from '@/lib/services/order-change/order-change-policy-revalidation.service';
import { digestOrderChangeOperationAudits } from '@/lib/services/order-change/order-change-review-audit';
import { quoteOrderEdit, readEditOrderRecord, type EditRecordDb } from '@/lib/services/commercial/commercial-edit.loader';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';

const ROLLBACK = 'REVIEWED_SNAPSHOT_FIXTURE_ROLLBACK';
const key = { keyId: 'local-snapshot-proof', secret: 'local-only-reviewed-snapshot-test-secret' };

beforeAll(async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || databaseUrl.port !== '54322') {
    throw new Error('Signed snapshot proof requires local Supabase on port 54322');
  }
  await prisma.$queryRaw`SELECT 1`;
});
afterAll(async () => { await prisma.$disconnect(); });

/** Nested Apply rollback preserves fixture rows while proving mutation atomicity. */
async function applySavepoint<T>(tx: Prisma.TransactionClient, fn: (writeTx: OrderChangeApplyTx) => Promise<T>): Promise<T> {
  await tx.$executeRaw`SAVEPOINT reviewed_snapshot_apply`;
  try {
    const result = await fn(tx as unknown as OrderChangeApplyTx);
    await tx.$executeRaw`RELEASE SAVEPOINT reviewed_snapshot_apply`;
    return result;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT reviewed_snapshot_apply`;
    await tx.$executeRaw`RELEASE SAVEPOINT reviewed_snapshot_apply`;
    throw error;
  }
}

describe('signed operation snapshots on local PostgreSQL', () => {
  it('stores the reviewed notes and quantity objects and rejects a stale signed snapshot without a Change', async () => {
    const organizations = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst
      WHERE name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sandbox%'
      ORDER BY id LIMIT 1`;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users ORDER BY id LIMIT 1`;
    const hqActors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.hq_users ORDER BY id LIMIT 1`;
    const tenantId = organizations[0]?.id;
    const actorId = actors[0]?.id;
    const hqActorId = hqActors[0]?.id;
    if (!tenantId || !actorId || !hqActorId) throw new Error('Snapshot proof requires a demo organization, application actor and HQ actor');
    const policyId = randomUUID();
    const orderId = randomUUID();
    const itemId = randomUUID();
    const customerId = randomUUID();

    await expect(prisma.$transaction(async (tx) => {
      const workflowVersions = await tx.$queryRaw<Array<{ profile_id: string; version_id: string; version_no: number }>>`
        SELECT version.profile_id, version.version_id, version.version_no
        FROM public.sys_wf_profile_ver_mst AS version
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
          ON membership.version_id = version.version_id
         AND membership.status_code = 'processing'
         AND membership.rec_status = 1
         AND membership.is_active = true
        WHERE version.rec_status = 1
          AND version.is_active = true
          AND version.version_status IN ('PILOT', 'PUBLISHED')
        ORDER BY version.version_id
        LIMIT 1
      `;
      const workflowVersion = workflowVersions[0];
      if (!workflowVersion) throw new Error('Snapshot proof requires an active workflow version containing processing');
      const occupied = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_oc_edit_policy_asg_cf
        WHERE tenant_org_id = ${tenantId}::uuid AND scope = 'ORGANIZATION' AND rec_status = 1 AND is_active = true`;
      if (occupied.length) throw new Error('Fixture organization already has a broad override; no existing authority was changed');
      await tx.$executeRaw`
        INSERT INTO public.sys_oc_edit_policy_mst(id, policy_code, name, name2)
        VALUES (${policyId}::uuid, ${`SNAPSHOT_${policyId.replaceAll('-', '')}`}, 'Snapshot proof', 'Snapshot proof')`;
      await tx.$executeRaw`
        INSERT INTO public.sys_oc_edit_policy_rule_dtl(edit_policy_id, workflow_status, operation_code, target_type, decision, reason_code, message_key)
        VALUES (${policyId}::uuid, 'processing', 'CHANGE_ORDER_NOTES', 'ORDER', 'ALLOW', 'SNAPSHOT_PROOF', 'orders.edit.policyInfo.title'),
               (${policyId}::uuid, 'processing', 'CHANGE_ITEM_QUANTITY', 'ITEM', 'ALLOW', 'SNAPSHOT_PROOF', 'orders.edit.policyInfo.title')`;
      await tx.$executeRaw`
        UPDATE public.sys_oc_edit_policy_mst SET lifecycle_status = 'PILOT', policy_revision = policy_revision + 1,
          pilot_started_at = now(), pilot_started_by = ${hqActorId}::uuid WHERE id = ${policyId}::uuid`;
      await tx.$executeRaw`
        UPDATE public.sys_oc_edit_policy_mst SET lifecycle_status = 'PUBLISHED', policy_revision = policy_revision + 1,
          published_at = now(), published_by = ${hqActorId}::uuid WHERE id = ${policyId}::uuid`;
      await tx.$executeRaw`
        INSERT INTO public.org_oc_edit_policy_asg_cf(tenant_org_id, scope, edit_policy_id, gap_acknowledged)
        VALUES (${tenantId}::uuid, 'ORGANIZATION', ${policyId}::uuid, true)`;
      await tx.$executeRaw`
        INSERT INTO public.org_customers_mst(id, tenant_org_id, name)
        VALUES (${customerId}::uuid, ${tenantId}::uuid, 'Reviewed snapshot fixture')`;
      await tx.$executeRaw`
        INSERT INTO public.org_orders_mst(id, tenant_org_id, customer_id, order_no, currency_code, payment_type_code,
          edit_state_version, committed_at, committed_by, current_status, internal_notes, priority, service_speed, total_amount, total_tax_amount,
          commercial_calc_version, commercial_level, tax_pricing_mode, extra_price_pricing_mode, disc_alloc_mode, disc_alloc_basis,
          wf_profile_id, wf_version_no, wf_profile_version_id)
        VALUES (${orderId}::uuid, ${tenantId}::uuid, ${customerId}::uuid, ${`SNAP-${orderId}`}, 'OMR', 'PAY_ON_COLLECTION',
          1, now(), ${actorId}::uuid, 'processing', 'Keep', 'NORMAL', 'STANDARD', 10, 0,
          1, 'ITEM', 'TAX_EXCLUSIVE', 'INCLUDED_IN_ITEM_PRICE', 'DOCUMENT_LEVEL', 'PROPORTIONAL_NET',
          ${workflowVersion.profile_id}::uuid, ${workflowVersion.version_no}, ${workflowVersion.version_id}::uuid)`;
      // A line written by the calculator (P6-01c): a custom line at 10.000, untaxed (the order has no tax line).
      await tx.$executeRaw`
        INSERT INTO public.org_order_items_dtl(id, tenant_org_id, order_id, product_name, quantity, price_per_unit, total_price,
          money_basis, service_speed, ready_by_at, price_source, list_unit_price, service_pref_charge, speed_premium_amount,
          line_disc_amount, order_disc_alloc_amount, net_amount, tax_pricing_mode, tax_category_code, tax_rate,
          taxable_amount, tax_amount, line_total_amount)
        VALUES (${itemId}::uuid, ${tenantId}::uuid, ${orderId}::uuid, 'Snapshot shirt', 1, 10, 10,
          'PRICED', 'STANDARD', now() + interval '1 day', 'MANUAL', 10, 0, 0,
          0, 0, 10, 'TAX_EXCLUSIVE', 'STANDARD', 0,
          10, 0, 10)`;

      const resolution = await resolveOrderChangePolicyBindings(tx, {
        tenantId,
        profileId: workflowVersion.profile_id,
        profileVersionId: workflowVersion.version_id,
        workflowStatus: 'processing',
      });
      expect(resolution).toMatchObject({ resolutionLevel: 'ORGANIZATION', denyReason: 'NONE', editPolicyId: policyId });

      const review = async (code: 'CHANGE_ORDER_NOTES' | 'CHANGE_ITEM_QUANTITY', notes = 'Reviewed note') => {
        const orders = await tx.$queryRaw<Array<{ state_version: number; edit_state_version: number; committed_at: Date; internal_notes: string | null; total_amount: string; total_tax_amount: string }>>`
          SELECT state_version, edit_state_version, committed_at, internal_notes, total_amount::text AS total_amount, total_tax_amount::text AS total_tax_amount
          FROM public.org_orders_mst WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;
        const items = await tx.$queryRaw<Array<{ quantity: number; price_per_unit: string; total_price: string }>>`
          SELECT quantity, price_per_unit::text AS price_per_unit, total_price::text AS total_price
          FROM public.org_order_items_dtl WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND id = ${itemId}::uuid AND rec_status = 1`;
        const order = orders[0];
        const item = items[0];
        const context: OrderChangeContext = {
          orderId, orderNo: `SNAP-${orderId}`, committedAt: order.committed_at.toISOString(), editStateVersion: order.edit_state_version, wfStateVersion: order.state_version,
          workflow: {
            currentStatus: 'processing',
            profileId: workflowVersion.profile_id,
            profileVersionId: workflowVersion.version_id,
          },
          editAccess: { status: 'OPEN', reasonCode: null, reasonText: null, blockedUntil: null },
          permissions: { canEdit: false, canOverride: false, canOverridePrice: false },
          configuration: { featureEnabled: false, newItemPricePolicy: null, existingDiscountPolicy: null, reasonPolicy: null, deferredReason: 'CAPABILITY_POLICY_PENDING' },
          order: { customer: { id: customerId }, customerSnapshot: { name: null, mobile: null, email: null }, branchId: null, currencyCode: 'OMR', paymentTypeCode: 'PAY_ON_COLLECTION', priority: 'NORMAL', serviceSpeed: 'STANDARD', readyBy: null, notes: order.internal_notes, customerNotes: null },
          items: [{ id: itemId, orderId, productId: null, productName: 'Snapshot shirt', productName2: null, serviceCategoryCode: null, quantity: item.quantity, pricePerUnit: item.price_per_unit, totalPrice: item.total_price, priceOverride: null, preferenceCharge: '0.0000', packingPreferenceCode: null, active: true }],
          pieces: [], preferences: [],
          financial: { totalAmount: order.total_amount, netCollectedAmount: '0.0000', outstandingAmount: order.total_amount, overpaidAmount: '0.0000' },
          capabilitySummary: { status: 'DEFERRED', reasonCode: 'CAPABILITY_POLICY_PENDING' },
          editPolicy: { status: 'READY', workflowStatus: 'processing', editPolicyId: policyId, policyRevision: resolution.policyRevision, assignment: { tenantOrgId: tenantId, assignmentId: null, profileId: null, profileCode: null, profileVersionId: null, versionNo: null, versionStatus: null, editPolicyId: policyId, policyCode: null, policyName: null, policyName2: null, lifecycleStatus: 'PUBLISHED' }, rules: [] },
        };
        const operations = code === 'CHANGE_ORDER_NOTES'
          ? [{ seq: 1, code: 'CHANGE_ORDER_NOTES' as const, target: { kind: 'ORDER' as const }, payload: { notes } }]
          : [{ seq: 1, code: 'CHANGE_ITEM_QUANTITY' as const, target: { kind: 'PERSISTED_ITEM' as const, id: itemId }, payload: { quantity: item.quantity + 1 } }];
        const request = { expectedEditStateVersion: order.edit_state_version, expectedWfStateVersion: order.state_version, sourceContext: 'staff_web', changeReason: 'Signed snapshot database proof', operations };
        const preview = await previewOrderChange({
          tenantId, actorUserId: actorId, featureEnabled: true, canUsePermission: async () => true,
          context, request, bindings: resolution.bindings, policyResolution: resolution,
          // The real Edit pricer, reading the fixture through the same transaction.
          priceEdit: async (projection) => quoteOrderEdit(tx as unknown as CommercialDb, tenantId,
            await readEditOrderRecord(tx as unknown as EditRecordDb, tenantId, orderId), projection,
            { currency: { code: 'OMR', decimalPlaces: 3 } }),
          catalog: [], currencyDecimalPlaces: 3,
          payments: [], credits: [], refunds: [], persistedTaxAmount: order.total_tax_amount, proofKey: key,
          settlementFingerprint: await readSettlementFingerprint(tx as unknown as SettlementFingerprintDb, tenantId, orderId),
          auditFacts: { order: { internal_notes: order.internal_notes, customer_notes: null, total_amount: order.total_amount, total_tax_amount: order.total_tax_amount }, items: {}, pieces: {}, preferences: {}, products: {} },
        });
        expect(preview).toMatchObject({ ok: true, status: 'READY' });
        if (!preview.ok || !preview.reviewProof || !preview.calculationFingerprint) throw new Error('Signed preview unavailable');
        return { request: { ...request, reviewProof: preview.reviewProof, calculationFingerprint: preview.calculationFingerprint }, preview };
      };
      const apply = (reviewed: Awaited<ReturnType<typeof review>>) => applyOrderChange({
        tenantId, orderId, actorUserId: actorId, currencyCode: 'OMR', paymentTypeCode: 'PAY_ON_COLLECTION',
        idempotencyKey: `snapshot-${randomUUID()}`, request: reviewed.request, preview: reviewed.preview as OrderChangePreviewSuccess,
        proofKey: key, appliedAt: new Date(), runInTransaction: (fn) => applySavepoint(tx, fn),
        validateLockedPolicy: (writeTx) => revalidateLockedOrderChangePolicy(writeTx as unknown as Prisma.TransactionClient, { tenantId, orderId, binding: reviewed.preview.reviewBinding }),
      });

      for (const code of ['CHANGE_ORDER_NOTES', 'CHANGE_ITEM_QUANTITY'] as const) {
        const reviewed = await review(code);
        const applied = await apply(reviewed);
        expect(applied).toMatchObject({ ok: true, replayed: false });
        if (!applied.ok) throw new Error(applied.code);
        const history = await tx.$queryRaw<Array<{ before_values: unknown; after_values: unknown }>>`
          SELECT before_values, after_values FROM public.org_order_change_ops_dtl
          WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND order_change_id = ${applied.orderChangeId}::uuid`;
        expect(history).toEqual([{ before_values: reviewed.preview.operationAudits[0].beforeValues, after_values: reviewed.preview.operationAudits[0].afterValues }]);
      }
      // P6-01c: the quantity edit stored the calculated line and the rollup rebuilt the header from it.
      const storedItem = await tx.$queryRaw<Array<{ quantity: number; total_price: string; net_amount: string; line_total_amount: string; list_unit_price: string }>>`
        SELECT quantity, total_price::text AS total_price, net_amount::text AS net_amount,
          line_total_amount::text AS line_total_amount, list_unit_price::text AS list_unit_price
        FROM public.org_order_items_dtl WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND id = ${itemId}::uuid`;
      expect(storedItem[0]).toMatchObject({ quantity: 2, total_price: '20.0000', net_amount: '20.0000', line_total_amount: '20.0000', list_unit_price: '10.0000' });
      const storedHeader = await tx.$queryRaw<Array<{ total_amount: string }>>`
        SELECT total_amount::text AS total_amount FROM public.org_orders_mst WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;
      expect(Number(storedHeader[0].total_amount)).toBe(20);
      const stale = await review('CHANGE_ORDER_NOTES', 'Stale signed after');
      await tx.$executeRaw`
        UPDATE public.org_orders_mst SET internal_notes = 'Changed after Review'
        WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;
      const countBefore = await tx.org_order_changes_mst.count({ where: { tenant_org_id: tenantId, order_id: orderId } });
      expect(stale.preview.reviewBinding?.operationSnapshotDigest).toBe(digestOrderChangeOperationAudits(stale.preview.operationAudits));
      await expect(apply(stale)).resolves.toMatchObject({ ok: false, status: 409, code: 'REVIEW_CHANGED' });
      expect(await tx.org_order_changes_mst.count({ where: { tenant_org_id: tenantId, order_id: orderId } })).toBe(countBefore);
      throw new Error(ROLLBACK);
    }, { timeout: 30000 })).rejects.toThrow(ROLLBACK);
    expect(await prisma.org_orders_mst.count({ where: { tenant_org_id: tenantId, id: orderId } })).toBe(0);
    expect(await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.sys_oc_edit_policy_mst WHERE id = ${policyId}::uuid`).toEqual([]);
  });
});
