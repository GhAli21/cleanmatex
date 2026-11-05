/** @jest-environment node */

/**
 * Line-Level P7-01: Speed Pricing routes. Each one checks its own permission and
 * passes the session tenant; writes check CSRF first; refusals keep their code.
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('server-only', () => ({}));

const service = {
  listSpeedRules: jest.fn(),
  createSpeedRule: jest.fn(),
  updateSpeedRule: jest.fn(),
  deleteSpeedRule: jest.fn(),
  bulkCreateSpeedRules: jest.fn(),
  setProductRulesActive: jest.fn(),
  resolveSpeedRule: jest.fn(),
};
const checked: string[] = [];
let allowed = true;
let csrfBlocked = false;

jest.mock('@/lib/services/catalog/speed-rules.service', () => {
  class SpeedRuleError extends Error {
    constructor(public code: string, public status: number) { super(code); }
  }
  return {
    SpeedRuleError,
    getSpeedRule: jest.fn(),
    listSpeedRules: (...a: unknown[]) => service.listSpeedRules(...a),
    createSpeedRule: (...a: unknown[]) => service.createSpeedRule(...a),
    updateSpeedRule: (...a: unknown[]) => service.updateSpeedRule(...a),
    deleteSpeedRule: (...a: unknown[]) => service.deleteSpeedRule(...a),
    bulkCreateSpeedRules: (...a: unknown[]) => service.bulkCreateSpeedRules(...a),
    setProductRulesActive: (...a: unknown[]) => service.setProductRulesActive(...a),
    resolveSpeedRule: (...a: unknown[]) => service.resolveSpeedRule(...a),
  };
});
jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: async () => (csrfBlocked ? NextResponse.json({}, { status: 403 }) : null),
}));
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (code: string) => async () => {
    checked.push(code);
    return allowed ? { tenantId: 'tenant-1', userId: 'u1' } : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  },
}));

import { SpeedRuleError } from '@/lib/services/catalog/speed-rules.service';
import { GET as listGET, POST as createPOST } from '@/app/api/v1/catalog/speed-rules/route';
import { DELETE as ruleDELETE, PATCH as rulePATCH } from '@/app/api/v1/catalog/speed-rules/[id]/route';
import { POST as bulkPOST } from '@/app/api/v1/catalog/speed-rules/bulk/route';
import { POST as bulkStatusPOST } from '@/app/api/v1/catalog/speed-rules/bulk-status/route';
import { GET as resolveGET } from '@/app/api/v1/catalog/speed-rules/resolve/route';

const RULE_ID = '22222222-2222-4222-8222-222222222222';
const rule = { serviceSpeed: 'EXPRESS', branchId: null, serviceCategoryCode: null, productId: null, speedPriceType: 'MULTIPLIER', multiplierSpeed: '0.3', effectiveFrom: '2026-01-01' };
const req = (path: string, method = 'GET', body?: unknown) =>
  new NextRequest(new URL(path, 'http://localhost'), { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = { params: Promise.resolve({ id: RULE_ID }) };

beforeEach(() => {
  Object.values(service).forEach((m) => m.mockReset());
  checked.length = 0;
  allowed = true;
  csrfBlocked = false;
});

describe('Speed Pricing routes', () => {
  it('lists with pricing:read and the session tenant', async () => {
    service.listSpeedRules.mockResolvedValue({ rows: [], total: 0 });
    const res = await listGET(req('/api/v1/catalog/speed-rules?serviceSpeed=EXPRESS&page=2'));
    expect(res.status).toBe(200);
    expect(checked).toEqual(['pricing:read']);
    expect(service.listSpeedRules).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ serviceSpeed: 'EXPRESS', page: 2 }));
  });

  it.each([
    ['create', () => createPOST(req('/api/v1/catalog/speed-rules', 'POST', rule)), 'pricing:create', 'createSpeedRule', 201],
    ['update', () => rulePATCH(req(`/api/v1/catalog/speed-rules/${RULE_ID}`, 'PATCH', rule), params), 'pricing:update', 'updateSpeedRule', 200],
    ['delete', () => ruleDELETE(req(`/api/v1/catalog/speed-rules/${RULE_ID}`, 'DELETE'), params), 'pricing:delete', 'deleteSpeedRule', 200],
    ['bulk', () => bulkPOST(req('/api/v1/catalog/speed-rules/bulk', 'POST', { ...rule, serviceCategoryCode: 'DRY' })), 'pricing:bulk', 'bulkCreateSpeedRules', 201],
    ['bulk status', () => bulkStatusPOST(req('/api/v1/catalog/speed-rules/bulk-status', 'POST', { serviceSpeed: 'EXPRESS', isActive: false })), 'pricing:bulk', 'setProductRulesActive', 200],
  ] as const)('%s checks its permission and CSRF', async (_name, call, code, method, status) => {
    service[method].mockResolvedValue({});
    const ok = await call();
    expect(ok.status).toBe(status);
    expect(checked).toEqual([code]);
    expect(service[method].mock.calls[0][0]).toBe('tenant-1');

    service[method].mockClear();
    allowed = false;
    expect((await call()).status).toBe(403);

    allowed = true;
    csrfBlocked = true;
    const blocked = await call();
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ success: false, error: { code: 'CSRF_REJECTED' } });
    expect(service[method]).not.toHaveBeenCalled();
  });

  it('refuses an invalid rule before the service', async () => {
    const res = await createPOST(req('/api/v1/catalog/speed-rules', 'POST', { ...rule, multiplierSpeed: 'abc' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: { code: 'VALIDATION_FAILED' } });
    expect(service.createSpeedRule).not.toHaveBeenCalled();
  });

  it('keeps a refusal code and hides an unexpected error', async () => {
    service.deleteSpeedRule.mockRejectedValueOnce(new (SpeedRuleError as unknown as new (c: string, s: number) => Error)('RULE_IN_USE', 409));
    const inUse = await ruleDELETE(req(`/api/v1/catalog/speed-rules/${RULE_ID}`, 'DELETE'), params);
    expect(inUse.status).toBe(409);
    expect(await inUse.json()).toEqual({ success: false, error: { code: 'RULE_IN_USE' } });

    service.deleteSpeedRule.mockRejectedValueOnce(new Error('secret db detail'));
    const failed = await ruleDELETE(req(`/api/v1/catalog/speed-rules/${RULE_ID}`, 'DELETE'), params);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain('secret');
  });

  it('resolve needs a speed', async () => {
    expect((await resolveGET(req('/api/v1/catalog/speed-rules/resolve'))).status).toBe(400);
    service.resolveSpeedRule.mockResolvedValue({ winner: null, matched: [] });
    expect((await resolveGET(req('/api/v1/catalog/speed-rules/resolve?serviceSpeed=EXPRESS'))).status).toBe(200);
    expect(checked).toContain('pricing:read');
  });
});
