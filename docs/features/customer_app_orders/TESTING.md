# Customer App Orders — Verification Matrix

## Identity and session

- Mobile/email sign-in returns the same generic response for unknown identifier and bad password.
- Phone normalization and verified-email matching select exactly one global identity.
- Temporary PIN expires, is rate limited, is never logged, and cannot be reused after password replacement.
- Forced password change blocks tenant/order/request APIs.
- Password reset revokes access and refresh sessions.
- App restart restores only a valid secure-storage session.

## Tenant and branch isolation

- A customer receives only their own tenant relationships.
- Customer hide/unhide changes only their own tenant-list visibility.
- Hidden relationship does not deactivate the tenant customer record or erase order history.
- A customer cannot read a tenant, branch, request, or order outside their membership.
- Customer-app and POS branch flags are independently enforced.

## Quick Drop request

- Fast Quick Drop never creates money, inventory consumption, or final priced item lines.
- Address, branch, speed, collection, and return-delivery validation matches tenant policy.
- Service-category and optional catalog declarations remain non-financial customer input.
- Repeated submit with the same idempotency key returns the same request.
- Only one staff order can be converted from a request, including concurrent conversion attempts.
- Customer sees request status until conversion and a safe link to the resulting owned order.

## Detailed Order

- Catalog items, branch eligibility, fulfillment, addresses, availability, and prices are validated server-side.
- Mobile display total equals server quote; the app performs no pricing calculation.
- Duplicate submission remains idempotent.

## UI and localization

- All web-admin UI uses Cmx components and `cmxMessage` where feedback applies.
- EN and AR messages ship together; Arabic layouts use logical directional spacing.
- Mobile covers loading, empty, error, offline, and success states for each new journey.
- Touch targets and screen-reader labels are reviewed on Android TalkBack and iOS VoiceOver.

## Commands

Run only the targeted suites first, then the affected application gates:

```powershell
cd web-admin
npx eslint . --quiet
npm run typecheck
npm run build

cd ..\cmx_mobile_apps
melos analyze
melos format --check
melos test
```

Device proof remains separate from static/build evidence.
