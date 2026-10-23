/** @jest-environment node */

const mockFindFirst = jest.fn();
const mockItemFindMany = jest.fn();
const mockPieceFindMany = jest.fn();
const mockPreferenceFindMany = jest.fn();
const mockFinancialSummary = jest.fn();
const mockResolve = jest.fn();
const mockDisplay = jest.fn();
const mockOrganization = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: (...args: unknown[]) => mockDisplay(...args) }),
    org_tenants_mst: { findFirst: (...args: unknown[]) => mockOrganization(...args) },
    org_orders_mst: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    org_order_items_dtl: { findMany: (...args: unknown[]) => mockItemFindMany(...args) },
    org_order_item_pieces_dtl: { findMany: (...args: unknown[]) => mockPieceFindMany(...args) },
    org_order_preferences_dtl: { findMany: (...args: unknown[]) => mockPreferenceFindMany(...args) },
  },
}));
jest.mock('@/lib/services/order-financial-summary.service', () => ({
  getOrderFinancialSummary: (...args: unknown[]) => mockFinancialSummary(...args),
}));

jest.mock('@/lib/services/order-change/order-change-edit-policy-resolver.service', () => ({
  resolveOrderChangePolicyBindings: (...args: unknown[]) => mockResolve(...args),
}));

import { getOrderChangeContext, OrderChangeContextError } from '@/lib/services/order-change/order-change-context.service';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';
const ITEM_A = '33333333-3333-3333-3333-333333333333';
const ITEM_B = '44444444-4444-4444-4444-444444444444';
const PIECE_A = '55555555-5555-5555-5555-555555555555';

/**
 * Seeds only the committed, open-header baseline so each test can isolate one
 * eligibility invariant without repeating unrelated order facts.
 *
 * @param overrides - Header facts that make the baseline ineligible or exercise a boundary condition.
 */
function seedEligibleOrder(overrides: Record<string, unknown> = {}) {
  mockFindFirst.mockResolvedValue({
    id: ORDER_ID, order_no: 'ORD-1', committed_at: new Date('2026-10-03T00:00:00.000Z'), edit_state_version: 1, state_version: 7,
    edit_access_status: 'OPEN', edit_block_reason_code: null, edit_block_reason_text: null, edit_block_until: null,
    current_status: 'processing', wf_profile_id: null, wf_profile_version_id: null,
    customer_id: null, customer_name: 'Customer', customer_mobile_number: null, customer_email: null,
    branch_id: null, currency_code: 'OMR', priority: 'normal', service_speed: 'STANDARD', ready_by: null,
    internal_notes: null, customer_notes: null, ...overrides,
  });
  mockFinancialSummary.mockResolvedValue({ snapshot: { totalAmount: '10.0000', netCollectedAmount: '2.0000', outstandingAmount: '8.0000', overpaidAmount: '0.0000' } });
}

