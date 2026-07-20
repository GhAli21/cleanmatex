# B27 — Financial Permissions and Approvals

## Metadata
Backlog ID: B27 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: IMPLEMENTED (Preview QA pending — see Completion evidence)
Authoritative report sections: §43, §50-B27
Required decisions: none (thresholds may reference D001 transitions)
Dependencies: none · Blocks: [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) (impl — action permissions)
Recommended phase: Seq 5

## Confirmed problem
Missing permission codes for: price override, manual-discount thresholds, manual charge, cash adjustment/variance approval, wallet/gift-card adjustment, credit issue, payment cancel/fail, order reopen, post-settlement edit, journal reversal, backdated/closed-period adjustment, rate override (§43 matrix NOT_FOUND rows).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| lib/constants/permissions/*-perm.ts | refund pair, collect, verify, adjustment, voucher-reverse, write-off exist | listed actions ungated or ride broad codes |
| §43 | no threshold approvals anywhere | maker-checker limited to refunds/write-off |

## Required outcome
New `resource:action` codes (CRITICAL RULE 13) + seeding migration (RULE 11) for each gap; guards wired via `requirePermission`; threshold-approval pattern (amount-based) for discounts/variance; reason-mandatory on sensitive actions; RBAC role mapping via `/update-rbac-role` flow.

## Scope
Permission constants + migration + route guards + role seeds + inventories refresh (`/rebuild-platform-info-inventories`).

## Out of scope
The features the permissions gate (each Bxx wires its own guard usage); UI approval dialogs beyond pattern components.

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | NO |
| Customer receipt | NO |
| Audit/outbox | YES (approval records) |

## Acceptance criteria
Every §43 NOT_FOUND action has a seeded, enforced code; permission inventory drift report clean.

## Required tests
API (403 paths), database (seeds), regression, access-contract checks.

## Dependencies and sequencing
Early (Seq 5) so B30/B16/B12 consume real codes.

## Delivery surfaces

Backend services: permission constants (lib/constants/permissions) + `requirePermission` guard wiring on the gated routes; threshold-approval helper
Database/schema: permission seed migration (RULE 11) + role-mapping updates (`/update-rbac-role` flow)
API/endpoints: guarded existing endpoints; no new business endpoints
Frontend page/screen/dialog/action: approval dialog pattern component (reason + approver) consumed by B12/B16/B24/B30/B34; role-admin screens (existing RBAC UI) show the new codes with bilingual descriptions; gated actions render disabled-with-reason for unauthorized users
Reusable components/helpers: RequirePermission components (existing); threshold-approval dialog
Permissions: this package defines them — price override, manual-discount threshold, manual charge, cash adjustment, variance approval, SV adjustments, credit issue, payment cancel/fail, order reopen (incl. the REFUND_AND_REBILL gate required by D003 v2 — B01 rejects rebill until this code is seeded and wired; B34 shows the action only to holders), post-settlement edit, journal reversal, backdated/closed-period, rate override
Validation: `resource:action` format (RULE 13); permission↔migration parity check
i18n/RTL: EN/AR permission descriptions
Accessibility: disabled-state reasons exposed as text
Audit trail: approval records (actor, reason, threshold) via the shared dialog contract
Observability: permission inventory drift report clean (`check:platform-info-inventories`)
Jobs/workers: none
Feature flag: none — seeded codes are inert until consuming packages wire guards
Rollout: constants + migration [stop-and-wait] → guards per consuming package → inventories refresh
Rollback: roles can be unmapped; codes remain seeded (harmless)

## End-to-end operational flow (admin + gated-action user)

- **Trigger:** operator — tenant admin opens the existing role-management screen to map the new codes; end-user trigger — any user attempts a gated financial action (price override, manual discount over threshold, cash adjustment, rebill/order reopen, journal reversal, backdated adjustment, rate override, …).
- **Permissions:** this package defines them — all codes follow `resource:action` (CRITICAL RULE 13), seeded by migration (RULE 11), mapped to roles via the `/update-rbac-role` flow; role administration itself stays behind the existing RBAC admin permissions.
- **API/system action:** no new business endpoints — existing endpoints gain `requirePermission` guards; threshold-sensitive actions route through the threshold-approval helper (amount-based) before executing.
- **Backend execution:** guard evaluates the actor's effective permissions server-side (UI state is advisory only); threshold approvals persist the approving actor, reason, and threshold crossed before the underlying action runs; sensitive actions refuse to execute without a mandatory reason.
- **Success path:** authorized user completes the action through the approval dialog where thresholds apply; the approval record links to the resulting financial fact; role admin sees the new codes with bilingual descriptions.
- **Failure handling:** unauthorized API call → explicit 403 (tested); UI renders the action disabled with the reason text; a missing-permission attempt never partially executes; misconfigured roles fail closed (deny by default).
- **Retry logic:** permission denials are not retried automatically — after a role change the user's next attempt re-evaluates; approval-dialog submissions are double-click-safe (per-attempt key on the underlying action).
- **Audit logging:** every threshold approval and sensitive action records actor, reason, threshold, and timestamp via the shared dialog contract; role-mapping changes carry the standard RBAC audit fields.
- **Observability:** permission inventory drift report clean (`check:platform-info-inventories`); 403-rate per code surfaces mis-mapped roles; approval-volume per threshold reviewed for threshold tuning.
- **Recovery procedures:** over-granted role → unmap the code (seeded codes remain, harmless); missing grant blocking legitimate work → role update through `/update-rbac-role` with audit; guard misconfiguration → the gated feature's own flag (owned by its consuming package) can disable the surface while the guard is fixed; inventories refreshed after every repair.

## Completion evidence

**Re-verification narrative (2026-07-20):** the §43 audit was re-checked against the LIVE remote DB (not a local-migration-file grep) before writing any code. Of the 12 §43 NOT_FOUND rows, 5 already had a seeded, role-granted code and needed no new permission (manual-discount threshold rides `orders:discount`, payment cancel/fail rides `payments:cancel`, journal reversal rides `erp_lite_gl:reverse`, backdated/closed-period rides `erp_lite_periods:reopen`, credit issue rides `stored_value:issue_credit_note` — only its UI entry point was ungated). The real remaining gap set was 7 codes, all covered by this package. Full per-item disposition is documented in migration `0411`'s header comment.

**Migration:** `supabase/migrations/0411_b27_financial_permissions_and_approvals.sql` — **NOT YET APPLIED (STOP-AND-WAIT per CRITICAL RULE 3 — owner to apply and confirm)**. Seeds 7 new permission codes (`cash_drawer:approve_variance`, `stored_value:issue_wallet_credit`, `orders:rebill_authorize`, `orders:manual_charge`, `orders:post_settlement_edit`, `orders:rate_override`, `orders:discount_threshold_override`), role-grants for each (idempotent `NOT EXISTS` guard), and additively broadens `pricing:override` to `admin`/`branch_manager`/`cashier`/`receptionist`/`supervisor`/`operator` (owner directive — match `orders:create`'s role set so nobody who could override prices before this package loses the ability; pre-existing `operator`/`super_admin`/`tenant_admin` grants untouched). Ends with `ASSERT` checks confirming all 7 codes seeded, key role grants present, and the pre-existing `pricing:override`↔`operator` grant survived.

**Bug fix (fail-open → fail-closed):** `lib/db/orders.ts` `addOrderItems` price-override gate had two fail-open paths — (1) the check was skipped entirely (`hasPriceOverride && currentUserId`) whenever `currentUserId` couldn't be resolved, letting an override through with no identifiable actor; (2) any `hasPermissionServer()` error other than the literal string `"Permission denied"` was caught, logged via `console.warn`, and swallowed, letting the override through anyway. Both now fail closed: missing user → explicit throw; any permission-check error propagates. Real-world exposure was compounded by `pricing:override` never having been seeded in the DB until this same migration, so the check was effectively inert either way — this package closes both the code bug and the DB gap together.

**Implementation files:**
- `lib/constants/permissions/orders-perm.ts` — added 8 typed constants: `DISCOUNT`, `REFUNDS_MANUAL_EXCEPTION`, `REBILL_AUTHORIZE`, `DISCOUNT_THRESHOLD_OVERRIDE`, `MANUAL_CHARGE`, `POST_SETTLEMENT_EDIT`, `RATE_OVERRIDE`, `PRICING_OVERRIDE` (first three plus `PRICING_OVERRIDE` were already seeded/granted pre-B27 — added here only for a typed reference; the reserved ones are inert placeholders for B18/B12/B26).
- `lib/constants/permissions/finance-perm.ts` — added `CASH_DRAWER_APPROVE_VARIANCE`, `STORED_VALUE_ISSUE_WALLET_CREDIT`.
- `lib/db/orders.ts` — `addOrderItems` fail-open → fail-closed fix (above).
- `app/actions/customers/stored-value-actions.ts` — added `hasPermissionServer` gates to `topUpWallet` (`stored_value:issue_wallet_credit`), `issueAdvance` (`stored_value:issue_advance`), `issueCreditNoteAction` (`stored_value:issue_credit_note`) — all three were completely ungated server actions; the credit-note API route already checked the same code, but the UI calls the server action, not the route.
- `app/api/v1/orders/[id]/refund/route.ts` and `app/api/v1/orders/[id]/refunds/route.ts` (sibling, duplicated logic) — replaced the hardcoded `REFUND_AND_REBILL_NOT_AVAILABLE` 403 (B01 §13's placeholder rejection) with a real `hasPermissionServer('orders:rebill_authorize')` check; `rebillAuthorized` now passed through to `initiateRefund`.
- `app/actions/billing/refund-actions.ts` — `initiateOrderRefund` closed a type-safety gap: `rebillAuthorized` is now excluded from the accepted param type (was only `Omit<..., 'requestedBy'>`, so a direct call bypassing the UI could pass `rebillAuthorized: true` straight through) and is always resolved server-side from `hasPermissionServer('orders:rebill_authorize')`, never trusted from the caller.

**Scope decision — no generic threshold-approval dialog component built:** the original scope note suggested a reusable amount-based threshold-approval dialog pattern. Re-checked against current consumers: zero features today read `orders:discount_threshold_override` (no threshold config exists — B27 seeds it only as a reserved placeholder), and B16 (cash-drawer variance approval) already shipped its own independent approval dialog before this package started, consuming `cash_drawer:approve_variance` directly. Building a generic component with no real caller would be speculative (CLAUDE.md: "don't design for hypothetical future requirements"). Deferred to whichever package first needs a second threshold-approval consumer (candidates: B12 post-settlement edit, B18 manual charge, B26 rate override) — at that point a shared component has two real call sites to generalize from instead of one imagined one.

**Tests (all new, all passing):**
- `__tests__/lib/db/orders.price-override-permission.test.ts` (4 tests) — unresolved user throws; `hasPermissionServer` false throws; `hasPermissionServer` throwing propagates (regression lock for the fail-open bug); authorized actor proceeds past the gate.
- `__tests__/actions/customers/stored-value-actions.permission.test.ts` (6 tests) — deny/proceed pairs for `topUpWallet`, `issueAdvance`, `issueCreditNoteAction`.
- `__tests__/api/v1/orders/refund.route.test.ts` (3 tests) — REFUND_AND_REBILL 403 without the permission (same error code as before — caller-visible regression guard), 201 + `rebillAuthorized: true` with it, non-rebill context unaffected. (`refunds/route.ts`, plural, carries identical duplicated logic — fixed together, not re-tested to avoid a redundant suite.)
- `__tests__/actions/billing/refund-actions.rebill-permission.test.ts` (3 tests) — deny/forward pairs for `initiateOrderRefund`, plus a test proving a client-supplied `rebillAuthorized: true` on a non-rebill context is ignored (`@ts-expect-error` — the type system itself now blocks it).
- Incidental fix: `__tests__/services/order-calculation.service.test.ts` — found 8 pre-existing failures unrelated to B27 (baseline gap, not caused by this package or any earlier package this session: `discount-service.ts` gained an `evaluateBestAutoApplyPromo` export in commit `2413671b`, 2026-07-18, but this test file's `jest.mock('@/lib/services/discount-service', ...)` factory was never updated to include it, so every test path that doesn't pass an explicit promo code hit `TypeError: ... is not a function`). Added `mockEvaluateBestAutoApplyPromo` to the mock factory and `beforeEach` defaults (`{ isValid: false }`, matching the existing no-match convention for `mockValidatePromoCode`/`mockGetBestDiscount`) — test-file-only change, no production code touched.

**Gates (2026-07-20, all green):** `npx tsc --noEmit` clean · `npx eslint . --quiet` 0 issues · targeted jest (16 new B27 tests) ✓ · full jest suite 217/217 suites, 2084/2084 tests ✓ (includes the incidental fix above) · `npm run check:i18n` ✓ (pre-existing benign EN=AR placeholder warnings only, unrelated to B27 — no i18n keys added by this package, no user-facing UI strings) · `npm run build` ✓ (all dashboard routes compiled, including `/dashboard/internal_fin/outbox` from B7).

**Commit:** — (uncommitted; owner commits directly per this session's established pattern).
**Preview QA (deploy/result/approval):** — not yet run (per folder CLAUDE.md release rule: nothing promotes to production before Preview QA + owner approval are recorded here).
**Reviewer:** — not yet assigned.
**Verification:** — not yet performed (post-migration-apply + Preview QA).
**Authoritative report update:** — not yet done; §43 rows for the 7 newly-seeded codes to be marked resolved once migration `0411` is applied and confirmed.
