# B06 — ERP Order-to-Cash Event Wiring

## Metadata
Backlog ID: B6 · Severity: HIGH · Classification: CONTROL_GAP · Status: IMPLEMENTED (2026-07-24, uncommitted; migration 0424 APPLIED (owner, 2026-07-24) to local + remote, verified)
Authoritative report sections: H2, §12, §39, §50-B6
Required decisions: [D007](00_Phase_0_Financial_Semantics/D007_BVM_And_ERP_Lite_Responsibilities.md), [D008](00_Phase_0_Financial_Semantics/D008_Stored_Value_Funding_Treatment.md), [D012](00_Phase_0_Financial_Semantics/D012_Revenue_Recognition_Policy.md) — all APPROVED (Expert); B6 consumes D012's liability-event slice (recognition engine itself is B25)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (impl), [B03](B03_Stored_Value_Funding_Capture.md) (impl — funding facts)
Blocks: [B24](B24_AR_Allocation_Writeoff_And_Period_Controls.md), [B25](B25_Revenue_Recognition_And_Contract_Liability.md) (hard)
Recommended phase: Seq 8

## Confirmed problem
ERP-Lite engine is production-grade, but only invoice-created, expense, and petty-cash post. Payment/refund/gift-card dispatchers have no callers (DISCONNECTED); wallet top-up, advance, loyalty-liability, AR-allocation event codes don't exist (NOT_FOUND). POS money never reaches the GL (H2, §39).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| erp-lite-auto-post.service.ts:104–583 | payment/refund/GC dispatchers defined | zero callers |
| erp-lite-posting.ts:69–86 | event codes incl. ORDER_SETTLED_WALLET | missing codes for top-up/advance/allocation |
| voucher-wiring order-payment handler | writes payment facts | natural dispatch point |

## Required outcome
Policy-gated (NON_BLOCKING default) dispatch of: payment received (per method family), refund issued, gift-card events, wallet/advance funding + application, per D007 matrix and §39 target Dr/Cr sketch; new event codes seeded where NOT_FOUND; BVM↔GL reconciliation check added.

## Scope
Dispatch call-sites in wiring handlers/refund/funding services; new event-code constants + governance seeds (migration); exception-path behavior; idempotency per (doc,event,key).

**Scope actually delivered this session (owner-confirmed 2026-07-24, narrowed from the broader "every DISCONNECTED/NOT_FOUND row" framing above):**
- `PAYMENT_RECEIVED` / `ORDER_SETTLED_CASH` / `ORDER_SETTLED_CARD` / `ORDER_SETTLED_WALLET` (5 already-governed, already-BLOCKING events — flipped to NON_BLOCKING and wired).
- `REFUND_ISSUED` (already-governed, already-BLOCKING — flipped to NON_BLOCKING and wired, one hook covers all 4 refund destinations).
- `GIFT_CARD_SOLD` / `GIFT_CARD_REDEEMED` / `GIFT_CARD_EXPIRED` / `GIFT_CARD_REFUNDED` / `GIFT_CARD_VOIDED` (5 of the 6 dispatcher builders that existed with zero callers — new event codes/mapping rules/policies seeded and wired).
- `WALLET_TOPPED_UP` / `CUSTOMER_ADVANCE_RECEIVED` (2 new events closing D008's 5th funding artifact — new event codes/mapping rules/policies seeded and wired).
- One new BVM↔GL reconciliation module (`erp-lite-checks.ts`, 2 checks).

## Out of scope
Revenue recognition triggers (B25); AR write-off/allocation GL specifics (B24); journal reversal service (with B13/B10 semantics).

**Explicitly deferred this session (owner-confirmed 2026-07-24), each with a concrete reason — not silently dropped:**
- `GIFT_CARD_BONUS_GRANTED` — the dispatcher/mapping stay unwired. Full repo grep found **no bonus-granting business function anywhere in the codebase** (`bonus_amount` is only ever initialized to 0 and read, never incremented). Wiring a dispatcher with no caller would be dead governance data; revisit when a bonus-grant feature is actually built.
- `AR_PAYMENT_ALLOCATED` — belongs to B24 per D007's own responsibility matrix ("AR receipt allocation | Receipt voucher | Cash and AR posting"); wiring it here would be scope creep into a package that owns the rest of the AR-allocation GL surface anyway.
- `LOYALTY_LIABILITY_CREATED` / `LOYALTY_LIABILITY_RELEASED` — loyalty's material-right assessment (D012) belongs to B25's recognition engine, not this wiring pass.
- The B19 posting-retry runner and the exceptions-screen retry wiring (`ErpLitePostingEngineService.retry()/repost()` still have zero production callers) — the spec's own text already assigns this to B19; not built here.
- Exact multi-leg GL splitting for stored-value funding — a funding voucher with >1 tender leg posts one journal against the FIRST confirmed leg's payment method rather than a Dr line per leg (documented v1 simplification in `ErpLiteWalletToppedUpInput`'s own doc comment, not silently dropped).
- Per-tenant `sys_fin_org_acc_map_dtl` account mapping for the 4 new usage codes — each tenant with ERP-Lite enabled still needs to map GIFT_CARD_LIABILITY/CUSTOMER_ADVANCE_LIABILITY/BREAKAGE_INCOME/VOID_RECOVERY to a real ledger account before these events post anywhere; until mapped, NON_BLOCKING exceptions accumulate in `org_fin_post_exc_tr` with zero operational impact — this is expected, not a bug.

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
| ERP-Lite GL | YES |
| Snapshot | NO |
| Reconciliation | YES (BVM↔GL check) |
| Customer receipt | NO |
| Audit/outbox | YES (posting logs) |