describe('getOrderChangeContext', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockResolve.mockResolvedValue({ resolutionLevel: 'DENY', denyReason: 'NO_AUTHORITY', editPolicyId: null, policyRevision: null, policyCode: null, bindings: [] });
    mockDisplay.mockResolvedValue([]);
    mockOrganization.mockResolvedValue({ timezone: 'Asia/Muscat' });
  });

  it('preserves stable identities and excludes NULL/0 commercial rows through explicit active queries', async () => {
    seedEligibleOrder();
    mockItemFindMany.mockResolvedValue([
      { id: ITEM_A, order_id: ORDER_ID, product_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', product_name: 'Shirt', product_name2: null, service_category_code: null, quantity: 1, price_per_unit: '5.000', total_price: '5.000', price_override: null, service_pref_charge: '0.0000', packing_pref_code: null },
      { id: ITEM_B, order_id: ORDER_ID, product_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', product_name: 'Shirt', product_name2: null, service_category_code: null, quantity: 1, price_per_unit: '5.000', total_price: '5.000', price_override: null, service_pref_charge: '0.0000', packing_pref_code: null },
    ]);
    mockPieceFindMany.mockResolvedValue([{ id: PIECE_A, order_id: ORDER_ID, order_item_id: ITEM_A, piece_seq: 1, piece_status: 'processing', piece_stage: null, scan_state: 'scanned' }]);
    mockPreferenceFindMany.mockResolvedValue([
      { id: '66666666-6666-6666-6666-666666666666', order_id: ORDER_ID, prefs_level: 'ORDER', order_item_id: null, order_item_piece_id: null, preference_id: null, preference_code: 'ORDER_PREF', preference_sys_kind: null, preference_category: null, preference_content: null, extra_price: '0.0000', processing_confirmed: false },
      { id: '77777777-7777-7777-7777-777777777777', order_id: ORDER_ID, prefs_level: 'ITEM', order_item_id: ITEM_A, order_item_piece_id: null, preference_id: null, preference_code: 'ITEM_PREF', preference_sys_kind: null, preference_category: null, preference_content: null, extra_price: '0.0000', processing_confirmed: false },
      { id: '88888888-8888-8888-8888-888888888888', order_id: ORDER_ID, prefs_level: 'PIECE', order_item_id: ITEM_A, order_item_piece_id: PIECE_A, preference_id: null, preference_code: 'PIECE_PREF', preference_sys_kind: null, preference_category: null, preference_content: null, extra_price: '0.0000', processing_confirmed: false },
    ]);

    const context = await getOrderChangeContext({ tenantId: TENANT_ID, orderId: ORDER_ID });

    expect(context.wfStateVersion).toBe(7);
    expect(context.items.map((item) => item.id)).toEqual([ITEM_A, ITEM_B]);
    expect(context.pieces[0]).toMatchObject({ id: PIECE_A, orderItemId: ITEM_A });
    expect(context.preferences.map((preference) => preference.id)).toHaveLength(3);
    expect(context.permissions.canEdit).toBe(false);
    expect(mockItemFindMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT_ID, order_id: ORDER_ID, rec_status: 1 });
    expect(mockPieceFindMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT_ID, order_id: ORDER_ID, rec_status: 1 });
    expect(mockPreferenceFindMany.mock.calls[0][0].where).toMatchObject({ tenant_org_id: TENANT_ID, order_id: ORDER_ID, rec_status: 1 });
  });

  it('retains the SQL-selected policy identity and status-hole reason without joining an override', async () => {
    seedEligibleOrder({ wf_profile_id: ITEM_A, wf_profile_version_id: ITEM_B });
    mockItemFindMany.mockResolvedValue([]);
    mockPieceFindMany.mockResolvedValue([]);
    mockPreferenceFindMany.mockResolvedValue([]);
    mockResolve.mockResolvedValue({ resolutionLevel: 'VERSION_DEFAULT', denyReason: 'STATUS_NOT_COVERED', editPolicyId: PIECE_A, policyRevision: 9, policyCode: 'STRICT', bindings: [] });
    mockDisplay.mockResolvedValue([{ profile_code: 'STANDARD', version_no: 2, version_status: 'PUBLISHED', policy_name: 'Strict', policy_name2: null, lifecycle_status: 'PUBLISHED' }]);
    const context = await getOrderChangeContext({ tenantId: TENANT_ID, orderId: ORDER_ID });
    expect(context.editPolicy).toMatchObject({ status: 'MISSING', resolutionLevel: 'VERSION_DEFAULT', denyReason: 'STATUS_NOT_COVERED', editPolicyId: PIECE_A, policyRevision: 9, rules: [] });
    expect(mockResolve).toHaveBeenCalledWith(expect.anything(), { tenantId: TENANT_ID, profileId: ITEM_A, profileVersionId: ITEM_B, workflowStatus: 'processing' });
    const sql = (mockDisplay.mock.calls[0][0] as TemplateStringsArray).join(' ');
    expect(sql).not.toContain('org_wf_edit_policy_asg_cf');
    expect(context.order.timezone).toBe('Asia/Muscat');
  });

  it.each([
    [{ committed_at: null, edit_state_version: 0 }, 'ORDER_NOT_COMMITTED'],
    [{ edit_state_version: 0 }, 'ORDER_NOT_COMMITTED'],
    [{ edit_access_status: 'PERMANENTLY_BLOCKED' }, 'EDIT_ACCESS_BLOCKED'],
    [{ state_version: 0 }, 'WORKFLOW_VERSION_UNAVAILABLE'],
  ])('fails closed for an ineligible header', async (overrides, code) => {
    seedEligibleOrder(overrides);
    await expect(getOrderChangeContext({ tenantId: TENANT_ID, orderId: ORDER_ID })).rejects.toMatchObject<OrderChangeContextError>({ code });
    expect(mockItemFindMany).not.toHaveBeenCalled();
  });

  it('rejects a preference whose active parent hierarchy is inconsistent', async () => {
    seedEligibleOrder();
    mockItemFindMany.mockResolvedValue([]);
    mockPieceFindMany.mockResolvedValue([]);
    mockPreferenceFindMany.mockResolvedValue([{ id: '66666666-6666-6666-6666-666666666666', order_id: ORDER_ID, prefs_level: 'ITEM', order_item_id: ITEM_A, order_item_piece_id: null, preference_id: null, preference_code: 'ITEM_PREF', preference_sys_kind: null, preference_category: null, preference_content: null, extra_price: '0.0000', processing_confirmed: false }]);
    await expect(getOrderChangeContext({ tenantId: TENANT_ID, orderId: ORDER_ID })).rejects.toMatchObject<OrderChangeContextError>({ code: 'INVALID_TARGET_HIERARCHY' });
  });
});
