jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_payment_methods_cf: {
      findMany: jest.fn(),
    },
    org_branch_payment_methods_cf: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

import { prisma } from '@/lib/db/prisma';
import {
  listBranchPaymentMethodViews,
  listCheckoutEligiblePaymentMethodConfigs,
  listEffectivePaymentMethodConfigs,
} from '@/lib/services/payment-config.service';

describe('payment-config service', () => {
  const baseTenantRow = {
    id: 'method-1',
    tenant_org_id: 'tenant-1',
    payment_method_code: 'CARD',
    gateway_code: null,
    display_name: 'Card',
    display_name2: 'بطاقة',
    description: null,
    description2: null,
    payment_nature: 'REAL_PAYMENT',
    settlement_type_code: null,
    credit_application_type: null,
    is_enabled: true,
    allowed_in_pos: true,
    allowed_in_customer_app: false,
    allowed_in_staff_app: true,
    allowed_in_admin_app: true,
    allowed_for_pay_now: true,
    allowed_for_pay_on_collection: false,
    allowed_for_invoice_payment: false,
    allowed_for_refund: true,
    supports_partial_payment: true,
    supports_overpayment: false,
    supports_change_return: false,
    requires_reference: false,
    requires_approval: false,
    requires_cash_drawer: false,
    requires_terminal: true,
    min_amount: null,
    max_amount: null,
    min_order_amount: null,
    max_order_amount: null,
    currency_code: null,
    fee_type: 'NONE',
    fee_amount: 0,
    fee_rate: 0,
    gateway_config: {},
    ui_config: {},
    validation_rules: {},
    metadata: {},
    display_order: 5,
    is_active: true,
    is_platform_disabled: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: 'user-1',
    updated_at: null,
    updated_by: null,
    rec_status: 1,
    sys_globally_disabled: false,
    sys_is_deprecated: false,
    gw_globally_disabled: false,
    eff_default_creation_status: 'COMPLETED',
    eff_allow_status_override: false,
    eff_requires_reference: true,
    eff_is_user_id_required: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies branch overrides when resolving effective payment methods', async () => {
    (prisma.org_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([
      {
        ...baseTenantRow,
        sys_payment_method_cd: {
          is_globally_disabled: false,
          is_deprecated: false,
          default_creation_status: 'COMPLETED',
          allow_status_override: false,
          requires_reference: true,
          is_user_id_required: false,
        },
        sys_payment_gateway_cd: null,
      },
    ]);
    (prisma.org_branch_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'override-1',
        tenant_org_id: 'tenant-1',
        branch_id: 'branch-1',
        org_payment_method_id: 'method-1',
        is_enabled: false,
        allowed_in_pos: false,
        allowed_in_customer_app: null,
        allowed_in_staff_app: null,
        allowed_for_pay_now: false,
        allowed_for_pay_on_collection: null,
        allowed_for_invoice_payment: null,
        allowed_for_refund: null,
        cash_drawer_required: true,
        terminal_required: false,
        min_amount: 5,
        max_amount: 100,
        branch_gateway_config: { branchTerminal: 'A1' },
        metadata: { source: 'branch' },
        display_order: 1,
        is_active: true,
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        updated_at: null,
        rec_status: 1,
      },
    ]);

    const [method] = await listEffectivePaymentMethodConfigs({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
    });

    expect(method.is_enabled).toBe(false);
    expect(method.allowed_in_pos).toBe(false);
    expect(method.allowed_for_pay_now).toBe(false);
    expect(method.requires_cash_drawer).toBe(true);
    expect(method.requires_terminal).toBe(false);
    expect(method.min_amount).toBe(5);
    expect(method.max_amount).toBe(100);
    expect(method.min_order_amount).toBe(5);
    expect(method.max_order_amount).toBe(100);
    expect(method.gateway_config).toEqual({ branchTerminal: 'A1' });
    expect(method.metadata).toMatchObject({
      branch_override: {
        id: 'override-1',
        branch_id: 'branch-1',
      },
    });
    expect(method.requires_reference).toBe(false);
    expect(method.default_creation_status).toBe('COMPLETED');
  });

  it('filters checkout methods by effective flags and order amount', async () => {
    (prisma.org_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([
      {
        ...baseTenantRow,
        id: 'method-ok',
        payment_method_code: 'CASH',
        min_order_amount: 10,
        max_order_amount: 50,
        sys_payment_method_cd: {
          is_globally_disabled: false,
          is_deprecated: false,
          default_creation_status: 'COMPLETED',
          allow_status_override: false,
          requires_reference: true,
          is_user_id_required: false,
        },
        sys_payment_gateway_cd: null,
      },
      {
        ...baseTenantRow,
        id: 'method-hidden',
        payment_method_code: 'INVOICE',
        allowed_in_pos: false,
        sys_payment_method_cd: {
          is_globally_disabled: false,
          is_deprecated: false,
          default_creation_status: 'COMPLETED',
          allow_status_override: false,
          requires_reference: true,
          is_user_id_required: false,
        },
        sys_payment_gateway_cd: null,
      },
      {
        ...baseTenantRow,
        id: 'method-disabled',
        payment_method_code: 'BANK_TRANSFER',
        sys_payment_method_cd: {
          is_globally_disabled: true,
          is_deprecated: false,
          default_creation_status: 'COMPLETED',
          allow_status_override: false,
          requires_reference: true,
          is_user_id_required: false,
        },
        sys_payment_gateway_cd: null,
      },
    ]);
    (prisma.org_branch_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([]);

    const methods = await listCheckoutEligiblePaymentMethodConfigs({
      tenantId: 'tenant-1',
      amount: 25,
    });

    expect(methods.map((method) => method.id)).toEqual(['method-ok']);
  });

  it('builds the branch override editor view with nullable inherited fields', async () => {
    (prisma.org_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([
      {
        ...baseTenantRow,
        sys_payment_method_cd: {
          is_globally_disabled: false,
          is_deprecated: false,
          default_creation_status: 'COMPLETED',
          allow_status_override: false,
          requires_reference: true,
          is_user_id_required: false,
        },
        sys_payment_gateway_cd: null,
      },
    ]);
    (prisma.org_branch_payment_methods_cf.findMany as jest.Mock).mockResolvedValue([]);

    const [row] = await listBranchPaymentMethodViews('tenant-1', 'branch-1');

    expect(row.payment_method_code).toBe('CARD');
    expect(row.display_name).toBe('Card');
    expect(row.is_enabled).toBeNull();
    expect(row.allowed_for_pay_now).toBeNull();
    expect(row.display_order).toBe(5);
  });
});
