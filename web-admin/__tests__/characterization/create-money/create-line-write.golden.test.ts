/**
 * P1-01 characterization: the rows Create writes today
 * (`OrderService.createOrderInTransaction`): order header, item lines,
 * pieces, preference rows and PREFERENCE charges.
 *
 * A recording in-memory transaction stands in for Prisma. Exact values only;
 * `KNOWN DEFECT` / `FLOAT DIFF` cases pin today's behaviour on purpose.
 */

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })) }));
jest.mock('@/lib/services/order-source-policy', () => ({
  validateOrderSourceForCreation: jest.fn().mockResolvedValue({
    ok: true,
    row: { order_source_code: 'pos', requires_remote_intake_confirm: false },
  }),
}));
jest.mock('@/lib/services/workflow/workflow-profile-resolution.service', () => ({
  resolveWorkflowProfileBindingForOrderWithSupabase: jest.fn().mockResolvedValue({ initialRules: [] }),
  resolveWorkflowProfileBindingForOrderWithPrisma: jest.fn().mockResolvedValue({ initialRules: [] }),
  WorkflowProfileResolutionError: class WorkflowProfileResolutionError extends Error {},
}));
jest.mock('@/lib/services/workflow/order-create-workflow.service', () => ({
  resolveOrderCreateWorkflowState: jest.fn().mockResolvedValue({
    v_initialStatus: 'intake',
    v_transitionFrom: 'intake',
    v_orderStatus: 'intake',
    v_current_status: 'intake',
    v_current_stage: 'intake',
    physicalIntakeStatus: 'received',
    receivedAt: null,
    contractScreen: 'new_order',
    isRetailOnlyOrder: false,
    hydrated: {},
  }),
}));
jest.mock('@/lib/utils/order-number-generator', () => ({
  generateOrderNumberWithTx: jest.fn().mockResolvedValue('ORD-0001'),
}));
jest.mock('@/lib/utils/org-packing-extra-price', () => ({
  fetchOrgPackingExtraPriceByCodesSupabase: jest.fn(),
  fetchOrgPackingExtraPriceByCodesPrismaTx: jest.fn(async () => new Map([['HANG', 0.2], ['BOX', 0.5]])),
}));
jest.mock('@/lib/utils/org-service-preference-cf-lookup', () => ({
  fetchOrgServicePreferenceCfIdsByCodesPrismaTx: jest.fn(async () => new Map()),
}));

import { OrderService, type CreateOrderParams } from '@/lib/services/order-service';

const TENANT = 'tenant-golden-001';

type Rec = Record<string, unknown>;

/** Minimal recording Prisma transaction: every write is kept per model. */
function recordingTx() {
  const rows: Record<string, Rec[]> = {};
  let seq = 0;
  const store = (model: string, data: Rec) => {
    const row = { id: `${model}-${++seq}`, ...data };
    (rows[model] ??= []).push(row);
    return row;
  };
  const model = (name: string) => ({
    create: async ({ data }: { data: Rec }) => store(name, data),
    createMany: async ({ data }: { data: Rec[] }) => {
      data.forEach((d) => store(name, d));
      return { count: data.length };
    },
    findFirst: async () => (name === 'org_users_mst' ? { id: 'org-user-1' } : null),
    findMany: async ({ where }: { where: Rec }) =>
      (rows[name] ?? []).filter((r) =>
        Object.entries(where).every(([k, v]) =>
          v && typeof v === 'object' && 'gt' in (v as Rec)
            ? Number(r[k]) > Number((v as Rec).gt)
            : r[k] === v,
        ),
      ),
  });
  const tx = new Proxy({} as Rec, {
    get: (_t, prop: string) => (prop === '$executeRaw' ? jest.fn() : model(prop)),
  });
  return { tx, rows };
}

const baseParams = (over: Partial<CreateOrderParams> = {}): CreateOrderParams => ({
  tenantId: TENANT,
  customerId: 'cust-1',
  branchId: 'branch-1',
  orderTypeId: 'POS',
  userId: 'auth-user-1',
  userName: 'Cashier',
  currencyCode: 'OMR',
  items: [],
  ...over,
} as CreateOrderParams);

async function create(params: CreateOrderParams) {
  const { tx, rows } = recordingTx();
  const result = await OrderService.createOrderInTransaction(tx as never, params);
  expect(result.success).toBe(true);
  return rows;
}