## Acceptance criteria
Every §39 DISCONNECTED row shows a runtime caller; trial balance reflects a full cash order lifecycle; posting failures land in exceptions without blocking settlement (per policy).

## Required tests
integration, database (seeds), accounting (balanced journals per event), idempotency, reconciliation, regression.

## Dependencies and sequencing
After B4 (voucher-driven collection facts) and B3 (funding facts); before B24/B25.

## Delivery surfaces

Backend services: `erp-lite-auto-post.service.ts` extended with 5 new gift-card `*InTransaction` overloads + `dispatchWalletToppedUp[InTransaction]`/`dispatchCustomerAdvanceReceived[InTransaction]` (build methods + dispatchers); `erp-lite-auto-post.util.ts` gains `logAutoPostOutcome` (outcome logging) + `safeDispatchAutoPost` (try/catch wrapper — see Completion evidence for why this exists); dispatch call-sites added to `order-payment-wiring.handler.ts`, `order-credit-application-wiring.handler.ts` (WALLET branch only), `payment-transition.service.ts` (VERIFY — deferred post for a leg that started PENDING), `order-refund.service.ts` (`processRefund` tail), `stored-value-funding.service.ts` (`finalizeStoredValueFundingIfReady`), `gift-card-service.ts` (`redeemGiftCardTx`/`refundGiftCardTx`/`voidGiftCard`/`expireGiftCard`)
Database/schema: migration `0424_b06_erp_order_to_cash_event_wiring.sql` — flips 5 existing BLOCKING policies to NON_BLOCKING; seeds 4 new usage codes (GIFT_CARD_LIABILITY, CUSTOMER_ADVANCE_LIABILITY, BREAKAGE_INCOME, VOID_RECOVERY) + 7 new event codes + mapping rules + NON_BLOCKING policies (activated); no new tables
API/endpoints: none new (posting is service-internal; existing ERP preview/exception routes serve)
Frontend page/screen/dialog/action: NOT_APPLICABLE — existing ERP-Lite screens (journals list, posting-exceptions screen) already display any event code once its governance rows exist; no new page needed for this pass
Reusable components/helpers: `safeDispatchAutoPost`/`logAutoPostOutcome` (new, shared across all 8 call sites) — the belt-and-suspenders NON_BLOCKING guarantee this package's "existing outcome-logging util" line originally called for
Permissions: existing ERP-Lite finance permissions (unchanged); posting itself is system-actor
Validation: engine-side (governance rules, open period, balanced lines) — unchanged
i18n/RTL: NOT_APPLICABLE — event display names live in `sys_fin_evt_cd.name`/`name2` (bilingual DB columns, seeded EN/AR by the migration itself), not a code-side i18n catalog
Accessibility: NOT_APPLICABLE — no new UI surface this pass
Audit trail: `org_fin_post_log_tr` per dispatch attempt; exceptions to `org_fin_post_exc_tr` (both pre-existing, unchanged schema)
Observability: 2 new BVM↔GL reconciliation checks (`ORDER_PAYMENT_ERP_POST_ATTEMPTED`, `REFUND_ERP_POST_ATTEMPTED`) in new module `lib/services/reconciliation/erp-lite-checks.ts`
Jobs/workers: none this pass (posting-retry runner explicitly deferred to B19 — see Out of scope)
Feature flag: none new — dispatch gates on the existing `erp_lite_enabled` HQ feature flag (via `canAccess`) plus the per-event auto-post policy rows this migration seeds/edits
Rollout: migration flips 5 policies to NON_BLOCKING and activates 7 new ones immediately on apply — safe because NON_BLOCKING means a misconfigured account mapping only produces an exception row, never a blocked transaction; each tenant's own `sys_fin_org_acc_map_dtl` mapping (not part of this migration) determines whether the new events actually post to a real account or land as exceptions
Rollback: revert the 5 policies to BLOCKING (0182 values) and/or set the 7 new policies back to DRAFT/is_enabled=false — application code keeps working either way, since a missing/disabled policy is just another `status: 'skipped'` outcome the NON_BLOCKING call sites already log and move past

