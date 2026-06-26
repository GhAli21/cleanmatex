# Payment Modal v4 — Baseline Payload Fixtures (regression oracle)

These fixtures freeze the **submit payload** produced by Payment Modal v4 *before* the
`usePaymentEngine` extraction begins. They are the regression oracle for Phases 1–2G:
the payload must stay byte-identical until intentional changes (never during extraction).

## Why runtime capture
At Phase 0 the payload is built inline inside `onSubmitForm` (`payment-modal-v4.tsx:2240`)
and passed to `onSubmit(paymentData, payload)` (`:3493`). It is **not** a pure function yet,
so it cannot be snapshotted by a unit test until Phase 2F extracts `buildPaymentPayload`.
Therefore the baseline is captured by **instrumenting the live submit** and saving JSON here.

## How to capture (one manual dev session)
1. In `new-order-modals.tsx`, temporarily wrap the payment `onSubmit` prop:
   ```ts
   onSubmit={(paymentData, payload) => {
     // TEMP — Phase 0 fixture capture; remove before commit
     // eslint-disable-next-line no-console
     console.log('PAYMENT_FIXTURE', JSON.stringify({ paymentData, payload }, null, 2));
     return originalOnSubmit(paymentData, payload);
   }}
   ```
2. `cd web-admin && npm run dev`, open New Order → add items → open Payment.
3. Run each scenario below, copy the logged JSON into the matching `*.json` file.
4. Remove the temporary instrumentation.

## Scenarios (one JSON file each)
| File | Scenario |
|---|---|
| `cash-exact.json` | Single cash leg, exact amount, fully settled |
| `cash-with-change.json` | Single cash leg, over-tendered, change returned |
| `card-gateway.json` | Card/gateway leg with reference/auth |
| `split.json` | Two+ legs summing to settled-now |
| `gift-card-pin.json` | Gift card applied, PIN required |
| `b2b-credit.json` | B2B credit-invoice / customer balance remainder |
| `overpayment-allocation.json` | Overpayment routed via allocation |
| `deferred-policy.json` | Pay-on-collection / no immediate amount |

## Oracle test
`payment-payload-oracle.test.ts` (currently `describe.skip`) is activated in **Phase 2F**:
it feeds each scenario's recorded inputs into the extracted `buildPaymentPayload` and asserts
deep-equality with the recorded `payload`. Until then, the gate is a **manual diff** of the
live payload against these fixtures after each extraction sub-phase.
