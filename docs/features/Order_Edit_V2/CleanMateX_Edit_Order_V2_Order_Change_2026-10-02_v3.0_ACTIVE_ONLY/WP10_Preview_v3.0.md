# WP10 Read-only Preview API

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for the read-only preview composition. Apply, distributed rate limiting, and review-key provisioning remain later gates.
**Authority:** Living plan WP10. Preview composes WP05–WP09 and does not write a Change.

## Scope delivered

`POST /api/v1/orders/[id]/changes/preview` validates the shared Change request, loads the current order context, and returns a review. The route requires `orders:edit` and CSRF. Tenant and actor come from the permission middleware.

`previewOrderChange` does not import Prisma, Supabase, the outbox, or idempotency. It evaluates each operation, projects structure and preferences, calculates the selling total, classifies the financial result, and issues a review proof only when the batch is allowed, acknowledged, financially unblocked, and a signer key was supplied. The same facts and clock produce the same fingerprint and proof.

- A real note change is `READY` and keeps the stored line price.
- A policy denial is `DENIED` and has no proof.
- An edit-version mismatch and a workflow-version mismatch are returned together as `VERSION_CONFLICT`.
- An unknown item is `UNKNOWN_ITEM`.
- A warning without an acknowledgement has no proof. The same warning with an acknowledgement can be `READY`.
- Every frozen V1 operation code is accepted when its own facts are supplied.
- An identical note is `NO_CHANGE` and creates no proof.
- Removing one item keeps the sibling item id.
- The deferred context flag is not used. The route reads `order_edit_v2`.

The public request still accepts removal only for persisted ids. Same-batch local cancellation stays inside the projectors.

## Files

- `web-admin/lib/services/order-change/order-change-preview.service.ts`
- `web-admin/lib/services/order-change/order-change-preview-reads.ts`
- `web-admin/app/api/v1/orders/[id]/changes/preview/route.ts`
- `web-admin/__tests__/services/order-change/order-change-preview.service.test.ts`
- `web-admin/__tests__/api/v1/orders/order-change-preview.route.test.ts`
- `web-admin/src/features/orders/access/orders-access.ts` — adds the `orders:edit` preview dependency on the existing edit route

No migration, feature-flag change, role grant, or screen was added. Create `/orders/preview` was not changed.

## Verification

Commands, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-preview.service.test.ts __tests__/api/v1/orders/order-change-preview.route.test.ts --runInBand --forceExit --watchman=false
npx eslint lib/services/order-change/order-change-preview.service.ts lib/services/order-change/order-change-preview-reads.ts app/api/v1/orders/[id]/changes/preview/route.ts __tests__/services/order-change/order-change-preview.service.test.ts __tests__/api/v1/orders/order-change-preview.route.test.ts src/features/orders/access/orders-access.ts --quiet
```

Results: 11 tests passed. ESLint exited 0. No production build, database test, or browser test is claimed. The route test mocks the fact loader. The service test scans the preview module for Prisma, Supabase, execute, outbox, and idempotency, and scans the read module for create, update, delete, and execute.

## Dependencies

- Uses the WP04 request schema and context loader. Context `featureEnabled: false` stays a deferred placeholder.
- Uses WP05 capability evaluation and the injected review-proof primitive.
- Uses WP06, WP07, WP08, and WP09 without changing their formulas.
- Settlement rows, quotes, tax mode, currency decimal places, and the preference catalog are loaded before the pure preview function runs.

## Gaps left to later packages

- Apply is not built. A preview proof is not a committed Change.
- Distributed Preview rate limiting is not wired. The route is not yet fail-closed on a missing limiter.
- Review-key provisioning is still open. Without `ORDER_CHANGE_REVIEW_PROOF_SECRET` and `ORDER_CHANGE_REVIEW_PROOF_KEY_ID`, a valid preview returns `SIGNER_UNAVAILABLE` and no proof.
- Organization preference rows do not store a level. The read path uses the server-derived parent level. A conflicting catalog level is still rejected when the caller supplies one.
- Compound tax profiles and currency-increment rounding stay outside this preview.
- Snapshot equality, fiscal document writing, and source-qualified follow-up execution remain later packages.
- `order_edit_v2` remains default-off until an operator enables it.

## Database, API, and UI

No database object changes. The new endpoint is read-only. No Edit screen was added.
