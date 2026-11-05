/**
 * HFC P3b: staff QR payload CMX1:<TYPE>:<code>.
 */
import { decodeCmxPayload, encodeCmxPayload } from '@/lib/services/scan-resolve/cmx-code-payload';

describe('cmx-code-payload', () => {
  it('round-trips', () => {
    const raw = encodeCmxPayload('pec', 'ORD-20261101-0001-1-2');
    expect(raw).toBe('CMX1:PEC:ORD-20261101-0001-1-2');
    expect(decodeCmxPayload(raw)).toEqual({ ok: true, payload: { version: 1, type: 'PEC', code: 'ORD-20261101-0001-1-2' } });
    expect(decodeCmxPayload('cmx1:ord:ord-20261101-0001')).toEqual({ ok: true, payload: { version: 1, type: 'ORD', code: 'ORD-20261101-0001' } });
  });

  it('explains what is wrong', () => {
    expect(decodeCmxPayload('ORD-1')).toEqual({ ok: false, reason: 'NOT_CMX' });
    expect(decodeCmxPayload('CMX2:ORD:X')).toEqual({ ok: false, reason: 'UNSUPPORTED_VERSION' });
    expect(decodeCmxPayload('CMX1:O1:X')).toEqual({ ok: false, reason: 'BAD_TYPE' });
    expect(decodeCmxPayload('CMX1:ORD: ')).toEqual({ ok: false, reason: 'EMPTY_CODE' });
  });

  it('refuses to build a bad payload', () => {
    expect(() => encodeCmxPayload('O', 'X')).toThrow();
    expect(() => encodeCmxPayload('ORD', ' ')).toThrow();
  });
});
