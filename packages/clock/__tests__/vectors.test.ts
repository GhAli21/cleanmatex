/**
 * T60 + §7.13: the shared vectors under the polyfill adapter and under a native Temporal
 * runtime. Node 24 does not ship Temporal, so the native run is simulated by installing the
 * polyfill namespace as `globalThis.Temporal`; that exercises the adapter's native branch.
 * When a runtime ships real Temporal, the "native" run uses it unchanged.
 */
// clock-ok: this test installs and removes globalThis.Temporal to exercise the adapter (D1, T60)
import * as clock from '@cmx/clock';
import { allCases, runCase } from './run-vectors';

const g = globalThis as { Temporal?: unknown };
const realNative = g.Temporal;

describe('shared vectors', () => {
  it('has unique ids and every kind covered', () => {
    const ids = allCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = new Set(allCases.map((c) => c.kind));
    for (const k of ['today', 'localParts', 'toLocal', 'atLocal', 'dayBounds', 'periodKey', 'businessDate',
      'businessDayBounds', 'civilAdd', 'zoneValid', 'catalog', 'settings', 'clockBlock', 'parseInstant', 'zoneResolution']) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  describe('polyfill adapter', () => {
    beforeAll(() => {
      delete g.Temporal;
      expect(clock.temporalSource()).toBe('polyfill');
    });
    afterAll(() => {
      if (realNative) g.Temporal = realNative;
    });
    it.each(allCases.map((c) => [c.id, c] as const))('%s', (_id, c) => runCase(c));
  });

  describe('native adapter', () => {
    beforeAll(() => {
      if (!realNative) g.Temporal = clock.__polyfillTemporalForTests();
      expect(clock.temporalSource()).toBe('native');
    });
    afterAll(() => {
      if (realNative) g.Temporal = realNative;
      else delete g.Temporal;
    });
    it.each(allCases.map((c) => [c.id, c] as const))('%s', (_id, c) => runCase(c));
  });
});
