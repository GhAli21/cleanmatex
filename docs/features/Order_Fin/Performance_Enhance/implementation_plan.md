# Payment Modal V4 performance implementation plan

Date: 2026-10-24. Version: 1.1.1. Status: awaiting the user's future implementation request; current-system revalidation is required before baseline or candidate selection. P1-P5 remain optional candidate workstreams.

Apply [performance-coding-rules.md](performance-coding-rules.md) to every implementation increment and use its review checklist alongside the phase-specific gates below.

**Agreed execution policy:** implement one small evidence-backed improvement, benchmark again, and stop when agreed performance and correctness criteria pass. P0-P6 describe available work and safeguards; they do not require completing every optimization. Use [tester-handoff-guide.md](tester-handoff-guide.md) and append evidence/engineer responses to [tester-results.md](tester-results.md) for each iteration. Record numerical acceptance criteria before declaring a stopping result; the original timing suggestions remain unverified hypotheses.

## Execution sequence — the active plan

### Step 0 — revalidate the current system before using this plan

**Mandatory rule: a written task or earlier finding is not evidence that the task is still needed.** The user is making related system changes. This plan must not be executed against the old snapshot simply because its steps are documented. Wait for the user's implementation request; this documentation update does not start application work.

When implementation is requested, and again after relevant changes or a pause/resume:

1. Inspect the current branch/build identity and related committed/uncommitted changes without resetting, reverting, stashing or overwriting other work. Scope discovery to this flow and directly affected dependencies; no whole-repository audit is required.
2. Trace the current payment opening and submission paths, shared New/Edit consumers, relevant settings/auth/currency services, query/cache contracts, applicable database definitions/types and actual fixture prerequisites. Inspect HQ integration contracts only where the current flow depends on them. Do not apply migrations or assume draft schema is deployed.
3. Compare current behavior with this plan's findings, proposed changes, dependencies and tests. Classify each relevant proposed task as `STILL_NEEDED`, `ALREADY_SOLVED`, `CHANGED`, `NO_LONGER_APPLICABLE` or `BLOCKED_BY_IN_PROGRESS_WORK`, with supporting file/build/test references. A task already implemented needs verification, not a duplicate implementation.
4. Read the latest tester log and distinguish historical observations from current evidence. Related changes to code, policy, schema, fixtures, runtime region or instrumentation require a fresh matched baseline or an explicit documented comparability check. Do not reuse the earlier 393-test run, prior setup failures or suggested timings as proof of the changed system's readiness or bottleneck.
5. Revise the affected plan tasks, test scope, risks and dependency boundaries before choosing a candidate. Preserve superseded findings as dated history where useful; mark them superseded rather than silently treating them as current. Do not add another cache, endpoint, calculation path or auth check when the current system already supplies the needed behavior.
6. Append a revalidation record to `tester-results.md` identifying the inspected build/diff, changed assumptions, task classifications, evidence that remains comparable, required fresh measurements and readiness disposition. Then proceed to Step A only if the relevant flow is stable enough to measure. If related work is still changing or incompatible, hold that scope and record the dependency; independent read-only diagnosis can continue.

Recheck the selected files/contracts immediately before editing. If they changed after revalidation or measurement, reassess the affected baseline and candidate rather than applying a stale patch. Not every documentation-only or unrelated change invalidates all evidence; record why retained evidence is still applicable.

The revalidation gate is a technical applicability check, not a new blanket permission request. Existing user authorization governs the agreed work. New cross-project/schema/deployment actions retain their own established boundaries.

### Step A — record a reproducible baseline

Start with a baseline/investigation brief in `tester-results.md`; a suggested first identifier is `IMP-001`, but it is not active until the actual brief is entered. Record the current build, legitimate fixture prerequisites, chosen method, locale, test origin and measurement definitions. Begin with the common supported three-line cashier journey; add thirty-line or credit/promo/gift cases when they expose the suspected bottleneck or protect the chosen change.

