/**
 * @jest-environment node
 */
/**
 * UoM error plumbing: a database `UOM_*` message becomes a UomRuleError, and the route maps
 * each rule to its HTTP status with a message key (never a raw database message).
 */
import { throwIfUomRule, UomRuleError } from '@/lib/uom/errors';
import { uomErrorResponse } from '@/lib/api/uom-http';

jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }, log: { error: jest.fn() } }));

describe('throwIfUomRule', () => {
  it('turns a UOM_* database message into a UomRuleError', () => {
    expect(() => throwIfUomRule('UOM_IN_USE: unit KG is used by 3 product(s)')).toThrow(UomRuleError);
    try { throwIfUomRule('UOM_IN_USE: unit KG is used by 3 product(s)'); } catch (e) {
      expect((e as UomRuleError).code).toBe('UOM_IN_USE');
      expect((e as UomRuleError).message).toContain('unit KG is used');
    }
  });

  it('ignores anything else so the caller keeps its own error', () => {
    expect(() => throwIfUomRule('duplicate key value violates unique constraint')).not.toThrow();
    expect(() => throwIfUomRule(null)).not.toThrow();
  });
});

describe('uomErrorResponse', () => {
  const body = async (r: Response) => (await r.json()) as { error: { code: string; messageKey?: string } };

  it('maps rule errors to 404 / 409 / 422 with a message key', async () => {
    const cases: [ConstructorParameters<typeof UomRuleError>[0], number][] = [
      ['UOM_NOT_FOUND', 404], ['UOM_IN_USE', 409], ['UOM_CODE_RESERVED', 409], ['UOM_QTY_SCALE', 422],
    ];
    for (const [code, status] of cases) {
      const res = uomErrorResponse(new UomRuleError(code, 'x'), 'test');
      expect(res.status).toBe(status);
      expect((await body(res)).error).toMatchObject({ code, messageKey: `uom.errors.${code}` });
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('hides an unexpected error behind a 500', async () => {
    const res = uomErrorResponse(new Error('connection string leaked'), 'test');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain('leaked');
  });
});
