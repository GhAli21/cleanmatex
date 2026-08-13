# Testing Guide And Scenarios — Workflow Order Advance

## Fast validation commands

Run from `web-admin`:

```bash
npx jest __tests__/services/workflow-service.test.ts __tests__/services/workflow-profile.service.test.ts __tests__/services/public-order-tracking.service.test.ts __tests__/services/item-processing-service.test.ts __tests__/services/delivery-service.test.ts __tests__/api/v1/orders/confirm-physical-intake.route.test.ts __tests__/lib/workflow/order-control-transition.test.ts __tests__/lib/security/public-routes.test.ts --runInBand
npx playwright test e2e/public-order-tracking.spec.ts --project=public-chromium --reporter=line
npx eslint . --quiet
npx tsc --noEmit
npm run build
```

2026-08-13 implementation evidence: 8 Jest suites / 49 tests passed; anonymous Playwright 2/2 passed; full ESLint passed; production build passed across 271 pages/routes. Standalone TypeScript reports four pre-existing baseline diagnostics outside this cutover; no new workflow diagnostics remain.

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

## Engine retirement scenarios

1. Before `0442`, verify preparation complete, batch auto-ready, intake, POD, public confirmation, cancel, hold/resume, and stop use engine actions.
2. Apply `0442`, repeat the same smoke, and watch for denied RPC calls.
3. Verify raw PATCH and bulk status calls return `410` rather than mutating an order.
4. Verify screen contracts and state available-actions still load from catalogs.

## Post-deploy pending scenarios

- Pilot-tenant e2e for release, pickup, delivery, finance gates, and outbox consumers
- Full T01-T18 acceptance and rollback rehearsal
