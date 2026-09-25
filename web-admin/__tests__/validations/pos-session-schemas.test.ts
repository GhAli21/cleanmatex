/**
 * Schemas with a branchId field now use the async `zUuidIfEnabled` refinement,
 * so they must be parsed with parseAsync. The cmx_p_tmp flag is mocked ON so
 * these assertions keep testing strict UUID enforcement as they always have.
 */
jest.mock('@/lib/validations/cmx-temp-utils-para/cmx-temp-utils-para.service', () => ({
  cmxTempUtilsParaService: {
    isUuidCheckEnabled: jest.fn().mockResolvedValue(true),
    getUuidRegex: jest.fn().mockResolvedValue(null),
  },
}))

import {
  posSessionBranchQuerySchema,
  posSessionAutoLinkDrawerSchema,
  posSessionForceCloseSchema,
  posSessionListQuerySchema,
  posSessionOpenSchema,
  posSessionReasonSchema,
} from '@/lib/validations/pos-session-schemas';

const branchId = '11111111-1111-4111-8111-111111111111';
const terminalId = '22222222-2222-4222-8222-222222222222';
const posSessionId = '33333333-3333-4333-8333-333333333333';
const cashDrawerSessionId = '44444444-4444-4444-8444-444444444444';

describe('pos session validation schemas', () => {
  it('accepts manual open input with optional terminal and idempotency metadata', async () => {
    const parsed = await posSessionOpenSchema.parseAsync({
      branchId,
      terminalId,
      idempotencyKey: 'open-key',
      sourceChannel: 'pos',
      metadata: { device: 'front-counter' },
    });

    expect(parsed).toMatchObject({
      branchId,
      terminalId,
      idempotencyKey: 'open-key',
      sourceChannel: 'pos',
      metadata: { device: 'front-counter' },
    });
  });

  it('keeps terminal optional for user-owned sessions', async () => {
    expect(await posSessionOpenSchema.parseAsync({ branchId })).toEqual({ branchId });
  });

  it('rejects a malformed branchId when the UUID check is enabled', async () => {
    await expect(posSessionOpenSchema.parseAsync({ branchId: 'not-a-uuid' })).rejects.toThrow();
  });

  it('validates auto-link drawer input', async () => {
    expect(await posSessionAutoLinkDrawerSchema.parseAsync({
      posSessionId,
      branchId,
      cashDrawerSessionId,
      idempotencyKey: 'link-drawer-key',
      sourceChannel: 'session_hub',
    })).toMatchObject({
      posSessionId,
      branchId,
      cashDrawerSessionId,
      idempotencyKey: 'link-drawer-key',
      sourceChannel: 'session_hub',
    });

    await expect(posSessionAutoLinkDrawerSchema.parseAsync({
      posSessionId,
      cashDrawerSessionId: 'not-a-uuid',
    })).rejects.toThrow();
  });

  it('requires a non-empty reason for force-close but not normal lifecycle actions', () => {
    // posSessionReasonSchema / posSessionForceCloseSchema have no branchId — still sync.
    expect(posSessionReasonSchema.parse({ reason: '  lunch break  ' })).toEqual({
      reason: 'lunch break',
    });

    expect(() => posSessionForceCloseSchema.parse({ reason: '   ' })).toThrow();
    expect(posSessionForceCloseSchema.parse({ reason: 'Manager override' })).toEqual({
      reason: 'Manager override',
    });
  });

  it('normalizes list pagination defaults and restricts status/scope values', async () => {
    expect(await posSessionListQuerySchema.parseAsync({})).toEqual({
      page: 1,
      pageSize: 20,
      scope: 'own',
    });

    expect(await posSessionListQuerySchema.parseAsync({
      page: '2',
      pageSize: '50',
      status: 'FORCE_CLOSED',
      scope: 'all',
      operatorQuery: 'Rana',
      terminalQuery: 'Front',
      cashDrawerQuery: 'Main',
    })).toMatchObject({
      page: 2,
      pageSize: 50,
      status: 'FORCE_CLOSED',
      scope: 'all',
      operatorQuery: 'Rana',
      terminalQuery: 'Front',
      cashDrawerQuery: 'Main',
    });

    await expect(posSessionListQuerySchema.parseAsync({ status: 'FORCE_CLOSE' })).rejects.toThrow();
    await expect(posSessionListQuerySchema.parseAsync({ scope: 'manager' })).rejects.toThrow();
  });

  it('validates branch conflict query shape', async () => {
    expect(await posSessionBranchQuerySchema.parseAsync({ branchId })).toEqual({ branchId, includeContext: false });
    expect(await posSessionBranchQuerySchema.parseAsync({ branchId, includeContext: 'true' })).toEqual({
      branchId,
      includeContext: true,
    });
    expect(await posSessionBranchQuerySchema.parseAsync({ branchId, includeContext: 'false' })).toEqual({
      branchId,
      includeContext: false,
    });
    await expect(posSessionBranchQuerySchema.parseAsync({ branchId: 'not-a-uuid' })).rejects.toThrow();
    await expect(posSessionBranchQuerySchema.parseAsync({ branchId, includeContext: 'yes' })).rejects.toThrow();
  });
});