## End-to-end operational flow (operator: finance user)

- **Trigger:** system — a settlement, refund, or stored-value funding transaction commits; the owning service (voucher wiring handler / processRefund / funding service) invokes the ERP dispatcher for the matching event code per the tenant's auto-post policy rows. Operator trigger: finance user opens the ERP-Lite posting-exceptions screen.
- **Permissions:** dispatch itself is system-actor (no user permission). Viewing journals/exceptions and retrying/reposting require the existing ERP-Lite finance permissions; retry actions are denied 403 without them and render disabled-with-reason in the UI.
- **API/system action:** no new endpoint — dispatch is service-internal; the existing ERP preview/exception routes serve the screen; retry posts through the existing exception-retry route.
- **Backend execution:** dispatcher builds the event payload (doc id, event code, tenant, amounts) → ErpLiteAutoPostService validates governance rules, open period, and account mapping → writes a balanced journal inside the engine transaction; idempotent per `(doc, event, key)` so the same business fact can never post twice.
- **Success path:** balanced journal persisted; posting log row written; source document unaffected; BVM↔GL recon check ties voucher totals to journal totals per family.
- **Failure handling:** with NON_BLOCKING policy (default) a posting failure writes an exception row (`org_fin_post_exc_tr`) with the reason (missing mapping, closed period, unbalanced) and the sale/refund/funding flow continues; with BLOCKING policy the owning transaction fails explicitly. No partial journals — the engine writes all lines or none.
- **Retry logic:** finance user fixes the cause (mapping/period) and retries from the exceptions screen; the B19 posting-retry runner re-attempts eligible exceptions on schedule; retries reuse the original idempotency key, so a retry after a half-visible outcome cannot double-post.
- **Audit logging:** every dispatch writes `org_fin_post_log_tr` (event, doc, outcome, actor = system or retrying user); exception rows keep the failure reason and resolution trail.
- **Observability:** posting failure-rate metric per event family; BVM↔GL reconciliation check surfaces drift as a recon issue; exception-queue age visible on the screen.
- **Recovery procedures:** unresolved exceptions escalate via the recon check; a family posting systematically wrong is disabled through its policy row (engine-native switch) while facts continue accumulating; already-posted journals are corrected via the engine repost/reversal policy — never by editing journals in place.

## Safety