Collect successful first-open and warm-reopen observations with outcomes and required correctness checks. Expand sample sizes and cold/concurrency cohorts as needed for the agreed statistic; a convenience run is diagnostic, not reliable p95 evidence. Record blocked setup separately. No optimization is selected merely because an earlier source review identified a possible opportunity.

Agree and record the performance statistic/threshold, errors/resource limits and mandatory correctness cases before final acceptance. Until then, these fields remain `PENDING`. If the existing build already meets the agreed criteria, record the evidence and stop without changing code.

### Step B — select exactly one small candidate

The engineer reads the baseline, records the reviewed run ID, and chooses the smallest change addressing the measured critical path. Request-local duplicate-read removal from P1 or earlier required metadata loading from P2 are candidate sources, not preselected deliverables. Select one bounded subtask; do not implement an entire workstream simply because its task list exists.

Record the hypothesis, expected observable effect, changed files, affected consumers, scope-appropriate tests, candidate build and rollback boundary in the improvement brief. Keep shared auth changes conditional on meaningful evidence and their wider security gate. P4 mismatch recovery is a separate reliability/UX candidate; P5 display reuse is optional and cannot become payment authority. No deferred database/infrastructure proposal is automatically promoted into this iteration.

### Step C — implement and return a concrete tester handoff

Implement only the selected change and necessary supporting safeguards. Apply the coding rules, relevant monetary/security regressions, lint, explicit typecheck and required build. Hand the tester the exact candidate identity, matched baseline, scenario and case IDs using the guide; do not present a passing unit test as runtime readiness proof.

If fixture setup is blocked, continue diagnosis or measurement preparation, but do not expand into speculative optimizations while waiting. A separately evidenced correctness defect may still require a scoped fix; document it as such rather than claiming an unmeasured performance win.

### Step D — tester records baseline/candidate evidence

The tester appends an identified run to `tester-results.md`, including matched conditions, sanitized samples/artifacts, outcome counts, case statuses and limitations. Compare visible content, current quote and selected-method/confirmation readiness separately. The tester then sends the latest run ID for review; file edits alone do not notify the engineer automatically.

### Step E — engineer reviews, then chooses one disposition

- `FIX_AND_RETEST`: correct the candidate's defect/regression; identify a new build and request targeted retesting before another optimization.
- `MEASURE_AGAIN`: improve missing/comparability/instrumentation evidence; do not infer a speed gain or code defect from inadequate measurements.
- `ACCEPT_AND_MEASURE_NEXT`: accept the current bounded change, then investigate the next measured bottleneck only because the overall agreed goal remains unmet. Give any new optimization its own improvement ID and brief.
- `STOP_ACCEPTED`: agreed runtime, performance, correctness/security and error/resource criteria pass for the selected scope. Record acceptance and leave remaining proposals deferred.
- `REJECT_OR_ROLLBACK`: reject an unsupported or unsafe candidate; use the existing authorized rollback process where applicable, then measure the restored/current build.

A better latency number never overrides a money, security, duplicate-write or stale-confirmation failure. An unknown submit outcome requires reconciliation and the existing idempotency lifecycle, not another uncontrolled payment attempt. Acceptance does not itself authorize deployment.

### Current next action

Wait for the user's implementation request while related system work is underway. At that time perform Step 0, update this plan to the actual system, then prepare the applicable baseline brief and obtain current tester evidence. No application optimization, threshold, staff assignment, successful run or deployment is created by this plan update. [Current status](current_status.md) and the [tester log](tester-results.md) must reflect observed progress, not anticipated work.

## 1. Objective and success definition

Reduce the wait between the cashier requesting payment and being able to safely confirm the selected settlement. Optimize the full path: page readiness, optional metadata, proxy/authentication, quote preparation, database/network dependencies, rendering, and confirmation. An immediately visible cached receipt is useful UX but is not proof that financial confirmation is ready.