describe('P1-01 golden — rows written by Create', () => {
  it('W01 KNOWN DEFECT (PF-02): item prices are the client values, even when the server totals differ', async () => {
    const rows = await create(baseParams({
      items: [{ productId: 'shirt', quantity: 1, pricePerUnit: 10, totalPrice: 10, serviceCategoryCode: 'DRY_CLEAN' }],
      totals: { subtotal: 9, discount: 0, tax: 0, total: 9, vatRate: 0, vatAmount: 0 },
    }));

    const item = rows.org_order_items_dtl[0];
    expect([item.price_per_unit, item.total_price, item.service_pref_charge]).toEqual([10, 10, 0]);
    const header = rows.org_orders_mst[0];
    expect([header.subtotal_amount, header.items_base_amount, header.total_amount, header.outstanding_amount]).toEqual([9, 9, 9, 9]);
  });

  it('W02 header money fields and express priority', async () => {
    const rows = await create(baseParams({
      express: true,
      items: [{ productId: 'shirt', quantity: 2, pricePerUnit: 5, totalPrice: 10 }],
      discountRate: 10,
      totals: {
        subtotal: 10,
        discount: 1,
        tax: 0.2,
        total: 9.65,
        vatRate: 5,
        vatAmount: 0.45,
        taxRate: 2,
        roundingAdjustment: 0,
        chargesTotal: 0,
      },
    }));
    const h = rows.org_orders_mst[0];
    expect({
      tenant: h.tenant_org_id,
      priority_multiplier: h.priority_multiplier,
      total_items: h.total_items,
      subtotal_amount: h.subtotal_amount,
      total_discount_amount: h.total_discount_amount,
      total_tax_amount: h.total_tax_amount,
      total_amount: h.total_amount,
      outstanding_amount: h.outstanding_amount,
      total_paid_amount: h.total_paid_amount,
      vat_rate: h.vat_rate,
      tax_rate: h.tax_rate,
      discount_rate: h.discount_rate,
      currency_code: h.currency_code,
      currency_ex_rate: h.currency_ex_rate,
    }).toEqual({
      tenant: TENANT,
      priority_multiplier: 0.5,
      total_items: 2,
      subtotal_amount: 10,
      total_discount_amount: 1,
      // total_tax_amount carries only the CUSTOM (additional) tax; VAT is separate.
      total_tax_amount: 0.2,
      total_amount: 9.65,
      outstanding_amount: 9.65,
      total_paid_amount: 0,
      vat_rate: 5,
      tax_rate: 2,
      discount_rate: 10,
      currency_code: 'OMR',
      currency_ex_rate: 1,
    });
  });

  it('W03 FLOAT DIFF FD-02: piece price = item total / qty, unrounded; item extras are spread over pieces', async () => {
    const rows = await create(baseParams({
      items: [{ productId: 'shirt', quantity: 3, pricePerUnit: 3, servicePrefCharge: 1, totalPrice: 10 }],
    }));
    const pieces = rows.org_order_item_pieces_dtl;
    expect(pieces).toHaveLength(3);
    // 10 / 3 = 3.3333333333333335 is sent; piece columns are numeric(19,4), so each
    // stores 3.3333 and the 3 pieces sum to 9.9999 while the item stores 10.000.
    expect(pieces.map((p) => [p.piece_seq, p.price_per_unit, p.total_price, p.quantity])).toEqual([
      [1, 10 / 3, 10 / 3, 1],
      [2, 10 / 3, 10 / 3, 1],
      [3, 10 / 3, 10 / 3, 1],
    ]);
    expect(pieces.every((p) => p.tenant_org_id === TENANT)).toBe(true);
  });

  it('W04 item service_pref_charge = service prefs + packing; packing is inferred from the catalog when not sent', async () => {
    const rows = await create(baseParams({
      items: [
        {
          productId: 'shirt',
          quantity: 1,
          pricePerUnit: 2,
          totalPrice: 2.5,
          servicePrefCharge: 0.3,
          packingPrefCode: 'HANG',
          servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.3 }],
        },
      ],
    }));
    const item = rows.org_order_items_dtl[0];
    expect(item.service_pref_charge).toBe(0.5);
    expect(rows.org_order_preferences_dtl.map((p) => [p.prefs_level, p.preference_sys_kind, p.preference_code, p.extra_price])).toEqual([
      ['ITEM', 'service_prefs', 'STARCH', 0.3],
      ['ITEM', 'packing_prefs', 'HANG', 0.2],
    ]);
  });

  it('W05 piece prefs: piece service_pref_charge = its own prefs + its packing; item-level prefs are not on pieces', async () => {
    const rows = await create(baseParams({
      items: [
        {
          productId: 'shirt',
          quantity: 2,
          pricePerUnit: 2,
          totalPrice: 5.2,
          servicePrefCharge: 0.4,
          packingPrefCharge: 0.8,
          servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.4 }],
          pieces: [
            { pieceSeq: 1, servicePrefs: [{ preference_code: 'PERFUME', extra_price: 0.25 }], packingPrefCode: 'BOX' },
            { pieceSeq: 2 },
          ],
        },
      ],
    }));
    const pieces = rows.org_order_item_pieces_dtl;
    expect(pieces.map((p) => [p.price_per_unit, p.service_pref_charge, p.packing_pref_code])).toEqual([
      [2.6, 0.75, 'BOX'],
      [2.6, 0, null],
    ]);
    // FLOAT DIFF FD-03: 0.4 + 0.8 = 1.2000000000000002 is sent; numeric(19,4) stores 1.2000.
    expect(rows.org_order_items_dtl[0].service_pref_charge).toBe(0.4 + 0.8);
    const piecePrefs = rows.org_order_preferences_dtl.filter((p) => p.prefs_level === 'PIECE');
    expect(piecePrefs.map((p) => [p.preference_sys_kind, p.preference_code, p.extra_price, p.prefs_no])).toEqual([
      ['service_prefs', 'PERFUME', 0.25, 1],
      ['packing_prefs', 'BOX', 0.5, 2],
    ]);
  });

  it('W06 ORDER-level preferences: rows, plus one PREFERENCE charge per priced row (free rows get none)', async () => {
    const rows = await create(baseParams({
      items: [{ productId: 'shirt', quantity: 1, pricePerUnit: 2, totalPrice: 2 }],
      orderServicePrefs: [
        { preference_code: 'EXPRESS_BAG', extra_price: 1 },
        { preference_code: 'FOLD_NOTE', extra_price: 0 },
      ],
      totals: { subtotal: 2, discount: 0, tax: 0, total: 3, vatRate: 0, vatAmount: 0, chargesTotal: 1 },
    }));
    const orderPrefs = rows.org_order_preferences_dtl.filter((p) => p.prefs_level === 'ORDER');
    expect(orderPrefs.map((p) => [p.preference_code, p.extra_price, p.prefs_source])).toEqual([
      ['EXPRESS_BAG', 1, 'ORDER_CREATE'],
      ['FOLD_NOTE', 0, 'ORDER_CREATE'],
    ]);
    expect(rows.org_order_charges_dtl.map((c) => ({
      tenant: c.tenant_org_id,
      type: c.charge_type,
      label: c.label,
      amount: c.amount,
      currency: c.currency_code,
      seq: c.applied_seq,
      source: c.charge_source_id,
    }))).toEqual([
      { tenant: TENANT, type: 'PREFERENCE', label: 'EXPRESS_BAG', amount: 1, currency: 'OMR', seq: 1, source: orderPrefs[0].id },
    ]);
    expect(rows.org_orders_mst[0].total_charges_amount).toBe(1);
  });

  it('W07 a price override is recorded with the reason and the org user (PF-01)', async () => {
    const rows = await create(baseParams({
      items: [{
        productId: 'shirt',
        quantity: 1,
        pricePerUnit: 8,
        totalPrice: 8,
        priceOverride: 8,
        overrideReason: '  Damaged item goodwill  ',
      }],
    }));
    const item = rows.org_order_items_dtl[0];
    expect([item.price_override, item.override_reason, item.override_by]).toEqual([8, 'Damaged item goodwill', 'org-user-1']);
  });

  it('W08 every row written carries the tenant id', async () => {
    const rows = await create(baseParams({
      items: [{
        productId: 'shirt',
        quantity: 1,
        pricePerUnit: 2,
        totalPrice: 2,
        servicePrefs: [{ preference_code: 'STARCH', extra_price: 0.3 }],
        pieces: [{ pieceSeq: 1, conditions: ['STAIN_OIL'], notes: 'collar' }],
      }],
      orderServicePrefs: [{ preference_code: 'EXPRESS_BAG', extra_price: 1 }],
    }));
    const all = Object.values(rows).flat();
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((r) => r.tenant_org_id === TENANT)).toBe(true);
  });
});
