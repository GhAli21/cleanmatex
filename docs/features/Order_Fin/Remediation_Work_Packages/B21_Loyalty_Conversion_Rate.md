# B21 — Loyalty Conversion Rate

## Metadata
Backlog ID: B21 · Severity: MEDIUM · Classification: MAINTENANCE_RISK · Status: IMPLEMENTED (2026-07-24/25, uncommitted; migration `0433_b21_loyalty_conversion_rate.sql` APPLIED (owner) to local + remote, verified)
Authoritative report sections: §7 concern, §33 loyalty, §50-B21
Required decisions: none (config design is technical; liability valuation belongs to D012/B25)
Dependencies: none · Blocks: — · Recommended phase: Seq 9

## Confirmed problem
Loyalty redemption computes `pointsToRedeem = ceil(amount / (option.minAmount ?? 1))` — the payment-method `min_amount` field is semantically overloaded as the points-per-currency conversion rate (order-settlement.service.ts:317).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:316–325 | min_amount reused as rate | wrong field; silent misconfig risk |
| loyalty.service.ts | redeemPointsTx takes points + monetary amount | rate resolution is caller-side |

**Corrections found during implementation (2026-07-24) — the doc materially understated what already existed and missed a real, separate live bug:**
1. **`redeem_rate_per_point` and `min_redeem_points` already exist** on `org_loyalty_programs_cf` (migration 0287) — seeded with real non-null values for both demo tenants, and already editable via a real settings screen (`/dashboard/marketing/loyalty`, `loyalty-config-client.tsx`) and `saveLoyaltyConfigAction`. Only a **rounding rule** was genuinely missing — the doc's "new columns to add" framing was wrong on 2 of 3 points.
2. **The buggy `order-settlement.service.ts:324` branch is dead code in production today** — `settleOrderTx`'s `wiringMode` flag is always `true` whenever a loyalty leg exists on the only live caller (`order-submit-orchestrator.service.ts`), which skips this branch entirely via an early `continue`. The real, live redemption path is `applyStoredValueDebitTx` (`order-credit-application.service.ts:179-199`) — which **already had the correct resolve-rate-and-fail-loudly pattern**, almost verbatim what this package was asked to build. Both were fixed by extracting the logic into one shared helper, closing the drift risk, not by writing new logic from scratch.
3. **A real, separate, live production bug was found and fixed as part of this package**: `app/api/v1/orders/checkout-options/route.ts` (the payment modal's actual data source) never had a `LOYALTY_CREDIT` branch in its `available_balance` computation — it fell through to `null`, so the loyalty option was **silently excluded from the payment modal's customer-credits list for every tenant, always**, regardless of point balance. The upstream `getAvailableStoredValueSummary` computed the redeem *rate* but never fetched the customer's *points balance* at all. Neither gap was named in the doc; both block the doc's own "current-rate display" acceptance point from being possible at all until fixed.
4. **Permission gap found and fixed**: `saveLoyaltyConfigAction`/`saveTierAction`/`deleteTierAction` had zero RBAC check (session auth only) — any authenticated tenant user could mutate loyalty program config regardless of `loyalty:manage_config`. The doc's "tenant-admin settings permission (confirm with B27)" framing was also stale — dedicated `loyalty:view_config`/`loyalty:manage_config` codes already exist (migration 0294), correctly role-scoped; no B27 dependency needed.
5. **Dead/broken code found and fixed**: `app/api/v1/loyalty/config/route.ts`'s `PATCH` handler used Prisma field names (`earn_rate`, `redeem_rate`, `max_redeem_percent`, `expiry_days`) that don't exist on the model — would throw "Unknown argument" on its first real call. Confirmed dead (the live UI writes through the server action, not this route) but fixed while in the file.

## Required outcome
Explicit tenant-level loyalty conversion configuration (points-per-unit, rounding rule, min-redemption) resolved by a loyalty config service; `min_amount` returns to its real meaning; misconfiguration fails loudly.

## Scope
Config source (settings or loyalty config table — assess), resolution service, settlement call-site fix, backfill note for tenants relying on min_amount.
**Frontend surface (rule 7):** loyalty settings screen section for conversion rate, rounding rule, and min-redemption (tenant admin, permission-gated) — configuration must never require DB edits.

## Out of scope
Earn processing (B7); liability valuation (B25); tier logic (§33 NOT_FOUND items).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | YES (points debited per redemption) |
| BVM | NO |
| Cash drawer | NO |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | NO |
| Reconciliation | YES (loyalty ledger link amounts) |
| Customer receipt | POSSIBLE (points shown) |
| Audit/outbox | NO |

## Acceptance criteria
Redemption uses the configured rate; min_amount changes no longer alter points math; missing config → explicit error.

## Required tests
unit, integration (settlement with loyalty leg), regression.

## Dependencies and sequencing
Independent.

## Delivery surfaces

Backend services: `resolveLoyaltyRedemptionPoints()` + `roundLoyaltyPoints()` (new, `loyalty.service.ts`) — the ONE shared rate/rounding-rule resolution + min-redeem enforcement helper, called from both `applyStoredValueDebitTx` (live path) and the legacy `settleOrderTx` branch (now dead-but-correct); `getAvailableStoredValueSummary` extended to fetch the customer's points balance (previously only fetched the rate).
Database/schema: migration 0433 — `rounding_rule` column on `org_loyalty_programs_cf` (default `CEIL`, zero behavior change) + 2 new CHECK constraints on the already-existing `redeem_rate_per_point`/`min_redeem_points` columns. No new table — `org_loyalty_programs_cf` (migration 0287) already existed and was already wired for earn; this package closes the redeem-side gap.
API/endpoints: `checkout-options/route.ts` — new `LOYALTY_CREDIT` branch for `available_balance` (the real bug fix — this was silently `null` for every tenant) + 3 new response fields (`loyalty_points_balance`, `loyalty_redeem_rate_per_point`, `loyalty_min_redeem_points`); `app/api/v1/loyalty/config/route.ts` PATCH field-name fix + `roundingRule` support.
Frontend page/screen/dialog/action: extended the EXISTING loyalty settings screen (`/dashboard/marketing/loyalty`, `loyalty-config-client.tsx`) with a rounding-rule dropdown — not a new screen, per the research confirming this screen already exposes earn/redeem rate, min-redeem, max-pct, and expiry. Payment-modal "current-rate display": NOT built as bespoke new UI — the existing generic stored-value-cap mechanism (`getLegStoredValueCap` in `use-payment-engine.ts`, already handles `LOYALTY_POINTS` at line 418) now receives a correct, non-null `available_balance` from the checkout-options fix and will render the loyalty leg through the same established UI every other credit type uses. Deliberate scope boundary — not a gap: showing the raw points/per-point rate breakdown (vs. the already-converted currency cap) is a presentation nice-to-have, deferred.
Reusable components/helpers: `resolveLoyaltyRedemptionPoints`/`roundLoyaltyPoints` (loyalty.service.ts); `LOYALTY_ROUNDING_RULES`/`LOYALTY_ERROR_CODES` (order-financial.ts).
Permissions: `loyalty:view_config` (read) / `loyalty:manage_config` (write) — already existed (migration 0294); this package closed a real gap where the mutation server actions never checked the write permission at all.
Validation: `redeem_rate_per_point > 0` and `min_redeem_points >= 0` enforced at both the DB CHECK level (migration 0433) and the server action (clear message before hitting the constraint); redemption fails loudly with `LOYALTY_NOT_CONFIGURED`/`LOYALTY_BELOW_MIN_REDEEM` — never a min_amount fallback, never a silent accept.
i18n/RTL: EN/AR — added the entire `marketing.loyalty.*` namespace (title/description/config.*/tiers.*), which turned out to be completely missing from both locale trees before this package (a real, separate pre-existing gap — the settings screen had been rendering raw key paths) — fixed since already touching this exact screen for the rounding-rule field.
Accessibility: labeled `<select>` for the rounding-rule field, matching this screen's existing (pre-Cmx) input pattern for consistency within the file.
Audit trail: none new — config changes already flow through the existing `updated_at`/`updated_by` columns on `org_loyalty_programs_cf`.
Observability: none new beyond the explicit thrown error codes (`LOYALTY_NOT_CONFIGURED`/`LOYALTY_BELOW_MIN_REDEEM`) surfacing in server logs/API error responses.
Jobs/workers: none.
Feature flag: none — config presence drives behavior; absence fails loudly (as originally specified).
Rollout: STOP-AND-WAIT migration apply → owner commit → Preview QA.
Rollback: drop the 3 new CHECK constraints + `rounding_rule` column (additive/nullable-defaulted, safe); revert the call-site/route/action changes — every existing tenant's redemption math is byte-identical before/after (default `CEIL` = the exact pre-existing hardcoded behavior).

## End-to-end operational flow

1. Tenant admin sets the conversion rate (+ now rounding rule) on the loyalty settings screen (`/dashboard/marketing/loyalty`) — unchanged screen, one new field.
2. Cashier opens the payment modal → the loyalty credit option now correctly appears (previously silently excluded for every tenant due to the `checkout-options` bug) with its currency-value cap, through the same generic stored-value UI as wallet/advance/credit-note.
3. Applying a loyalty leg → points computed via the single shared `resolveLoyaltyRedemptionPoints()` helper (same math whether reached via the live BVM-wiring path or the legacy branch) — configured rate + rounding rule + min-redeem floor, never `option.minAmount`.
4. Missing/invalid config, or a request below the min-redeem floor, throws a stable error code (`LOYALTY_NOT_CONFIGURED` / `LOYALTY_BELOW_MIN_REDEEM`) — never silent wrong math, never a fallback to an unrelated field.

UI states: standard Cmx state contract on the settings screen (loading/empty/validation/save-success) — unchanged from the pre-existing screen, now correctly localized (previously missing i18n keys rendered raw paths).

## Completion evidence
Migration: `0433_b21_loyalty_conversion_rate.sql` — **APPLIED (owner) to local + remote, verified via `mcp__supabase_remote_db` read-only queries** (`rounding_rule` column present; all 3 new CHECK constraints — `chk_loyalty_rounding_rule`, `chk_loyalty_redeem_rate_positive`, `chk_loyalty_min_redeem_nonneg` — confirmed live). Owner also regenerated Supabase types. (Renumbered from an initially-authored `0431` after discovering the owner's own concurrent workflow-engine work had already claimed that number — confirmed via `mcp__supabase_remote_db__list_migrations` before finalizing at `0433`, the first free slot.)

Implementation files: `lib/services/loyalty.service.ts` (new `resolveLoyaltyRedemptionPoints`/`roundLoyaltyPoints`), `lib/constants/order-financial.ts` (`LOYALTY_ROUNDING_RULES`/`LOYALTY_ERROR_CODES`), `lib/services/order-credit-application.service.ts` (`applyStoredValueDebitTx`'s LOYALTY_CREDIT branch now calls the shared helper; `getAvailableStoredValueSummary` extended with points balance + `loyaltyAvailableValue`/`loyaltyMinRedeemPoints`), `lib/services/order-settlement.service.ts` (legacy branch now calls the shared helper instead of `option.minAmount`), `app/api/v1/orders/checkout-options/route.ts` (new LOYALTY_CREDIT `available_balance` branch + 3 new response fields — the real live-bug fix), `app/api/v1/loyalty/config/route.ts` (PATCH field-name fix + roundingRule support), `app/actions/marketing/loyalty-actions.ts` (permission checks added to all 3 mutations + roundingRule plumbed through + rate/min-redeem validation), `src/features/marketing/ui/loyalty-config-client.tsx` (rounding-rule field), `src/features/marketing/access/marketing-access.ts` (loyalty-actions apiDependency now declares `loyalty:manage_config`), `messages/en(ar)/marketing.json` (new `loyalty.*` namespace — was completely missing), `prisma/schema.prisma` (hand-mirrored + `npx prisma generate`).

Tests: `__tests__/services/loyalty.service.test.ts` (+9 new — `roundLoyaltyPoints` all 4 rounding rules, `resolveLoyaltyRedemptionPoints` rate resolution/missing-config/zero-rate/below-min-redeem/legacy-null-rounding-rule-defaults-to-CEIL; all 14 pre-existing cases in the same file untouched and still passing).

**Gates ALL GREEN:** tsc clean (same 3 pre-existing unrelated errors, none in any B21 file) · eslint 0 (project-wide) · full jest **233/233 suites, 2256/2256 tests — zero known failures** · `npm run build` ✓ (exit 0; all touched routes — `/api/v1/orders/checkout-options`, `/api/v1/loyalty/config`, `/api/v1/loyalty/tiers`, `/dashboard/marketing/loyalty` — confirmed compiled) · `check:i18n` ✓ · `check:ui-access-contract --wire` PASS (`/dashboard/marketing/loyalty`) · `sync:ui-access-contract` PASS (144/144 routes, drift 0).

Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
