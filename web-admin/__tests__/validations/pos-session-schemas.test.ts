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
  it('accepts manual open input with optional terminal and idempotency metadata', () => {
    const parsed = posSessionOpenSchema.parse({
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

  it('keeps terminal optional for user-owned sessions', () => {
    expect(posSessionOpenSchema.parse({ branchId })).toEqual({ branchId });
  });

  it('validates auto-link drawer input', () => {
    expect(posSessionAutoLinkDrawerSchema.parse({
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

    expect(() => posSessionAutoLinkDrawerSchema.parse({
      posSessionId,
      cashDrawerSessionId: 'not-a-uuid',
    })).toThrow();
  });

  it('requires a non-empty reason for force-close but not normal lifecycle actions', () => {
    expect(posSessionReasonSchema.parse({ reason: '  lunch break  ' })).toEqual({
      reason: 'lunch break',
    });

    expect(() => posSessionForceCloseSchema.parse({ reason: '   ' })).toThrow();
    expect(posSessionForceCloseSchema.parse({ reason: 'Manager override' })).toEqual({
      reason: 'Manager override',
    });
  });

  it('normalizes list pagination defaults and restricts status/scope values', () => {
    expect(posSessionListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      scope: 'own',
    });

    expect(posSessionListQuerySchema.parse({
      page: '2',
      pageSize: '50',
      status: 'FORCE_CLOSED',
      scope: 'all',
    })).toMatchObject({
      page: 2,
      pageSize: 50,
      status: 'FORCE_CLOSED',
      scope: 'all',
    });

    expect(() => posSessionListQuerySchema.parse({ status: 'FORCE_CLOSE' })).toThrow();
    expect(() => posSessionListQuerySchema.parse({ scope: 'manager' })).toThrow();
  });

  it('validates branch conflict query shape', () => {
    expect(posSessionBranchQuerySchema.parse({ branchId })).toEqual({ branchId, includeContext: false });
    expect(posSessionBranchQuerySchema.parse({ branchId, includeContext: 'true' })).toEqual({
      branchId,
      includeContext: true,
    });
    expect(posSessionBranchQuerySchema.parse({ branchId, includeContext: 'false' })).toEqual({
      branchId,
      includeContext: false,
    });
    expect(() => posSessionBranchQuerySchema.parse({ branchId: 'not-a-uuid' })).toThrow();
    expect(() => posSessionBranchQuerySchema.parse({ branchId, includeContext: 'yes' })).toThrow();
  });
});
