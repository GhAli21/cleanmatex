/**
 * Cart Line Grouping on local PostgreSQL (docs/features/Order_Cart_Line_Grouping/DESIGN.md §15):
 * - two lines of one product with different prices are stored and re-priced independently, at ITEM and
 *   PIECE commercial level;
 * - a measured merge into a saved line is refused as a whole when the Edit policy denies one of its changes;
 * - a saved piece swapped for a new one on the same line, built from the cart screen's state, previews and
 *   applies.
 * Everything runs in a transaction that is rolled back.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

jest.mock('server-only', () => ({}));
// Route every `prisma` read and write to the open fixture transaction.
jest.mock('@/lib/db/prisma', () => {
  const actual = jest.requireActual('@/lib/db/prisma');
  const real = actual.prisma;
  const routed = new Proxy(real, {
    get(target, prop, receiver) {
      const tx = (globalThis as { __lineGroupingTx?: Record<string | symbol, unknown> }).__lineGroupingTx;
      if (tx && prop === '$transaction') {
        return async (arg: unknown) => (typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as unknown[]));
      }
      if (tx && prop !== '$disconnect' && prop in tx) return tx[prop];
      return Reflect.get(target, prop, receiver);
    },
  });
  return { ...actual, prisma: routed, default: routed };
});
jest.mock('@/lib/services/feature-flags.service', () => ({
  ...jest.requireActual('@/lib/services/feature-flags.service'),
  getFeatureFlags: async () => ({ order_edit_v2: true }),
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  ...jest.requireActual('@/lib/services/tenant-settings.service'),
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));

import { prisma } from '@/lib/db/prisma';
import type { CreateOrderParams } from '@/lib/services/order-service';
import { createUnpaidOrderFromCheckoutTx } from '@/lib/services/order-create-from-checkout.service';
import { quoteCheckout } from '@/lib/services/commercial/commercial-checkout.service';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';
import { getOrderChangeContext } from '@/lib/services/order-change/order-change-context.service';
import { loadOrderChangePreviewFacts } from '@/lib/services/order-change/order-change-preview-reads';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import { applyOrderChange, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { revalidateLockedOrderChangePolicy } from '@/lib/services/order-change/order-change-policy-revalidation.service';
import { createEditOrderController } from '@/src/features/orders/order-change/edit-order-controller';
import { mapChangeContextToEditBaseline } from '@/src/features/orders/order-change/edit-order-view-model';
import { applyVisualDraftToController, projectEditVisualOrder } from '@/src/features/orders/order-change/edit-workspace-adapter';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { z } from 'zod';

type Operation = z.infer<typeof orderChangeRequestSchema>['operations'][number];
const ROLLBACK = 'LINE_GROUPING_FIXTURE_ROLLBACK';

process.env.ORDER_CHANGE_REVIEW_PROOF_KEY_ID = 'local-line-grouping';
process.env.ORDER_CHANGE_REVIEW_PROOF_SECRET = 'local-only-line-grouping-test-secret';

beforeAll(async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || databaseUrl.port !== '54322') {
    throw new Error('Line grouping proof requires local Supabase on port 54322');
  }
  await prisma.$queryRaw`SELECT 1`;
});
afterAll(async () => { await prisma.$disconnect(); });

describe.each(['ITEM', 'PIECE'])('several lines of one product at %s level (local PostgreSQL)', (level) => {
  it('prices each line on its own, refuses a partly denied merge whole, and applies a swapped piece', async () => {
    const tenantId = (await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst
      WHERE (name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sandbox%') AND timezone IS NOT NULL
      ORDER BY id LIMIT 1`)[0]?.id;
    const actorId = (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users ORDER BY id LIMIT 1`)[0]?.id;
    const hqActorId = (await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.hq_users ORDER BY id LIMIT 1`)[0]?.id;
    if (!tenantId || !actorId || !hqActorId) throw new Error('Line grouping proof requires a demo organization, application actor and HQ actor');

    await expect(prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      (globalThis as { __lineGroupingTx?: unknown }).__lineGroupingTx = tx;
      try {
        // ─── Fixture: level, Edit policy WITHOUT the measure change, customer, catalog ──
        await tx.$executeRaw`UPDATE public.org_tenants_mst SET commercial_level = ${level} WHERE id = ${tenantId}::uuid`;
        const occupied = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.org_oc_edit_policy_asg_cf
          WHERE tenant_org_id = ${tenantId}::uuid AND scope = 'ORGANIZATION' AND rec_status = 1 AND is_active = true`;
        if (occupied.length) throw new Error('Fixture organization already has a broad override; no existing authority was changed');
        const policyId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO public.sys_oc_edit_policy_mst(id, policy_code, name, name2)
          VALUES (${policyId}::uuid, ${`LINES_${policyId.replaceAll('-', '')}`}, 'Line grouping proof', 'Line grouping proof')`;
        const rules: Array<[string, string]> = [['ADD_ITEM', 'ORDER'], ['CHANGE_ITEM_QUANTITY', 'ITEM'], ['ADD_PIECE', 'ITEM'], ['REMOVE_PIECE', 'PIECE']];
        for (const [code, target] of rules) {
          await tx.$executeRaw`
            INSERT INTO public.sys_oc_edit_policy_rule_dtl(edit_policy_id, workflow_status, operation_code, target_type, decision, reason_code, message_key)
            VALUES (${policyId}::uuid, 'processing', ${code}, ${target}, 'ALLOW', 'LINE_PROOF', 'orders.edit.policyInfo.title')`;
        }
        await tx.$executeRaw`
          UPDATE public.sys_oc_edit_policy_mst SET lifecycle_status = 'PILOT', policy_revision = policy_revision + 1,
            pilot_started_at = now(), pilot_started_by = ${hqActorId}::uuid WHERE id = ${policyId}::uuid`;
        await tx.$executeRaw`
          UPDATE public.sys_oc_edit_policy_mst SET lifecycle_status = 'PUBLISHED', policy_revision = policy_revision + 1,
            published_at = now(), published_by = ${hqActorId}::uuid WHERE id = ${policyId}::uuid`;
        await tx.$executeRaw`
          INSERT INTO public.org_oc_edit_policy_asg_cf(tenant_org_id, scope, edit_policy_id, gap_acknowledged)
          VALUES (${tenantId}::uuid, 'ORGANIZATION', ${policyId}::uuid, true)`;
        const customerId = randomUUID();
        const shirt = randomUUID();
        const soap = randomUUID();
        await tx.$executeRaw`
          INSERT INTO public.org_customers_mst(id, tenant_org_id, name, customer_code)
          VALUES (${customerId}::uuid, ${tenantId}::uuid, 'Line grouping fixture', ${`LG-C-${customerId.slice(0, 8)}`})`;
        await tx.$executeRaw`
          INSERT INTO public.org_product_data_mst(id, tenant_org_id, product_code, product_name, service_category_code, price_type,
            default_sell_price, turnaround_hh, tax_category_code, is_active, rec_status)
          VALUES (${shirt}::uuid, ${tenantId}::uuid, ${`LG-S-${shirt.slice(0, 8)}`}, 'Grouping shirt', 'WASH_AND_IRON', 'PER_UNIT', 2, 24, 'STANDARD', true, 1)`;
        await tx.$executeRaw`
          INSERT INTO public.org_product_data_mst(id, tenant_org_id, product_code, product_name, service_category_code, price_type,
            default_sell_price, turnaround_hh, tax_category_code, base_uom_code, min_billable_qty, billing_increment, is_active, rec_status)
          VALUES (${soap}::uuid, ${tenantId}::uuid, ${`LG-K-${soap.slice(0, 8)}`}, 'Grouping bulk', 'WASH_AND_IRON', 'PER_UNIT', 5, 24, 'STANDARD', 'KG', 3, 0.5, true, 1)`;

        // ─── Create: the same product twice, one line at a cashier price ──
        const override = { priceOverride: 1.5, overrideReason: 'Regular customer' };
        const checkout = await quoteCheckout({
          db: tx as unknown as CommercialDb, tenantId, customerId,
          items: [
            { productId: shirt, quantity: 2, pieces: [{}, {}], ...override },
            { productId: shirt, quantity: 1, pieces: [{}] },
          ],
        });
        const lines: CreateOrderParams['items'] = [
          { productId: shirt, quantity: 2, pricePerUnit: 0, totalPrice: 0, pieces: [{ pieceSeq: 1 }, { pieceSeq: 2 }], ...override },
          { productId: shirt, quantity: 1, pricePerUnit: 0, totalPrice: 0, pieces: [{ pieceSeq: 1 }] },
        ];
        const created = await createUnpaidOrderFromCheckoutTx(tx as never, {
          tenantId, checkout, committedBy: null, issuedBy: customerId,
          order: { customerId, orderTypeId: 'POS', userId: actorId, userName: 'Line cashier', paymentTypeCode: 'PAY_ON_COLLECTION', items: lines },
        });
        const orderId = created.order.id;
        await tx.$executeRaw`
          UPDATE public.org_orders_mst SET current_status = 'processing'
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;

        const stored = () => tx.$queryRaw<Array<{ id: string; product_id: string; quantity: number; price_per_unit: string; total_price: string; pieces: string; piece_ids: string[] }>>`
          SELECT i.id, i.product_id, i.quantity, i.price_per_unit::numeric(19,4)::text AS price_per_unit, i.total_price::numeric(19,4)::text AS total_price,
            sum(p.total_price)::numeric(19,4)::text AS pieces, array_agg(p.id::text ORDER BY p.piece_seq) AS piece_ids
          FROM public.org_order_items_dtl i
          JOIN public.org_order_item_pieces_dtl p ON p.order_item_id = i.id AND p.tenant_org_id = i.tenant_org_id AND p.rec_status = 1
          WHERE i.tenant_org_id = ${tenantId}::uuid AND i.order_id = ${orderId}::uuid AND i.rec_status = 1
          GROUP BY i.id, i.product_id, i.quantity, i.price_per_unit, i.total_price, i.order_item_srno
          ORDER BY i.order_item_srno`;

        const [priced, standard] = await stored();
        expect([priced, standard].map((row) => [row.product_id, row.quantity, row.price_per_unit, row.total_price, row.pieces])).toEqual([
          [shirt, 2, '1.5000', '3.0000', '3.0000'],
          [shirt, 1, '2.0000', '2.0000', '2.0000'],
        ]);

        /** One Edit, the way the preview and apply routes run it; null when the preview refuses it. */
        const edit = async (operations: Operation[]) => {
          const context = await getOrderChangeContext({ tenantId, orderId });
          const facts = await loadOrderChangePreviewFacts({ tenantId, actorUserId: actorId, context, operations });
          const request = {
            expectedEditStateVersion: context.editStateVersion, expectedWfStateVersion: context.wfStateVersion,
            sourceContext: 'staff_web', changeReason: 'Line grouping database proof', operations,
          };
          const preview = await previewOrderChange({
            tenantId, actorUserId: actorId, featureEnabled: facts.featureEnabled, canUsePermission: async () => true,
            context, request, bindings: facts.bindings, policyResolution: facts.policyResolution, priceEdit: facts.priceEdit,
            catalog: facts.catalog, payments: facts.payments, credits: facts.credits, refunds: facts.refunds,
            appliedDispositions: facts.appliedDispositions, settlementFingerprint: facts.settlementFingerprint,
            persistedTaxAmount: facts.persistedTaxAmount, auditFacts: facts.auditFacts, proofKey: facts.proofKey,
          });
          if (!preview.ok || !preview.reviewProof || !preview.calculationFingerprint) return { preview, applied: null };
          const reviewed = { ...request, reviewProof: preview.reviewProof, calculationFingerprint: preview.calculationFingerprint };
          const applied = await applyOrderChange({
            tenantId, orderId, actorUserId: actorId, currencyCode: context.order.currencyCode, paymentTypeCode: context.order.paymentTypeCode,
            idempotencyKey: `lines-${randomUUID()}`, request: reviewed, preview, proofKey: facts.proofKey, appliedAt: new Date(),
            validateLockedPolicy: (writeTx) => revalidateLockedOrderChangePolicy(writeTx as unknown as Prisma.TransactionClient, { tenantId, orderId, binding: preview.reviewBinding }),
            runInTransaction: (fn) => fn(tx as unknown as OrderChangeApplyTx),
          });
          if (!applied.ok) throw new Error(`Apply rejected: ${applied.code}`);
          return { preview, applied };
        };

        // ─── Changing one line leaves the other line of the product as it was ──
        const grown = await edit([
          { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: standard.id }, payload: { quantity: 2 } },
          { seq: 2, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: standard.id }, payload: { clientRef: randomUUID() } },
        ]);
        expect(grown.applied).not.toBeNull();
        const afterGrow = await stored();
        expect(afterGrow.find((row) => row.id === priced.id)).toEqual(priced);
        expect(afterGrow.find((row) => row.id === standard.id)).toMatchObject({ quantity: 2, price_per_unit: '2.0000', total_price: '4.0000' });

        // ─── A saved piece swapped for a new one, built from the cart screen's state ──
        const context = await getOrderChangeContext({ tenantId, orderId });
        const mapped = mapChangeContextToEditBaseline(context);
        if (!mapped.ok) throw new Error('baseline');
        const visual = projectEditVisualOrder(context);
        const items = visual.items.map((item) => (item.persistedItemId === priced.id
          ? { ...item, pieces: [item.pieces![1]!, { id: 'temp-new', itemId: item.lineKey, pieceSeq: 2 }] }
          : item));
        const controller = createEditOrderController();
        applyVisualDraftToController(controller, mapped.baseline, {
          items, orderServicePrefs: visual.orderServicePrefs, serviceSpeed: context.order.serviceSpeed ?? undefined,
          notes: context.order.notes ?? '', customerNotes: context.order.customerNotes ?? '', readyBy: context.order.readyBy ?? undefined,
          customerName: context.order.customerSnapshot.name ?? '', customerMobile: context.order.customerSnapshot.mobile ?? '',
          customerEmail: context.order.customerSnapshot.email ?? '',
        });
        const operations = controller.buildOperations() as Operation[];
        expect(operations.map((operation) => operation.code)).toEqual(['ADD_PIECE', 'REMOVE_PIECE']);
        const swapped = await edit(operations);
        expect(swapped.preview.ok).toBe(true);
        expect(swapped.applied).not.toBeNull();
        const afterSwap = (await stored()).find((row) => row.id === priced.id)!;
        expect(afterSwap).toMatchObject({ quantity: 2, price_per_unit: '1.5000', total_price: '3.0000', pieces: '3.0000' });
        expect(afterSwap.piece_ids).not.toContain(priced.piece_ids[0]);
        expect(afterSwap.piece_ids).toContain(priced.piece_ids[1]);

        // ─── §4.5: the measure change has no policy rule, so the whole merge is refused ──
        const soapRef = randomUUID();
        const added = await edit([
          { seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: soapRef, productId: soap, quantity: 1, measure: { measuredQty: '2' } } },
          { seq: 2, code: 'ADD_PIECE', target: { kind: 'LOCAL_ITEM', clientRef: soapRef }, payload: { clientRef: randomUUID() } },
        ]);
        expect(added.applied).not.toBeNull();
        const before = await stored();
        const denied = await edit([
          { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: soapRef }, payload: { quantity: 2 } },
          { seq: 2, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: soapRef }, payload: { clientRef: randomUUID() } },
          { seq: 3, code: 'CHANGE_ITEM_MEASURE', target: { kind: 'PERSISTED_ITEM', id: soapRef }, payload: { measure: { measuredQty: '4' } } },
        ]);
        expect(denied.applied).toBeNull();
        // Refused by the policy, on the measure change alone; the two allowed changes are not applied either.
        expect(denied.preview).toMatchObject({ status: 'DENIED', createsChange: false });
        expect(denied.preview.ok && denied.preview.decisions?.filter((d) => d.decision !== 'ALLOW').map((d) => d.operationCode))
          .toEqual(['CHANGE_ITEM_MEASURE']);
        expect(await stored()).toEqual(before);
      } finally {
        delete (globalThis as { __lineGroupingTx?: unknown }).__lineGroupingTx;
      }
      throw new Error(ROLLBACK);
    }, { maxWait: 10000, timeout: 120000 })).rejects.toThrow(ROLLBACK);
  }, 180000);
});