Preserve monetary outcomes and current workflows. Do not conceal dependency failures behind zero tax, zero balances, an invented currency, empty eligible-method lists, or silently adjusted tender. Keep New Order and shared Edit Payment V4 compatible; do not replace Edit policy, preview/apply, or order-revision contracts.

Requested latency goals are benchmark hypotheses: server quotes of 350 ms for three lines and 500 ms for thirty lines; first safe readiness within 600 ms near the server or 1 second from Oman; same-cart cached visibility within 100 ms. No percentile was supplied with those numbers. P0 must assign p50/p95 definitions and representative conditions before they become release SLOs. Safe payment readiness on reopen must be reported separately from cached visibility.

## 2. Verified starting point

This section records the earlier 2026-10-24 review snapshot, not a guarantee about the system at implementation time. Step 0 must refresh its applicability after the user's related changes; historical observations alone do not select an optimization.

Existing V4 already coordinates financial totals, currency, selected taxes, eligible methods and permission-safe balances in `POST /api/v1/orders/payment-quote`. Its browser hook shares opening work, consumes cancellation, locks immediately during a 300 ms edit debounce, rejects obsolete results, and binds confirmation to opening/revision/response identity. Pricing already deduplicates complete lookup inputs with concurrency bounded at six. Submit independently recalculates and rejects amount mismatches before its financial write sequence.

Remaining source-level opportunities include repeated conditional settings resolution, serial financial fact loading, late metadata mounting, duplicate Auth verification across proxy/API layers, full-page mismatch recovery, and no separate reusable display snapshot.

The quote endpoint is not universally read-only: customer availability loading can synchronize expired loyalty points. No speculative call schedule is authorized by this plan until that behavior is deliberately accounted for. [Findings](technical_docs/findings_and_proposal_assessment.md) contain the detailed review and evidence boundaries.

## 3. Candidate scope and exclusions

P0 provides measurement and P6 provides scope-appropriate acceptance checks on each selected iteration. P1-P5 preserve detailed candidate designs for request-owned facts, metadata, authentication deduplication, mismatch recovery and display reuse. They are not a bundled initial release or a mandatory sequence. Existing endpoints and service boundaries remain; add no new financial engine just for quotes.