UI design allowed: NOT_APPLICABLE (no UI this pass) · UI implementation allowed: NOT_APPLICABLE
Production activation allowed: **YES once migration 0424 applies** — every new/flipped policy is NON_BLOCKING by design (owner-confirmed 2026-07-24), so activation cannot newly block a customer payment/refund/gift-card/funding transaction; the worst case is a posting exception (`org_fin_post_exc_tr`) for a tenant whose `sys_fin_org_acc_map_dtl` mapping is incomplete for the new usage codes — zero operational impact, purely a finance-ops follow-up.
Required backend gates: none — this package has no hard dependency the way B10→B13 does
Required decision gates: D007, D008, D012 — all already APPROVED (Expert)
Required verification gates: unit test matrix green (dispatch builders, in-transaction wrappers, `safeDispatchAutoPost` never-throws guarantee, both reconciliation checks) — see Completion evidence gates below

**Gates ALL GREEN (2026-07-24):** tsc clean (2 pre-existing unrelated errors untouched: `order-service.ts`, `processing-piece-row.tsx`) / eslint 0 / full jest — see Completion evidence for exact counts / `npm run build` ✓ / `check:i18n` ✓ (no i18n surface touched, ran anyway per the standing gate list).

## Completion evidence

**Implemented 2026-07-24 (uncommitted).** Closed the exact gap the frozen audit report flagged (§39: "PAYMENT_RECEIVED/ORDER_SETTLED_*/REFUND_ISSUED/GIFT_CARD_* — dispatcher exists, zero callers" and "BVM↔GL reconciliation: NOT_FOUND") by adding real call sites at the 6 places money actually moves, plus the 2 new funding-liability events D008 deferred from B3.

**Architecture decision — reused the exact synchronous in-transaction pattern already proven by invoice/expense/petty-cash**, rather than building an async outbox-consumer layer. D007 explicitly allows either ("ERP posting may occur asynchronously through an outbox") but the only 3 events that already work in this codebase (`dispatchInvoiceCreatedInTransaction`/`dispatchExpenseRecordedInTransaction`/`dispatchPettyCashTransactionInTransaction`) are all synchronous calls inside the writer's own Prisma transaction, with the engine's own `blocking_mode`/`required_success` policy fields controlling whether a failure propagates. Building a second, parallel async architecture for payment/refund/gift-card events would have meant two different ERP dispatch mechanisms in the same codebase for no architectural gain — the synchronous approach with a NON_BLOCKING policy already satisfies D007's binding failure-coupling rule ("ERP posting failure must not delete or roll back the operational voucher") just as completely.

**Architecture decision — the 5 already-live BLOCKING policies had to be relaxed before wiring, not left alone.** Migration 0182 (pre-dating the Order-Fin remediation program) seeded `PAYMENT_RECEIVED`/`REFUND_ISSUED`/`ORDER_SETTLED_CASH/CARD/WALLET` as BLOCKING with `required_success=true` — harmless while nothing called the dispatchers, but would have hard-failed real customer payments/refunds the moment a caller went live if left as-is. Confirmed via code read that `blocking_mode` is **entirely enforced by the caller**, never the engine itself (`ErpLitePostingEngineService.execute[InTransaction]` never reads `blocking_mode`/`required_success` — only the `assertBlockingXAutoPostSucceeded`-style helper a caller chooses to invoke does). Flipping the 5 policies to NON_BLOCKING via migration was the owner-confirmed choice (offered as a question, given it changes already-live production governance data) over leaving them BLOCKING.

