/**
 * P6-01e: Edit on the commercial calculator, proved on real local PostgreSQL.
 *
 * One order is created by the real Create path (checkout quote + order writer),
 * then edited through the same chain as the Edit routes: context → preview facts
 * → preview → apply. After every edit the stored header, lines, pieces, charges
 * and tax lines must equal what the review showed (Preview = Apply = rollup).
 *
 * Everything runs inside one transaction that is always rolled back. The shared
 * Prisma client is routed to that transaction, so services that read through
 * `prisma` see the fixture rows. Only the HQ flag read, the Supabase cookie
 * client and the currency setting are stubbed.
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
      const tx = (globalThis as { __editParityTx?: Record<string | symbol, unknown> }).__editParityTx;
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
// Modules that build a browser client at load time; no Supabase call is made by this chain.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  ...jest.requireActual('@/lib/services/tenant-settings.service'),
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));

import { prisma } from '@/lib/db/prisma';
import { OrderService, type CreateOrderParams } from '@/lib/services/order-service';
import { checkoutCreateTotals, createUnpaidOrderFromCheckoutTx } from '@/lib/services/order-create-from-checkout.service';
import { quoteCheckout } from '@/lib/services/commercial/commercial-checkout.service';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';
import { editMoneyColumns } from '@/lib/services/commercial/commercial-edit.writer';
import { readEditOrderRecord, type EditProjection, type EditRecordDb } from '@/lib/services/commercial/commercial-edit.loader';
import { getOrderChangeContext } from '@/lib/services/order-change/order-change-context.service';
import { loadOrderChangePreviewFacts } from '@/lib/services/order-change/order-change-preview-reads';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import { applyOrderChange, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { revalidateLockedOrderChangePolicy } from '@/lib/services/order-change/order-change-policy-revalidation.service';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';

type Operation = z.infer<typeof orderChangeRequestSchema>['operations'][number];
const ROLLBACK = 'EDIT_PARITY_FIXTURE_ROLLBACK';

process.env.ORDER_CHANGE_REVIEW_PROOF_KEY_ID = 'local-edit-parity';
process.env.ORDER_CHANGE_REVIEW_PROOF_SECRET = 'local-only-edit-parity-test-secret';

beforeAll(async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || databaseUrl.port !== '54322') {
    throw new Error('Edit parity proof requires local Supabase on port 54322');
  }
  await prisma.$queryRaw`SELECT 1`;
});
afterAll(async () => { await prisma.$disconnect(); });

/** Apply's own transaction is a savepoint, so a rejected Apply leaves the fixture intact. */
async function applySavepoint<T>(tx: Prisma.TransactionClient, fn: (writeTx: OrderChangeApplyTx) => Promise<T>): Promise<T> {
  await tx.$executeRaw`SAVEPOINT edit_parity_apply`;
  try {
    const result = await fn(tx as unknown as OrderChangeApplyTx);
    await tx.$executeRaw`RELEASE SAVEPOINT edit_parity_apply`;
    return result;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT edit_parity_apply`;
    await tx.$executeRaw`RELEASE SAVEPOINT edit_parity_apply`;
    throw error;
  }
}

const money = (value: unknown) => Number(value).toFixed(4);

describe('Edit on the commercial calculator (local PostgreSQL)', () => {
  it('re-prices every Edit operation so Preview = Apply = rollup, and refuses an order from before the calculator', async () => {
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst
      WHERE (name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sandbox%') AND timezone IS NOT NULL
      ORDER BY id LIMIT 1`;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users ORDER BY id LIMIT 1`;
    const hqActors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.hq_users ORDER BY id LIMIT 1`;
    const tenantId = tenants[0]?.id;
    const actorId = actors[0]?.id;
    const hqActorId = hqActors[0]?.id;
    if (!tenantId || !actorId || !hqActorId) throw new Error('Edit parity proof requires a demo organization, application actor and HQ actor');
    const policyId = randomUUID();
    const customerId = randomUUID();
    const shirt = randomUUID();
    const trouser = randomUUID();

    await expect(prisma.$transaction(async (tx) => {
      (globalThis as { __editParityTx?: unknown }).__editParityTx = tx;
      try {
        // ─── Fixture: Edit policy, customer, catalog ──────────────────────
        const occupied = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.org_oc_edit_policy_asg_cf
          WHERE tenant_org_id = ${tenantId}::uuid AND scope = 'ORGANIZATION' AND rec_status = 1 AND is_active = true`;
        if (occupied.length) throw new Error('Fixture organization already has a broad override; no existing authority was changed');
        await tx.$executeRaw`
          INSERT INTO public.sys_oc_edit_policy_mst(id, policy_code, name, name2)
          VALUES (${policyId}::uuid, ${`PARITY_${policyId.replaceAll('-', '')}`}, 'Edit parity proof', 'Edit parity proof')`;
        const rules: Array<[string, string]> = [
          ['CHANGE_ORDER_NOTES', 'ORDER'], ['CHANGE_ITEM_QUANTITY', 'ITEM'], ['ADD_ITEM', 'ORDER'], ['REMOVE_ITEM', 'ITEM'],
          ['ADD_PREFERENCE', 'ITEM'], ['REMOVE_PREFERENCE', 'PREFERENCE'], ['CHANGE_SERVICE_SPEED', 'ORDER'], ['ADD_PIECE', 'ITEM'],
        ];
        for (const [code, target] of rules) {
          await tx.$executeRaw`
            INSERT INTO public.sys_oc_edit_policy_rule_dtl(edit_policy_id, workflow_status, operation_code, target_type, decision, reason_code, message_key)
            VALUES (${policyId}::uuid, 'processing', ${code}, ${target}, 'ALLOW', 'PARITY_PROOF', 'orders.edit.policyInfo.title')`;
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
        await tx.$executeRaw`
          INSERT INTO public.org_customers_mst(id, tenant_org_id, name) VALUES (${customerId}::uuid, ${tenantId}::uuid, 'Edit parity fixture')`;
        // Two products at fixed prices; the shirt has an EXPRESS rule (sell price 3.000, 6 hours).
        await tx.$executeRaw`
          INSERT INTO public.org_product_data_mst(id, tenant_org_id, product_code, product_name, service_category_code, price_type,
            default_sell_price, turnaround_hh, tax_category_code, is_active, rec_status)
          VALUES (${shirt}::uuid, ${tenantId}::uuid, ${`PAR-S-${shirt.slice(0, 8)}`}, 'Parity shirt', 'WASH_AND_IRON', 'PER_PC', 2, 24, 'STANDARD', true, 1),
                 (${trouser}::uuid, ${tenantId}::uuid, ${`PAR-T-${trouser.slice(0, 8)}`}, 'Parity trouser', 'WASH_AND_IRON', 'PER_PC', 5, 24, 'STANDARD', true, 1)`;
        await tx.$executeRaw`
          INSERT INTO public.org_speed_price_rules_cf(tenant_org_id, service_speed, product_id, speed_price_type, default_speed_sell_price,
            turnaround_hh_speed, effective_from, is_active, rec_status)
          VALUES (${tenantId}::uuid, 'EXPRESS', ${shirt}::uuid, 'SELL_PRICE', 3, 6, current_date - 1, true, 1)`;
        const starch = (await tx.$queryRaw<Array<{ id: string; preference_code: string; extra_price: string }>>`
          SELECT id, preference_code, extra_price::text AS extra_price FROM public.org_service_preference_cf
          WHERE tenant_org_id = ${tenantId}::uuid AND preference_sys_kind = 'service_prefs' AND is_active = true
            AND branch_id IS NULL AND extra_price > 0
          ORDER BY preference_code LIMIT 1`)[0];
        if (!starch) throw new Error('Edit parity proof requires one priced service preference');

        // ─── Create through the shared quoted-create path (the one booking uses) ──
        const checkout = await quoteCheckout({
          db: tx as unknown as CommercialDb, tenantId, customerId,
          items: [{ productId: shirt, quantity: 2, pieces: [{}, {}] }, { productId: trouser, quantity: 1, pieces: [{}] }],
        });
        const orderLines: CreateOrderParams['items'] = [
          { productId: shirt, quantity: 2, pricePerUnit: 0, totalPrice: 0, pieces: [{ pieceSeq: 1 }, { pieceSeq: 2 }] },
          { productId: trouser, quantity: 1, pricePerUnit: 0, totalPrice: 0, pieces: [{ pieceSeq: 1 }] },
        ];

        // Create alone (before any rollup) stores the whole tax: the header agrees with the tax lines.
        const probe = await OrderService.createOrderInTransaction(tx as never, {
          tenantId, customerId, orderTypeId: 'POS', userId: actorId, userName: 'Parity cashier', currencyCode: 'OMR',
          paymentTypeCode: 'PAY_ON_COLLECTION', items: orderLines, totals: checkoutCreateTotals(checkout), commercial: checkout,
        });
        if (!probe.success || !probe.order) throw new Error(`Create failed: ${JSON.stringify(probe)}`);
        const probeTax = await tx.$queryRaw<Array<{ total_tax_amount: string; lines: string | null }>>`
          SELECT o.total_tax_amount::text AS total_tax_amount,
            (SELECT sum(t.tax_amount)::text FROM public.org_order_taxes_dtl t
             WHERE t.tenant_org_id = o.tenant_org_id AND t.order_id = o.id AND t.rec_status = 1) AS lines
          FROM public.org_orders_mst o WHERE o.tenant_org_id = ${tenantId}::uuid AND o.id = ${probe.order.id}::uuid`;
        expect(money(probeTax[0].total_tax_amount)).toBe(money(checkout.quote.result.totals.taxTotal.toFixed(4)));
        expect(money(probeTax[0].total_tax_amount)).toBe(money(probeTax[0].lines ?? 0));

        // The order under test: created, settled and committed in one step, unpaid.
        const created = await createUnpaidOrderFromCheckoutTx(tx as never, {
          tenantId, checkout, committedBy: null, issuedBy: customerId,
          order: { customerId, orderTypeId: 'POS', userId: actorId, userName: 'Parity cashier', paymentTypeCode: 'PAY_ON_COLLECTION', items: orderLines },
        });
        const orderId = created.order.id;
        const commitment = (await tx.$queryRaw<Array<{ committed_at: Date | null; committed_by: string | null; edit_state_version: number; outstanding_amount: string; total_amount: string }>>`
          SELECT committed_at, committed_by, edit_state_version, outstanding_amount::text AS outstanding_amount, total_amount::text AS total_amount
          FROM public.org_orders_mst WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`)[0];
        // Committed by a customer channel (no staff user), nothing paid, everything owed.
        expect(commitment.committed_at).not.toBeNull();
        expect(commitment).toMatchObject({ committed_by: null, edit_state_version: 1 });
        expect(money(commitment.outstanding_amount)).toBe(money(commitment.total_amount));
        // Workflow fact only: the order is in processing, where the parity Edit policy allows each operation.
        await tx.$executeRaw`
          UPDATE public.org_orders_mst SET current_status = 'processing'
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;

        // ─── Readers ──────────────────────────────────────────────────────
        const header = async () => (await tx.$queryRaw<Array<{ total_amount: string; total_tax_amount: string; ready_by: Date | null; service_speed: string | null }>>`
          SELECT total_amount::text AS total_amount, total_tax_amount::text AS total_tax_amount, ready_by, service_speed
          FROM public.org_orders_mst WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`)[0];
        const items = () => tx.$queryRaw<Array<{ id: string; product_id: string | null; quantity: number; service_speed: string | null; total_price: string; line_total_amount: string; ready_by_at: Date | null }>>`
          SELECT id, product_id, quantity, service_speed, total_price::text AS total_price, line_total_amount::text AS line_total_amount, ready_by_at
          FROM public.org_order_items_dtl WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND rec_status = 1
          ORDER BY created_at, id`;

        /** I1, I3 and the charge rule after every Apply. */
        const assertStoredInvariants = async (reviewedTotal: string) => {
          const stored = await header();
          expect(money(stored.total_amount)).toBe(money(reviewedTotal));
          const pieceGaps = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT i.id FROM public.org_order_items_dtl i
            JOIN public.org_order_item_pieces_dtl p ON p.order_item_id = i.id AND p.tenant_org_id = i.tenant_org_id AND p.rec_status = 1
            WHERE i.tenant_org_id = ${tenantId}::uuid AND i.order_id = ${orderId}::uuid AND i.rec_status = 1
            GROUP BY i.id, i.total_price, i.line_total_amount
            HAVING sum(p.total_price) <> i.total_price OR sum(p.line_total_amount) <> i.line_total_amount`;
          expect(pieceGaps).toEqual([]);
          const taxes = await tx.$queryRaw<Array<{ sum: string | null }>>`
            SELECT sum(tax_amount)::text AS sum FROM public.org_order_taxes_dtl
            WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND rec_status = 1`;
          expect(money(taxes[0].sum ?? 0)).toBe(money(stored.total_tax_amount));
          const express = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM public.org_order_charges_dtl
            WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND charge_type = 'EXPRESS' AND is_voided = false AND rec_status = 1`;
          expect(express).toEqual([]);
        };

        /** One Edit, the way the preview and apply routes run it. */
        const edit = async (operations: Operation[], allowRejected = false) => {
          const context = await getOrderChangeContext({ tenantId, orderId });
          const facts = await loadOrderChangePreviewFacts({ tenantId, actorUserId: actorId, context, operations });
          const request = {
            expectedEditStateVersion: context.editStateVersion, expectedWfStateVersion: context.wfStateVersion,
            sourceContext: 'staff_web', changeReason: 'Edit parity database proof', operations,
          };
          const preview = await previewOrderChange({
            tenantId, actorUserId: actorId, featureEnabled: facts.featureEnabled, canUsePermission: async () => true,
            context, request, bindings: facts.bindings, policyResolution: facts.policyResolution, priceEdit: facts.priceEdit,
            catalog: facts.catalog, payments: facts.payments, credits: facts.credits, refunds: facts.refunds,
            persistedTaxAmount: facts.persistedTaxAmount, auditFacts: facts.auditFacts, proofKey: facts.proofKey,
          });
          if (!preview.ok) {
            if (allowRejected) return { context, preview, applied: null };
            throw new Error(`Preview rejected: ${preview.code}`);
          }
          if (!preview.reviewProof || !preview.calculationFingerprint) throw new Error('Signed preview unavailable');
          const reviewed = { ...request, reviewProof: preview.reviewProof, calculationFingerprint: preview.calculationFingerprint };
          const applied = await applyOrderChange({
            tenantId, orderId, actorUserId: actorId, currencyCode: context.order.currencyCode, paymentTypeCode: context.order.paymentTypeCode,
            idempotencyKey: `parity-${randomUUID()}`, request: reviewed, preview, proofKey: facts.proofKey, appliedAt: new Date(),
            validateLockedPolicy: (writeTx) => revalidateLockedOrderChangePolicy(writeTx as unknown as Prisma.TransactionClient, { tenantId, orderId, binding: preview.reviewBinding }),
            runInTransaction: (fn) => applySavepoint(tx, fn),
          });
          if (!applied.ok) throw new Error(`Apply rejected: ${applied.code}`);
          await assertStoredInvariants(preview.projectedTotal);
          return { context, preview, applied };
        };

        // ─── 1. Create parity: re-pricing the unchanged order gives Create's figures ──
        const createdHeader = await header();
        expect(money(createdHeader.total_amount)).toBe(money(checkout.totals.saleTotal));
        const record = await readEditOrderRecord(tx as unknown as EditRecordDb, tenantId, orderId);
        const asIs: EditProjection = {
          serviceSpeed: record.serviceSpeed, editedAt: new Date(),
          lines: record.items.map((i) => ({ id: i.id, quantity: i.quantity, serviceSpeed: null, pieceIds: record.pieces.filter((p) => p.itemId === i.id).map((p) => p.id) })),
          preferences: record.preferences,
        };
        const facts0 = await loadOrderChangePreviewFacts({ tenantId, actorUserId: actorId, context: await getOrderChangeContext({ tenantId, orderId }), operations: [] });
        const repriced = await facts0.priceEdit(asIs);
        expect(money(repriced.quote.result.totals.totalAmount)).toBe(money(createdHeader.total_amount));
        expect(money(repriced.quote.result.totals.taxTotal)).toBe(money(createdHeader.total_tax_amount));
        const createdItems = await items();
        // The columns the Edit writer would store are Create's columns.
        const columns = editMoneyColumns(repriced);
        expect(createdItems.map((i) => money(columns.items.get(i.id)?.line_total_amount))).toEqual(createdItems.map((i) => money(i.line_total_amount)));
        expect(createdItems.map((i) => money(columns.items.get(i.id)?.total_price))).toEqual(createdItems.map((i) => money(i.total_price)));
        await assertStoredInvariants(createdHeader.total_amount);

        // ─── 2. Header-only edit: not re-priced (EC-08) ──────────────────
        const notes = await edit([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Parity note' } }]);
        expect(notes.preview).toMatchObject({ ok: true, projectedTotal: money(createdHeader.total_amount) });
        expect(notes.preview.ok && notes.preview.commercial).toBeFalsy();
        expect(money((await header()).total_amount)).toBe(money(createdHeader.total_amount));

        // ─── 3. Change a quantity ────────────────────────────────────────
        const [shirtLine, trouserLine] = createdItems;
        // The screen sends the new piece with the quantity; the item's money is re-allocated over both pieces.
        const qty = await edit([
          { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: trouserLine.id }, payload: { quantity: 2 } },
          { seq: 2, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: trouserLine.id }, payload: { clientRef: randomUUID() } },
        ]);
        expect(qty.preview.ok && Number(qty.preview.projectedTotal)).toBeGreaterThan(Number(createdHeader.total_amount));
        expect((await items()).find((i) => i.id === trouserLine.id)?.quantity).toBe(2);

        // ─── 4. Add a line, priced from today's catalog ──────────────────
        const newLineRef = randomUUID();
        const added = await edit([{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: newLineRef, productId: trouser, quantity: 1 } }]);
        const afterAdd = await items();
        expect(afterAdd).toHaveLength(3);
        const addedLine = afterAdd.find((i) => ![shirtLine.id, trouserLine.id].includes(i.id));
        expect(money(addedLine?.total_price)).toBe(money(5));
        expect(added.preview.ok).toBe(true);

        // ─── 5. Add a priced preference, then remove it ──────────────────
        const prefRef = randomUUID();
        const before = Number((await header()).total_amount);
        await edit([{ seq: 1, code: 'ADD_PREFERENCE', target: { kind: 'PERSISTED_ITEM', id: shirtLine.id }, payload: { clientRef: prefRef, preferenceId: starch.id, preferenceCode: starch.preference_code } }]);
        expect(Number((await header()).total_amount)).toBeGreaterThan(before);
        const prefRow = (await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.org_order_preferences_dtl
          WHERE tenant_org_id = ${tenantId}::uuid AND order_id = ${orderId}::uuid AND order_item_id = ${shirtLine.id}::uuid
            AND preference_code = ${starch.preference_code} AND rec_status = 1`)[0];
        expect(prefRow).toBeDefined();
        await edit([{ seq: 1, code: 'REMOVE_PREFERENCE', target: { kind: 'PERSISTED_PREFERENCE', id: prefRow.id }, payload: {} }]);
        expect(money((await header()).total_amount)).toBe(money(before));

        // ─── 6. Speed change (PF-26): the rule prices the line, pieces follow, ready-by moves ──
        const standardShirtReadyBy = (await items()).find((i) => i.id === shirtLine.id)?.ready_by_at;
        await edit([{ seq: 1, code: 'CHANGE_SERVICE_SPEED', target: { kind: 'ORDER' }, payload: { serviceSpeed: 'EXPRESS' } }]);
        const expressShirt = (await items()).find((i) => i.id === shirtLine.id);
        expect(expressShirt?.service_speed).toBe('EXPRESS');
        expect(money(expressShirt?.total_price)).toBe(money(6));
        const expressHeader = await header();
        expect(expressHeader.service_speed).toBe('EXPRESS');
        // The shirt is counted again on its 6-hour rule; the order is ready when its latest line is.
        expect(expressShirt?.ready_by_at?.getTime()).toBeLessThan(standardShirtReadyBy!.getTime());
        const latestLine = Math.max(...(await items()).map((i) => i.ready_by_at?.getTime() ?? 0));
        expect(expressHeader.ready_by?.getTime()).toBe(latestLine);

        // ─── 7. Remove a line ────────────────────────────────────────────
        await edit([{ seq: 1, code: 'REMOVE_ITEM', target: { kind: 'PERSISTED_ITEM', id: addedLine!.id }, payload: {} }]);
        expect(await items()).toHaveLength(2);

        // ─── 8. A new line at an override price ──────────────────────────
        const overrideRef = randomUUID();
        await edit([{ seq: 1, code: 'ADD_ITEM', target: { kind: 'ORDER' }, payload: { clientRef: overrideRef, productId: trouser, quantity: 1, priceOverride: '4.500', overrideReason: 'Parity override' } }]);
        const overridden = (await items()).find((i) => ![shirtLine.id, trouserLine.id].includes(i.id));
        expect(money(overridden?.total_price)).toBe(money(4.5));

        // ─── 9. An order from before the calculator is refused for money edits ──
        await tx.$executeRaw`
          UPDATE public.org_orders_mst SET commercial_calc_version = NULL
          WHERE tenant_org_id = ${tenantId}::uuid AND id = ${orderId}::uuid`;
        const legacy = await edit([
          { seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: { kind: 'PERSISTED_ITEM', id: trouserLine.id }, payload: { quantity: 3 } },
          { seq: 2, code: 'ADD_PIECE', target: { kind: 'PERSISTED_ITEM', id: trouserLine.id }, payload: { clientRef: randomUUID() } },
        ], true);
        expect(legacy.preview).toMatchObject({ ok: false, status: 422, code: 'ORDER_NEEDS_RECOMPUTE' });
        // A header-only edit still works on it.
        await expect(edit([{ seq: 1, code: 'CHANGE_ORDER_NOTES', target: { kind: 'ORDER' }, payload: { notes: 'Legacy note' } }]))
          .resolves.toMatchObject({ applied: { ok: true } });
      } finally {
        delete (globalThis as { __editParityTx?: unknown }).__editParityTx;
      }
      throw new Error(ROLLBACK);
    }, { timeout: 120000 })).rejects.toThrow(ROLLBACK);
    expect(await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.sys_oc_edit_policy_mst WHERE id = ${policyId}::uuid`).toEqual([]);
  }, 150000);
});
