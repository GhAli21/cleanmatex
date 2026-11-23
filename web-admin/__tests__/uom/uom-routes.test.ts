/**
 * @jest-environment node
 *
 * The 8 /api/v1/uom routes: each is gated by its permission (uom:view / uom:manage), validates id/code/body
 * before touching the service, passes the caller's tenant (never one from the request), and maps rule errors.
 */
import { NextRequest, NextResponse } from 'next/server';

let denied = false;
const perms: string[] = [];
jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (perm: string) => async () => {
    perms.push(perm);
    return denied ? NextResponse.json({}, { status: 403 }) : { tenantId: 't1', userId: 'u1' };
  },
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }, log: { error: jest.fn() } }));

jest.mock('@/lib/services/uom.service', () => {
  const names = ["listUnits", "addSystemUnits", "createCustomUnit", "updateUnit", "resetUnit", "listConversions", "createConversion", "updateConversion", "resetConversion", "listAddableSystemUnits", "loadUomResolver"];
  return Object.fromEntries(names.map((n) => [n, jest.fn()]));
});

import * as units from '@/app/api/v1/uom/units/route';
import * as unit from '@/app/api/v1/uom/units/[code]/route';
import * as unitReset from '@/app/api/v1/uom/units/[code]/reset/route';
import * as convs from '@/app/api/v1/uom/conversions/route';
import * as conv from '@/app/api/v1/uom/conversions/[id]/route';
import * as convReset from '@/app/api/v1/uom/conversions/[id]/reset/route';
import * as catalog from '@/app/api/v1/uom/catalog/route';
import * as convert from '@/app/api/v1/uom/convert/route';
import { UomRuleError } from '@/lib/uom/errors';

const svc = jest.requireMock('@/lib/services/uom.service') as Record<string, jest.Mock>;
const ID = '0a000000-0000-4000-8000-000000000001';
const req = (method: string, body?: unknown, qs = '') =>
  new NextRequest(`http://x/api/v1/uom${qs}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });

type Call = () => Promise<Response>;
const gated: [string, string, Call][] = [
  ['GET units', 'uom:view', () => units.GET(req('GET'))],
  ['POST units', 'uom:manage', () => units.POST(req('POST', {}))],
  ['PATCH unit', 'uom:manage', () => unit.PATCH(req('PATCH', {}), p({ code: 'KG' }))],
  ['POST unit reset', 'uom:manage', () => unitReset.POST(req('POST'), p({ code: 'KG' }))],
  ['GET conversions', 'uom:view', () => convs.GET(req('GET'))],
  ['POST conversions', 'uom:manage', () => convs.POST(req('POST', {}))],
  ['PATCH conversion', 'uom:manage', () => conv.PATCH(req('PATCH', {}), p({ id: ID }))],
  ['POST conversion reset', 'uom:manage', () => convReset.POST(req('POST'), p({ id: ID }))],
  ['GET catalog', 'uom:manage', () => catalog.GET(req('GET'))],
  ['POST convert', 'uom:view', () => convert.POST(req('POST', {}))],
];

beforeEach(() => { denied = false; perms.length = 0; Object.values(svc).forEach((m) => m.mockReset()); });

describe.each(gated)('%s', (_n, perm, call) => {
  it(`requires ${perm} and stops at 403 before any service call`, async () => {
    denied = true;
    expect((await call()).status).toBe(403);
    expect(perms).toEqual([perm]);
    Object.values(svc).forEach((m) => expect(m).not.toHaveBeenCalled());
  });
});

describe('validation before the service', () => {
  it('rejects a bad unit code, bad uuid and bad body with 400', async () => {
    expect((await unit.PATCH(req('PATCH', {}), p({ code: 'kg!' }))).status).toBe(400);
    expect((await unitReset.POST(req('POST'), p({ code: '1x' }))).status).toBe(400);
    expect((await conv.PATCH(req('PATCH', {}), p({ id: 'nope' }))).status).toBe(400);
    expect((await convReset.POST(req('POST'), p({ id: 'nope' }))).status).toBe(400);
    expect((await convs.GET(req('GET', undefined, '?product_id=nope'))).status).toBe(400);
    expect((await convert.POST(req('POST', { quantity: 'x' }))).status).toBe(400);
    expect((await units.POST(req('POST', { kind: 'bogus' }))).status).toBe(400);
    expect((await convs.POST(req('POST', {}))).status).toBe(400);
    Object.values(svc).forEach((m) => expect(m).not.toHaveBeenCalled());
  });
});

describe('happy paths use the session tenant', () => {
  it('lists units with activeOnly default and override', async () => {
    svc.listUnits.mockResolvedValue([]);
    await units.GET(req('GET'));
    await units.GET(req('GET', undefined, '?active_only=false'));
    expect(svc.listUnits).toHaveBeenNthCalledWith(1, 't1', { activeOnly: true });
    expect(svc.listUnits).toHaveBeenNthCalledWith(2, 't1', { activeOnly: false });
  });

  it('adds system units and answers 201', async () => {
    svc.addSystemUnits.mockResolvedValue(2);
    const res = await units.POST(req('POST', { kind: 'system', codes: ['KG', 'M'] }));
    expect(res.status).toBe(201);
    expect(svc.addSystemUnits.mock.calls[0][0]).toBe('t1');
    expect((await res.json()).data).toEqual({ added: 2 });
  });

  it('resets a unit and a conversion', async () => {
    expect((await unitReset.POST(req('POST'), p({ code: 'KG' }))).status).toBe(200);
    expect(svc.resetUnit).toHaveBeenCalledWith('t1', 'u1', 'KG');
    expect((await convReset.POST(req('POST'), p({ id: ID }))).status).toBe(200);
    expect(svc.resetConversion).toHaveBeenCalledWith('t1', 'u1', ID);
  });

  it('lists conversions for one product', async () => {
    svc.listConversions.mockResolvedValue([]);
    await convs.GET(req('GET', undefined, `?product_id=${ID}`));
    expect(svc.listConversions).toHaveBeenCalledWith('t1', { productId: ID });
  });

  it('previews a conversion', async () => {
    const D = (s: string) => ({ toDecimalPlaces: () => ({ toString: () => s }) });
    svc.loadUomResolver.mockResolvedValue({ convert: () => D('2.2'), rate: () => ({ toString: () => '2.2' }) });
    const res = await convert.POST(req('POST', { quantity: '1', fromCode: 'KG', toCode: 'LB' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ quantity: '2.2', rate: '2.2' });
  });

  it('maps a service rule error to its status', async () => {
    svc.resetUnit.mockRejectedValue(new UomRuleError('UOM_NOT_FOUND', 'x'));
    expect((await unitReset.POST(req('POST'), p({ code: 'KG' }))).status).toBe(404);
  });
});
