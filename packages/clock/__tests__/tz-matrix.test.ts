/** Proves the TZ matrix really changed the process zone, so the other suites ran under it. */
describe('process time zone matrix', () => {
  const expected = process.env.CMX_EXPECTED_TZ;
  (expected ? it : it.skip)(`runs under TZ=${expected ?? '(not set)'}`, () => {
    const offsetMin = 0 - new Date('2026-11-26T00:00:00Z').getTimezoneOffset();
    expect(offsetMin).toBe(expected === 'Pacific/Kiritimati' ? 14 * 60 : 0);
  });
});