**Architecture decision — belt-and-suspenders NON_BLOCKING via `safeDispatchAutoPost`, discovered mid-implementation.** Initially wired each call site as `const result = await ErpLiteAutoPostService.dispatchXInTransaction(...); logAutoPostOutcome(...)` — correct for a *governed* posting failure (the dispatcher never throws for those, it returns `status`/`execute_result`), but NOT for an *ungoverned* exception (a bug in the engine, a raw-SQL hiccup, or — discovered empirically — the ERP-Lite call executing inside a caller's test-mocked transaction that doesn't stub every Prisma method the dispatch path touches). An uncaught throw from the dispatch layer would propagate straight into the caller's transaction and roll back the payment/refund/funding/gift-card operation it was supposed to never affect — a real correctness gap, not just a test-hygiene one. Added `safeDispatchAutoPost(eventLabel, dispatchThunk)` to `erp-lite-auto-post.util.ts` (try/catch + `logger.error`, never rethrows) and moved all 8 call sites onto it. This was caught by running the full jest suite: one pre-existing test (`stored-value-funding.service.test.ts`) failed because a `tx.org_gift_cards_mst.findFirst` lookup for the gift-card's display code sat *outside* the wrapper — moved inside the same closure, since even that lookup shouldn't be able to block funding. **Verified empirically:** the ~11 pre-existing test files exercising these 6 call sites (order-payment-wiring, order-refund, stored-value-funding, gift-card-service ×2 integration+unit, payment-transition, settlement, order-cancel-financials) all continued passing with zero mock changes once the wrapper was in place — their mocked transactions don't stub the ERP-Lite dependency chain, so the dispatch throws internally and is silently caught, exactly matching production NON_BLOCKING behavior.

**Architecture decision — v1 simplification for multi-leg stored-value funding**, documented directly in `ErpLiteWalletToppedUpInput`'s doc comment rather than silently handled: a funding voucher can have >1 confirmed tender leg (B3's multi-leg architecture), but this package posts one journal using the FIRST leg's payment method for the Dr side rather than splitting Dr lines per leg. Exact multi-leg GL splitting is a tracked gap, not a silent drop.

**Scope narrowing (all owner-confirmed 2026-07-24 via AskUserQuestion):** deferred `GIFT_CARD_BONUS_GRANTED` (no trigger exists anywhere in the codebase — confirmed by full grep), `AR_PAYMENT_ALLOCATED` (→ B24, its proper home per D007's matrix), `LOYALTY_LIABILITY_*` (→ B25), and the B19 posting-retry runner (per the spec's own text) — see Out of scope for full reasoning per item.

**Gates ALL GREEN:** tsc clean (2 pre-existing unrelated errors untouched) / eslint 0 (full project) / full jest 227/227 suites, 2197/2197 tests, zero known failures (one transient failure during development — a lookup-outside-the-wrapper bug — found and fixed via the full-suite run itself, not left in) / `npm run build` ✓ / `check:i18n` ✓.

Migration: `0424_b06_erp_order_to_cash_event_wiring.sql` — **APPLIED (owner, 2026-07-24) to local + remote, verified via `mcp__supabase_remote_db` read-only queries** (all 7 event codes confirmed `NON_BLOCKING`/`ACTIVE`/`is_enabled=true` in `sys_fin_auto_post_mst`) · Implementation files: `lib/services/erp-lite-auto-post.service.ts`, `lib/services/erp-lite-auto-post.util.ts`, `lib/types/erp-lite-auto-post.ts`, `lib/types/erp-lite-posting.ts`, `lib/constants/erp-lite-posting.ts`, `lib/constants/order-financial.ts` (2 new reconciliation check names), `lib/services/wiring/order-payment-wiring.handler.ts`, `lib/services/wiring/order-credit-application-wiring.handler.ts`, `lib/services/payment-transition.service.ts`, `lib/services/order-refund.service.ts`, `lib/services/stored-value-funding.service.ts`, `lib/services/gift-card-service.ts`, `lib/services/reconciliation/erp-lite-checks.ts` (new), `lib/services/reconciliation.service.ts` · Tests: `__tests__/services/erp-lite-auto-post.service.test.ts` (+9 new), `__tests__/services/erp-lite-auto-post.util.test.ts` (new, 6 tests), `__tests__/services/reconciliation/erp-lite-checks.test.ts` (new, 7 tests), plus `canAccess` mock additions to `__tests__/services/reconciliation.service.test.ts` and `__tests__/integration/reconciliation-run.test.ts` (orchestrator-level suites now include the 2 new checks) · Commit: — (uncommitted) · Preview QA (deploy/result/approval): — · Reviewer: — · Verification: — · Authoritative report update: —
