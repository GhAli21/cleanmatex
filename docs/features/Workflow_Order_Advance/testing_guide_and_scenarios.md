# Testing Guide And Scenarios — Workflow Order Advance

## Fast validation commands

Run from `web-admin`:

```bash
npm test -- __tests__/lib/utils/public-order-tracking.test.ts --runInBand
npm test -- __tests__/services/public-order-tracking.service.test.ts --runInBand
npx eslint __tests__/lib/utils/public-order-tracking.test.ts __tests__/services/public-order-tracking.service.test.ts --quiet
npm run build
```

## Public tracking focused scenarios

1. Opaque token helper behavior
   - valid token normalizes to lowercase
   - invalid token is rejected
   - opaque and legacy paths encode safely
2. Token service behavior
   - token resolves to tenant/order reference
   - missing token returns null
   - missing `0441` columns degrade safely without crashing
   - order detail link prefers `/track/{token}` and falls back to readable path during rollout
3. Customer page behavior
   - `PAY_ON_COLLECTION` balance shows remaining amount notice
   - confirm button disables when already delivered
   - confirm success updates status locally to delivered
4. API behavior
   - `ready` and `out_for_delivery` can confirm
   - already delivered returns idempotent success
   - other statuses reject

## Manual smoke after operator migration apply

1. Use a test order in `ready`.
2. Open the public link and verify the opaque token route.
3. Click confirm and verify the order reaches `delivered`.
4. Refresh and verify the button stays disabled.
5. Repeat with an `out_for_delivery` order.
6. Repeat with a `PAY_ON_COLLECTION` order that still has a balance.
7. Validate a legacy readable link still opens during the transition window.

## Broader pending scenarios

- Cancel / hold / stop smoke on V2 canary tenant
- Pilot-tenant e2e for release, pickup, and delivery
- Reader/writer retirement verification during P5