Deferred work is individually specified under [deferred/](README.md#separate-deferred-proposals): shared policy caches, settings SQL rewrite, bulk pricing, speculative quote prefetch, local JWT migration, permission claims/caching, new permission batching primitives, rollout infrastructure, and operational events. Relevant P6 checks gate acceptance of each selected change; they do not imply implementing the deferred items or deploying every accepted candidate immediately.

Initial application scope is the Organization app (`cleanmatex`). If a task requires an HQ settings/flag API change, stop that dependent work at the integration-contract boundary and scope it separately; continue independent local tasks. Migration drafting/application boundaries remain explicit. No reset, migration execution, or schema regeneration is part of P0-P6.

## 4. Invariants for every phase

1. Derive tenant and cashier from validated server session context. Every `org_*` query and joined tenant table has its own explicit `tenant_org_id` predicate; all writes set/filter that identifier.
2. Keep CSRF validation and authoritative permissions. `orders:create` is required for the current quote; detailed balance visibility is optional; `pricing:override` remains conditional. Do not make optional balance permission a new checkout prerequisite.
3. Preserve server session termination, membership, tenant binding, idle/absolute expiry, and forced-password-change behavior. A JWT signature is not a replacement for those checks.
4. Currency and precision come from the verified tenant currency authority. Missing configuration stays 422 `MISSING_TENANT_CURRENCY`; an unavailable authority stays 503 `TENANT_CURRENCY_UNAVAILABLE`. Never cache a fallback as verified policy.
5. Settings reads distinguish successful absence from transport/resolver failure. Strict consumers must never receive the forgiving reader's empty map as successful resolution.
6. One request-local tax profile snapshot feeds display and calculation. Preserve tax order, compound behavior, exemption rules, rounding and promotion stacking/ties.
7. Keep request-owned and client caches separate. No module-level map may hold authenticated Supabase clients, tenant context, customer balances, or unbounded financial entries as a request cache.
8. A cached display is not payment authority. Confirmation binds to the active opening, input revision and successful current response; stale/pending/failed work invalidates it.
9. Preserve entered tender, legs and references. Do not rewrite money on toggles, refresh, mismatch, mode changes, reopen or currency changes. If existing entries become invalid, explain the conflict and require cashier action.
10. Final submission remains independently validated and idempotent, with transaction-time checks for balances, credit, methods and operational sessions. No quote reserves funds.
11. Existing HTTP quote responses remain `private, no-store`. A private client display cache is not permission to add public/CDN caching.
12. Errors, logs, cache keys, tracing and metrics must not expose gift-card credentials, tokens, raw cart contents, names, phone numbers, or balances.

## 5. P0 — establish evidence and reproducible fixtures

### Tasks

- P0.1 Record the exact commit/diff scope, build ID, dependency versions, deployment/API/DB/HQ regions and test origin. Record source currency/POS fixture prerequisites without recording secrets or copying live customer data.
- P0.2 Provision the test tenant's active base currency and legitimate POS/drawer setup through supported operational workflows. Verify relevant cashier permissions. Do not bypass gates or alter currency defaults to obtain green tests. Fixture writes need the intended environment and explicit operational authorization; read-only inspection may proceed independently.
- P0.3 Begin with successful first/warm opens of the common supported three-line cashier flow. Select additional New/Edit, thirty-line, customerless/customer, credit, promo/gift, VAT-fallback or exemption cohorts only when relevant to the suspected bottleneck or required correctness coverage of the selected change. The full catalog is available for broader financial work; it is not mandatory before the first small iteration. Keep each compared scenario's input fixture stable.
- P0.4 Measure click-to-visible, click-to-authoritative-quote, selected-method readiness and confirmation readiness separately. Trace proxy/auth, CSRF availability, quote, brands/terminals and drawer/session state; do not infer the whole path from the handler's `Server-Timing`.
- P0.5 Count transport calls and executed database work separately, including SQL inside RPCs, connection wait, rule/promo candidate volume and HQ calls. Overlapping stage durations must not be summed as if sequential.
- P0.6 Define p50/p95 SLOs, workload/concurrency, warm/cold classifications, timeout/error ceilings and baseline-relative release thresholds. Named engineering/product/operations owners and values are pending decisions, not fabricated commitments.

### Deliverables and gate

A reproducible sanitized benchmark record following [observability guidance](technical_docs/observability_and_benchmarking.md), fixture inventory, accepted measurement definitions and identified top critical-path stages. Successful monetary runtime proof requires a configured fixture; a skip or safe currency rejection does not satisfy that gate. While setup is blocked, diagnosis, instrumentation and fixture preparation may proceed; selecting an optimization still requires relevant measured evidence. Start only the selected P1-P5 subtask after Step B, and apply relevant P6 checks to that candidate.

## 6. P1 candidate — request-owned financial facts and safe concurrency

### Affected code

- [Quote service](../../../../web-admin/lib/services/payment-quote.service.ts).
- [Settings service](../../../../web-admin/lib/services/tenant-settings.service.ts).
- [Order calculation](../../../../web-admin/lib/services/order-calculation.service.ts), plus pricing, discount, tax, credit and rounding collaborators only where required.
- [Quote contract](../../../../web-admin/lib/types/payment-quote.ts) and focused service tests.

### Tasks

- P1.1 Introduce a small explicit request-owned preparation context passed through quote/calculation boundaries. Store promises for verified facts, not just completed values, so concurrent consumers share the same work. Prefer this over ambient state; AsyncLocalStorage is an alternative only when propagation costs justify it and isolation is tested.
- P1.2 Resolve required settings through one strict underlying operation per identical `(tenant, branch, user)` scope. Separate genuinely different scopes instead of claiming one resolver call across different inheritance contexts. Legacy forgiving APIs can retain their behavior around the strict result, but cannot supply defaults to strict money callers.
- P1.3 Load settings lazily when VAT fallback or positive-limit credit policy needs them; do not turn a previously unnecessary resolver read into a universal dependency. The positive-limit quote credit-mode read must use the strict path, with successful unset values following the existing documented mode rule.
- P1.4 Confirm the approved settings consumption boundary against the HQ integration contract before extending resolution. Reuse the existing supported adapter; introduce no new direct catalog reads or settings-save path in the tenant quote.
- P1.5 After authenticated customer/branch validation, begin independent facts concurrently: tax profiles, tenant currency, pricing mode, effective methods, current availability, and applicable read-only rule/promo/exemption/credit facts. Preserve feature and permission eligibility before starting unnecessary work. Keep concurrency bounded and sensitive maintenance behind validated ownership.
- P1.6 Resolve rounding after currency is known. Separate credit exposure loading from evaluating the final sale total. Reuse verified customer facts only where their selected fields and freshness agree.
- P1.7 Keep evaluation order unchanged: base pricing and charges, existing manual/automatic/promo rules, exemptions/tax, currency rounding, gift application and final amount eligibility. Do not calculate promo caps, taxes or credit decisions before their amount dependencies exist.
- P1.8 Keep adapters/services responsible for reads and policy resolution; use pure evaluation helpers where facts are fully loaded. Do not put financial logic in the route or create a parallel monetary algorithm.
- P1.9 Add stage/count evidence for settings, currency, pricing, rules, tax, balances and credit without logging returned facts. Bound the request lifetime; preserve error codes and existing server/client deadlines. Client abort still does not promise cancellation of database work already running.

### Tests and gate

Assert concurrent same-scope settings consumers share one underlying call, different tenant/branch/user scopes never share, strict failures remain failures, empty successful results remain distinct, optional facts stay lazy, foreign context prevents customer work, and money golden fixtures remain unchanged. Compare measured DB/RPC counts by scenario to P0. Do not claim millisecond improvements from mocks.

### Rollback boundary

Revert this application increment while retaining existing quote/submission contracts. No schema rollback is required. Do not retain request-owned context beyond the request.

## 7. P2 candidate — prepare metadata without a second loading wave

### Affected code

`payment-modal-v4.tsx`, `use-payment-catalog.ts`, `use-payment-engine.ts`, the existing `use-cash-drawer.ts` hook, their query-key/options definitions and focused component/hook tests.

### Tasks

- P2.1 Centralize the existing brands/terminals query options so prewarming and consumers use identical keys, fetchers, permissions and freshness. Include tenant/cashier/branch context as applicable; keep configuration freshness bounded rather than introducing perpetual caching.
- P2.2 Start authorized metadata preparation in the existing page/shell lifecycle alongside the quote, before `PaymentFullView` waits for currency. Prefer intent-driven warmup if P0 shows page-load work wastes traffic. Metadata-only prewarming does not authorize speculative whole-quote calls.
- P2.3 Add authenticated cashier identity to drawer keys and propagate AbortSignal through the drawer fetch. Add bounded timeout/error handling consistent with existing client API conventions.
- P2.4 Distinguish relatively static drawer configuration from current linked/active session authority. If separating the payload requires an API change, keep that refactor separately scoped; initial parallel preparation can reuse the existing response with operational freshness intact.
- P2.5 Invalidate/recheck affected session state after existing open/close/suspend/relink actions and financial completion. No long TTL may make an ended session valid. Final submit revalidates operational prerequisites.
- P2.6 Show local Cmx loading/retry UI for affected controls. Cash is not blocked by a terminal-brand failure; a method requiring a drawer/terminal remains blocked while its own required state is unresolved. Preserve keyboard focus and accessible loading feedback.

### Tests and gate

Verify metadata begins alongside payment preparation, shell/full view share in-flight work, cross-user/tenant keys are isolated, cancelled reads cannot repopulate current state, current-session changes invalidate readiness, and optional failure does not cover the whole modal. Capture EN/AR/RTL desktop and narrow-screen behavior.

## 8. P3 conditional candidate — remove duplicate authentication work safely

### Affected code

`proxy.ts`, `lib/middleware/jwt-tenant-validator.ts`, `require-permission.ts`, and the existing CSRF helper only as needed. This is a shared-boundary change, so regression scope exceeds the payment route.

### Tasks

- P3.1 Trace which layer validates identity and refreshes/writes auth cookies for protected APIs, public APIs, pages, session endpoints and forced-password flows. Record all callers affected by moving the proxy's API early return.
- P3.2 Choose one existing authoritative API boundary for request identity validation. Remove the extra Auth network call only if cookie refresh/session lifecycle behavior is preserved. Do not trust a client-provided header as previously validated identity.
- P3.3 Keep the server session guard, tenant/membership checks, and permission evaluator unchanged in meaning. If the candidate change affects routes relying on proxy refresh, adapt the shared mechanism or stop this task until a secure scoped design exists; never remove the guard to hit a performance target.
- P3.4 Deduplicate identical permission work within a request only where semantic options match. Retain authoritative decisions and conditional override checks. A new one-call DB batching primitive is [D07](deferred/D07_authoritative_permission_batching.md), not a hidden migration in P3.
- P3.5 Keep cheap CSRF validation before expensive body/auth work. Optionally share in-flight CSRF token reads across mounted consumers, scoped to the browser session, with failure eviction and rotation/expiry recovery. Retry only known CSRF failures under existing idempotency rules; never blindly replay financial submissions.
- P3.6 Measure full request auth work including proxy and permission/session RPCs, not only the route's stage timer. Preserve machine-extracted route permission declarations/access-contract behavior.

### Tests and gate

Prove unauthenticated, expired/revoked, membership-removed, wrong-tenant, forced-password and permission-denied requests still fail; refreshed cookies remain correct; public endpoints and page redirects retain intended behavior. Verify required versus optional permissions and price overrides. Re-run relevant access-contract gates if enforcement code changes. Local `getClaims()` substitution and permission-list caching remain deferred.

## 9. P4 optional reliability candidate — refresh amount mismatches in place

### Affected code

`new-order-modals.tsx`, `use-order-submission.ts`, `payment-modal-v4.tsx`, `payment-full-view.tsx`, existing mismatch dialog/feedback, EN/AR payment message catalogs, and submission/confirmation tests. Preserve existing Edit preview/apply and follow-up flow.

### Tasks

- P4.1 Route `AMOUNT_MISMATCH` back to the active payment session instead of requiring a full page reload. Keep the mismatch response shape compatible unless an additive change is explicitly documented and tested.
- P4.2 Invalidate confirmation immediately and refresh the current-input quote. Preserve cart, tender text, legs, references and relevant operational selections. Do not resubmit automatically after a refresh.
- P4.3 Show localized before/after differences and the specific action needed when a leg or method no longer satisfies new limits. Do not silently rebalance, cap a gift/wallet allocation, or rewrite exact-cash amounts.
- P4.4 Require explicit cashier review and new confirmation after the successful refresh. If currency/precision changes, use existing reopen/recovery behavior; never relabel entered money into another currency or precision.
- P4.5 Distinguish amount conflicts from transport failures/unknown submission outcomes. Preserve the existing idempotency key on a transport retry of identical payload; after confirmed pre-write rejection and an intentionally changed reviewed payload, follow the established new-attempt lifecycle. Verify actual route claim/replay behavior before changing key handling.
- P4.6 Add quote/display-cache invalidation to successful financial completion and relevant existing mutation handlers while retaining legacy consumer invalidations. Do not change transactional debit checks.

### Tests and gate

Exercise totals changing during confirmation, a mismatch followed by refresh, repeated failures, simultaneous edits, cancel, context switch, currency change and a late submit response. Verify no duplicate writes, no implicit re-post, no typed money mutation, and no return to readiness with a stale confirmation.

## 10. P5 optional UX candidate — fast display reuse with current financial authority

P4 is a dependency. Whole-quote speculative prefetch and cross-opening ready-to-submit quote reuse remain [D04](deferred/D04_speculative_quote_prefetch.md). This phase adds safe display reuse only.

### Tasks

- P5.1 Add a separate bounded, memory-only reusable display snapshot. Keep the disposable opening/revision query as the authoritative readiness source. Do not simply remove session identity or replace `gcTime: 0` with a global thirty-second quote policy.
- P5.2 Derive display identity from the complete normalized financial request plus tenant, cashier/session, branch and customer. Exclude correlation IDs from content identity. Preserve meaningful ordering, including selected compound taxes and original line mapping. Do not persist/log raw credentials or sensitive payloads as keys.
- P5.3 Start with a short proposed maximum display lifetime (30 seconds, configurable through existing code conventions rather than a new tenant setting). It is an upper bound for presentation, not a claim of guaranteed policy validity. Bound entry count/memory; no localStorage, persisted query cache, service worker or cross-session reuse.
- P5.4 On reopen, show a matching snapshot immediately and request a current quote. Clearly indicate refresh; keep financial confirmation disabled until the active session receives successful current authority. Metadata may remain usable where its own rules allow it.
- P5.5 Evict relevant entries after submit/stored-value/promo/gift/config mutations known to the current client. Clear on sign-out, session/tenant/cashier changes and sensitive-permission changes. Time expiry handles unseen changes only for display; server checks handle authority.
- P5.6 Preserve last confirmed display through a refresh error with an explicit stale/error state and retry. Never make old data ready merely because the new fetch failed. Reopen with changed currency/precision uses safe recovery instead of relabelling tender.
- P5.7 Ensure shell and engine still share one core opening quote. Avoid a new initial zero-discount request followed by another initialization request. Cancel superseded work and retain rapid edit/revert protections.

### Tests and gate

Verify same-input reopen visibility, fresh-authority lock, TTL eviction, memory cap, full-input key coverage, cross-identity clearing, failure behavior, same-total/different-currency cases and no sensitive persistence. Measure visible and safe-ready latency separately. Sub-100 ms visual reopening is not an accepted safe-ready result by itself.

## 11. P6 — verification for each selected improvement

1. Run relevant service/hook/route monetary goldens and meaningful new regressions. Re-run touched auth/session boundary suites for P3. No unrelated full suite is required merely because this is a performance change.
2. Run full web-admin ESLint, explicit TypeScript checking, EN/AR checking after message changes, and production build after frontend changes. Build currently tolerates TypeScript errors in its configuration, so a build cannot replace the explicit typecheck.
3. Run the improvement brief's mandatory configured-fixture browser cases on a production build. Select affected New/Edit, Simple/Advanced, cash/card/deferred, typed-money, retry, keyboard/RTL and session paths according to the actual change. Mismatch-recovery acceptance is required when that feature is selected or affected; do not implement optional recovery merely to satisfy an unrelated metadata test. Use intercepted posting for payload checks; real transaction proof requires a separately authorized disposable fixture and ledger assertions.
4. Compare the selected candidate with its matched baseline under equivalent geography, build mode, data, cache and concurrency conditions. Also report cumulative change from the original P0 baseline when comparable. Report p50/p95 with sample coverage, error/timeout rates, resource pressure, calls per scenario and any increased background traffic.
5. Validate access contracts/inventories where relevant. Compare existing six navigation mismatches with baseline; do not allowlist or change unrelated gates to obtain a pass.
6. Execute a rollback rehearsal for the application increments. Confirm existing preview/checkout endpoints and submission consumers remain compatible.
7. Append tester evidence and the engineer's response in `tester-results.md`; update status with exact commands/build IDs and remaining limits. Accept only the selected subtask whose gates passed; do not mark an entire workstream complete from partial evidence. Record `STOP_ACCEPTED` when the agreed goal is met and retain other work as deferred. Production acceptance remains pending until appropriate deployed measurements exist.

## 12. Related-area coverage

### Database and finance

P0-P6 add no schema, index, RLS policy or SQL function. Preserve ledger locking, expiry, debit idempotency, quote deadlines and existing money precision. Batch pricing, settings-engine changes and new authorization SQL are deferred proposals; drafting a migration does not authorize applying it. Recheck the actual migration sequence only when drafting an approved change.

### Backend, APIs and services

Retain the quote, submit, existing preview and legacy checkout/balance endpoints. Retain current request bounds, response guards and safe error codes. New request-context types or pure helper modules belong in established service/type boundaries; do not scatter equivalent caches across services. Additive future DTO fields must be optional until all existing consumers are compatible.

### Frontend and UX

Use shared Cmx controls and existing feedback APIs. Reuse field validation/summary patterns; resolve translated strings before `cmxMessage` where applicable. Search the glossary and existing EN/AR keys before adding terms. Preserve loading, focus, cancellation, responsive layouts, Simple/Advanced behavior and current Edit follow-up operations. Do not add a navigation entry for this work.

### Access and configuration

No new permission, role, feature flag, plan bound, tenant setting, package, environment variable or external integration is needed initially. Existing permissions remain the contract. Any approved rollout flag belongs to D08 and its dedicated registration process; it must not be hand-defined only in TypeScript.

### Ownership and handoff

Application/service owner, frontend owner, security reviewer, finance reviewer and operations owner are roles to assign before execution, not named people assumed by this document. Shared authentication changes need security regression review; financial helper changes need monetary-parity review; HQ/database phases need their separate ownership/application gates.

## 13. Per-improvement completion and stop checklist

Use the checklist for the selected improvement scope. Record unselected optimization phases as deferred/not applicable with a reason rather than implementing them solely to check a box. The relevant correctness, evidence and release gates still apply; a `STOP_ACCEPTED` entry in the tester log must identify which scope and criteria were satisfied.

- [ ] Improvement ID, exact build/diff and comparable baseline are recorded.
- [ ] Step 0 is recorded against the current related system; solved/changed/inapplicable tasks are revised and in-progress work is preserved.
- [ ] Selected metric/statistic, thresholds and mandatory correctness/security cases are agreed; no `PENDING` criteria are treated as passed.
- [ ] One small measured-bottleneck change is selected, or evidence shows that no code change is needed.
- [ ] Only necessary supporting work is included; relevant candidate safeguards and financial/operational boundaries are verified.
- [ ] Required static, scoped regression, configured-fixture runtime and performance evidence applies to the actual candidate build.
- [ ] Tester results and artifacts are recorded; skipped, blocked, failed and inconclusive cases remain explicit.
- [ ] Engineer records the last reviewed run ID, diagnosis and disposition, with exact retest needs where applicable.
- [ ] Money/security failures are resolved; submission identity and unknown-outcome recovery remain safe.
- [ ] If the agreed overall criteria pass, `STOP_ACCEPTED` is recorded and remaining optimizations stay deferred.
- [ ] If another optimization is justified, it gets a new brief/ID based on a measured remaining bottleneck.
- [ ] Applicable rollback and deployment boundaries are documented; acceptance alone does not deploy.
- [ ] Deferred items remain separately tracked; no implied migration, cache or infrastructure deployment.
- [ ] No unrelated changes reverted; no unsupported production-speed or bug-free claim.

See [decisions and risks](decisions_and_risks.md), [test scenarios](testing_guide_and_scenarios.md) and [release guide](deploy_guide.md) for the exact follow-up records.
