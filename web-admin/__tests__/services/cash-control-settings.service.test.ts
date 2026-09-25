/**
 * Tests: cash-control-settings.service (POS Session & Cash Drawer Hardening, W0-7)
 *
 * Covers:
 * - getCashControlSettings — default fallback with zero rows
 * - getCashControlSettings — full precedence chain DRAWER > USER > BRANCH > TENANT
 * - getCashControlSettings — malformed stored value falls back, never throws
 * - getCashControlSettings — tenant isolation (tenant_org_id always filtered)
 * - withCashControlSettingsCache — memoizes within one wrapped call, not across
 * - updateCashControlSettings — create / update / clear audit actions
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSettingsFindMany = jest.fn();
const mockSettingsFindFirst = jest.fn();
const mockSettingsUpdate = jest.fn();
const mockSettingsCreate = jest.fn();
const mockAuditCreateMany = jest.fn();
const mockDrawerFindFirst = jest.fn();
const mockDrawerTypeFindUnique = jest.fn();

const mockTxClient = {
  org_fin_cash_ctrl_stng_cf: {
    findFirst: (...a: unknown[]) => mockSettingsFindFirst(...a),
    update: (...a: unknown[]) => mockSettingsUpdate(...a),
    create: (...a: unknown[]) => mockSettingsCreate(...a),
  },
  org_fin_cash_ctrl_audit_dtl: {
    createMany: (...a: unknown[]) => mockAuditCreateMany(...a),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_fin_cash_ctrl_stng_cf: {
      findMany: (...a: unknown[]) => mockSettingsFindMany(...a),
    },
    org_cash_drawers_mst: {
      findFirst: (...a: unknown[]) => mockDrawerFindFirst(...a),
    },
    sys_cash_drawer_type_cd: {
      findUnique: (...a: unknown[]) => mockDrawerTypeFindUnique(...a),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(mockTxClient),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

jest.mock('@/lib/utils/logger', () => ({
  log: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import {
  getCashControlSettings,
  getCashControlSettingsWithSource,
  updateCashControlSettings,
  withCashControlSettingsCache,
} from '@/lib/services/cash-control-settings.service';
import { CASH_CONTROL_SETTINGS_DEFAULT } from '@/lib/constants/cash-control';
import { log } from '@/lib/utils/logger';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const BRANCH_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const DRAWER_ID = '44444444-4444-4444-4444-444444444444';

function row(overrides: Record<string, unknown>) {
  return { id: 'row-id', tenant_org_id: TENANT_ID, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cash-control-settings.service — getCashControlSettings', () => {
  it('falls back to the full TS default when no override rows exist', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    const result = await getCashControlSettings({ tenantId: TENANT_ID });

    expect(result).toEqual(CASH_CONTROL_SETTINGS_DEFAULT);
  });

  it('always scopes the read by tenant_org_id (tenant isolation)', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    await getCashControlSettings({ tenantId: TENANT_ID, branchId: BRANCH_ID });

    const callArgs = mockSettingsFindMany.mock.calls[0][0];
    expect(callArgs.where.tenant_org_id).toBe(TENANT_ID);
  });

  it('resolves DRAWER > USER > BRANCH > TENANT precedence per field independently', async () => {
    mockSettingsFindMany.mockResolvedValue([
      row({ scope_level: 'TENANT', scope_id: null, blind_close_enabled: false, variance_gate_mode: 'WARN_ONLY' }),
      row({ scope_level: 'BRANCH', scope_id: BRANCH_ID, blind_close_enabled: true, variance_gate_mode: null }),
      row({ scope_level: 'USER', scope_id: USER_ID, variance_gate_mode: 'APPROVAL_REQUIRED' }),
      row({ scope_level: 'DRAWER', scope_id: DRAWER_ID, blind_close_enabled: null, variance_gate_mode: null }),
    ]);

    const result = await getCashControlSettings({
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      userId: USER_ID,
      drawerId: DRAWER_ID,
    });

    // DRAWER row has blind_close_enabled = NULL -> falls through to BRANCH's `true`.
    expect(result.blindCloseEnabled).toBe(true);
    // USER row sets variance_gate_mode -> wins over TENANT's WARN_ONLY.
    expect(result.varianceGateMode).toBe('APPROVAL_REQUIRED');
  });

  it('falls back to the default and logs a WARN when a stored value is malformed, without throwing', async () => {
    mockSettingsFindMany.mockResolvedValue([
      row({ scope_level: 'TENANT', scope_id: null, variance_gate_mode: 'NOT_A_REAL_MODE' }),
    ]);

    const result = await getCashControlSettings({ tenantId: TENANT_ID });

    expect(result.varianceGateMode).toBe(CASH_CONTROL_SETTINGS_DEFAULT.varianceGateMode);
    expect(log.warn).toHaveBeenCalled();
  });

  it('falls back to full defaults and logs ERROR when the DB read itself throws', async () => {
    mockSettingsFindMany.mockRejectedValue(new Error('connection lost'));

    const result = await getCashControlSettings({ tenantId: TENANT_ID });

    expect(result).toEqual(CASH_CONTROL_SETTINGS_DEFAULT);
    expect(log.error).toHaveBeenCalled();
  });
});

describe('cash-control-settings.service — non-UUID actor ids', () => {
  it("keeps tenant overrides when the acting user id is not a UUID (e.g. 'system')", async () => {
    mockSettingsFindMany.mockResolvedValue([
      row({ scope_level: 'TENANT', scope_id: null, blind_close_enabled: true }),
    ]);

    const result = await getCashControlSettings({ tenantId: TENANT_ID, userId: 'system' });

    expect(result.blindCloseEnabled).toBe(true);
    const scopes = mockSettingsFindMany.mock.calls[0][0].where.OR.map((f: { scope_level: string }) => f.scope_level);
    expect(scopes).toEqual(['TENANT']);
  });
});

describe('cash-control-settings.service — drawer-type default layer (CLF)', () => {
  const TYPE_DEFAULTS_DRIVER_BAG = {
    requires_session_default: false,
    opening_count_required_default: false,
    closing_count_required_default: false,
  };

  it('uses the drawer type default when no scope sets the value, and reports TYPE_DEFAULT as the source', async () => {
    mockSettingsFindMany.mockResolvedValue([]);
    mockDrawerFindFirst.mockResolvedValue({ drawer_type: 'DRIVER_BAG' });
    mockDrawerTypeFindUnique.mockResolvedValue(TYPE_DEFAULTS_DRIVER_BAG);

    const { settings, sources } = await getCashControlSettingsWithSource({ tenantId: TENANT_ID, drawerId: DRAWER_ID });

    expect(settings.requiresSession).toBe(false);
    expect(sources.requiresSession).toBe('TYPE_DEFAULT');
    // Fields without a type layer keep the constant default.
    expect(sources.blindCloseEnabled).toBe('DEFAULT');
  });

  it('lets a DRAWER-scope override beat the type default', async () => {
    mockSettingsFindMany.mockResolvedValue([
      row({ scope_level: 'DRAWER', scope_id: DRAWER_ID, requires_session: true }),
    ]);
    mockDrawerFindFirst.mockResolvedValue({ drawer_type: 'DRIVER_BAG' });
    mockDrawerTypeFindUnique.mockResolvedValue(TYPE_DEFAULTS_DRIVER_BAG);

    const { settings, sources } = await getCashControlSettingsWithSource({ tenantId: TENANT_ID, drawerId: DRAWER_ID });

    expect(settings.requiresSession).toBe(true);
    expect(sources.requiresSession).toBe('DRAWER');
  });

  it('does not consult the drawer tables when no drawer is in scope', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    const result = await getCashControlSettings({ tenantId: TENANT_ID });

    expect(result.requiresSession).toBe(CASH_CONTROL_SETTINGS_DEFAULT.requiresSession);
    expect(mockDrawerFindFirst).not.toHaveBeenCalled();
  });

  it('scopes the drawer lookup by tenant', async () => {
    mockSettingsFindMany.mockResolvedValue([]);
    mockDrawerFindFirst.mockResolvedValue(null);

    await getCashControlSettings({ tenantId: TENANT_ID, drawerId: DRAWER_ID });

    expect(mockDrawerFindFirst.mock.calls[0][0].where).toEqual({ id: DRAWER_ID, tenant_org_id: TENANT_ID });
  });

  it('keeps every scope override when the type lookup fails (isolated failure, WARN only)', async () => {
    mockSettingsFindMany.mockResolvedValue([
      row({ scope_level: 'TENANT', scope_id: null, blind_close_enabled: true }),
    ]);
    mockDrawerFindFirst.mockRejectedValue(new Error('drawer read failed'));

    const result = await getCashControlSettings({ tenantId: TENANT_ID, drawerId: DRAWER_ID });

    expect(result.blindCloseEnabled).toBe(true);
    expect(result.requiresSession).toBe(CASH_CONTROL_SETTINGS_DEFAULT.requiresSession);
    expect(log.warn).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe('cash-control-settings.service — withCashControlSettingsCache', () => {
  it('memoizes repeated calls with the same scope inside one wrapped call', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    await withCashControlSettingsCache(async () => {
      await getCashControlSettings({ tenantId: TENANT_ID });
      await getCashControlSettings({ tenantId: TENANT_ID });
    });

    expect(mockSettingsFindMany).toHaveBeenCalledTimes(1);
  });

  it('does not memoize across separate (unwrapped) calls', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    await getCashControlSettings({ tenantId: TENANT_ID });
    await getCashControlSettings({ tenantId: TENANT_ID });

    expect(mockSettingsFindMany).toHaveBeenCalledTimes(2);
  });
});

describe('cash-control-settings.service — updateCashControlSettings', () => {
  it('creates a new override row and a CREATE audit row when none existed', async () => {
    mockSettingsFindFirst.mockResolvedValue(null);
    mockSettingsFindMany.mockResolvedValue([]);

    await updateCashControlSettings(
      { tenantId: TENANT_ID },
      { blindCloseEnabled: true },
      { userId: USER_ID, reason: 'enable blind close' }
    );

    expect(mockSettingsCreate).toHaveBeenCalledTimes(1);
    expect(mockSettingsUpdate).not.toHaveBeenCalled();

    const auditRows = mockAuditCreateMany.mock.calls[0][0].data;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      setting_column: 'blind_close_enabled',
      audit_action: 'CREATE',
      changed_by: USER_ID,
      change_reason: 'enable blind close',
    });
  });

  it('updates an existing override row and records an UPDATE audit row', async () => {
    mockSettingsFindFirst.mockResolvedValue(row({ scope_level: 'TENANT', scope_id: null, blind_close_enabled: false }));
    mockSettingsFindMany.mockResolvedValue([]);

    await updateCashControlSettings(
      { tenantId: TENANT_ID },
      { blindCloseEnabled: true },
      { userId: USER_ID }
    );

    expect(mockSettingsUpdate).toHaveBeenCalledTimes(1);
    expect(mockSettingsCreate).not.toHaveBeenCalled();

    const auditRows = mockAuditCreateMany.mock.calls[0][0].data;
    expect(auditRows[0]).toMatchObject({ audit_action: 'UPDATE', setting_column: 'blind_close_enabled' });
  });

  it('treats an explicit null patch value as CLEAR, distinct from an absent field', async () => {
    mockSettingsFindFirst.mockResolvedValue(
      row({ scope_level: 'TENANT', scope_id: null, blind_close_enabled: true, variance_gate_mode: 'WARN_ONLY' })
    );
    mockSettingsFindMany.mockResolvedValue([]);

    await updateCashControlSettings(
      { tenantId: TENANT_ID },
      { blindCloseEnabled: null },
      { userId: USER_ID }
    );

    const auditRows = mockAuditCreateMany.mock.calls[0][0].data;
    // Only the field present in the patch is touched — variance_gate_mode is untouched.
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({ audit_action: 'CLEAR', setting_column: 'blind_close_enabled' });
  });

  it('targets the DRAWER scope row when a drawerId is the deepest id supplied', async () => {
    mockSettingsFindFirst.mockResolvedValue(null);
    mockSettingsFindMany.mockResolvedValue([]);

    await updateCashControlSettings(
      { tenantId: TENANT_ID, branchId: BRANCH_ID, userId: USER_ID, drawerId: DRAWER_ID },
      { blindCloseEnabled: true },
      { userId: USER_ID }
    );

    const findArgs = mockSettingsFindFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({ scope_level: 'DRAWER', scope_id: DRAWER_ID });
  });

  it('is a no-op read when the patch has no keys', async () => {
    mockSettingsFindMany.mockResolvedValue([]);

    await updateCashControlSettings({ tenantId: TENANT_ID }, {}, { userId: USER_ID });

    expect(mockSettingsFindFirst).not.toHaveBeenCalled();
    expect(mockSettingsCreate).not.toHaveBeenCalled();
  });
});
