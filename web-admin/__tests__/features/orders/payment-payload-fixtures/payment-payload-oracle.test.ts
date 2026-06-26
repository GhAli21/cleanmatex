/**
 * Payment Modal v4 — payload regression oracle.
 *
 * ACTIVATED IN PHASE 2F. Until `buildPaymentPayload` is extracted from
 * `payment-modal-v4.tsx` (onSubmitForm, ~:2240) into a pure function, this suite
 * stays skipped and the regression gate is a manual diff of the live submit
 * payload against the JSON fixtures in this folder (see README.md).
 *
 * When activated:
 *   - import { buildPaymentPayload } from '@features/orders/hooks/use-payment-submit';
 *   - for each fixture: feed recorded inputs, assert deep-equality with recorded payload.
 */

describe.skip('payment payload oracle (activate in Phase 2F)', () => {
  it('placeholder — replays Phase 0 fixtures through buildPaymentPayload', () => {
    expect(true).toBe(true);
  });
});
