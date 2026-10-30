# Performance coding rules

Version: 1.1.1. Date: 2026-10-24. Status: implementation guidance for future changes; not evidence that the changes are implemented.

Apply these rules when implementing [the performance plan](implementation_plan.md), including its deferred work. Use the general rules across services and UI; the Payment V4 examples explain their application to this feature. Repository security, money, tenant, Cmx, i18n and migration rules continue to apply. This file does not grant approval to implement a deferred item, change a financial rule, apply migrations or deploy.

General repository-wide guidance is maintained in [performance-engineering.md](../../../dev/rules/performance-engineering.md). This file specializes those rules for Payment V4, including its current session/financial authority and implementation-waiting boundaries; do not impose this feature's pending-work status or full scenario catalog on unrelated tasks.

**MUST** identifies a review requirement. **SHOULD** identifies the preferred approach; document the reason and evidence for a different choice. Correctness and security take precedence over a latency target.

## PERF-00 — revalidate before implementing or resuming

- MUST inspect current related source, committed/uncommitted changes, contracts, applicable schema/types, fixture state and latest tester evidence before implementing a task from this plan. Scope the check to the payment flow and affected dependencies; do not substitute a broad repository scan for tracing the actual path.
- MUST compare each selected task with the current system. Mark it still needed, already solved, changed, no longer applicable or blocked by in-progress work, and revise the plan before changing code. Do not duplicate an optimization or preserve a stale architectural assumption merely because it appears in a written plan.
- MUST preserve the user's and other contributors' ongoing changes. Do not reset, revert, stash or overwrite them to make an older patch apply. Hold a conflicting unfinished scope and record its dependency.
- MUST remeasure relevant behavior after changes that invalidate baseline comparability. Prior passing tests, old latency figures and historical configuration blockers are not current acceptance evidence. Retain unaffected evidence only with an explicit reason.
- MUST record the inspected build/diff, changed assumptions, task applicability and required fresh tests/measurements in the tester log. Recheck affected files immediately before editing and reassess if they changed after the review.
- MUST wait for the user's future implementation request in this session; adding this rule does not start application work. On a later authorized run, technical revalidation proceeds within that authorization without inventing repeated permission requests.

## PERF-01 — measure the actual user journey

- MUST capture a comparable baseline before claiming improvement: exact build, fixture, workload, deployment/DB/HQ regions, network origin, concurrency and cache state.
- MUST distinguish time to visible content, current financial quote, selected-method readiness and safe confirmation. Cached paint, an enabled Cancel button and successful payment readiness are different results.
- MUST report p50/p95, sample counts, errors/timeouts and resource pressure. Separate infrastructure cold starts from a new modal opening or an empty browser cache.
- SHOULD optimize the measured critical path first. Do not assign an expected millisecond saving to a refactor without runtime evidence.
- MUST keep failed, cancelled and blocked outcomes visible in the evidence. A missing fixture or skipped assertion is not a fast successful request.

See [the measurement protocol](technical_docs/observability_and_benchmarking.md).

## PERF-02 — keep boundaries and one financial algorithm

- MUST keep routes responsible for transport/security/validation and services responsible for orchestration, data access and domain policy. Pure evaluators consume verified facts and perform no hidden network work.
- MUST reuse existing calculation, eligibility and rounding rules instead of building a faster quote-only alternative that diverges from submission.
- SHOULD use a small explicit typed request context for shared facts. Do not create a generic framework, global service locator or broad module reorganization for a scoped optimization.
- MUST preserve API compatibility and shared New/Edit callers. Changes to Edit preview/apply or revision policy require their own design and tests.

## PERF-03 — never optimize away authorization

- MUST derive identity and tenant from the existing validated session boundary. Every `org_*` query, tenant join and write retains its explicit `tenant_org_id` scoping.
- MUST preserve session termination, membership, idle/absolute timeout, forced-password-change, CSRF, permission and override checks.
- MUST distinguish a required permission from optional detail visibility. Lack of rich balance access must not become an invented checkout permission requirement.
- MUST NOT replace scoped authoritative decisions with a flattened permission list, unverified token contents or caller-provided validation headers.
- SHOULD remove duplicated auth work through the shared boundary only after cookie-refresh ownership and affected API/page behavior are verified. A payment-specific authentication fork is not an acceptable shortcut.

## PERF-04 — deduplicate work inside the request

- MUST memoize the underlying in-flight promise when concurrent consumers need the same verified fact; caching completed values alone does not stop simultaneous duplicate reads.
- MUST include every resolution dimension in the memo key. Settings include tenant, branch and user; other facts may also depend on operation, effective time, policy context or input values.
- MUST distinguish absent, explicit zero/false, denied, malformed and unavailable results. Strict financial consumers must not receive an empty map or default created by a forgiving adapter after a failed read.
- MUST keep request-owned data bounded by the request lifetime. Do not put authenticated clients, customer balances or user-scoped promises into a module-level singleton cache.
- SHOULD use explicit context injection. Do not assume a component-render memoization facility supplies Route Handler request isolation. If AsyncLocalStorage is chosen, prove propagation and concurrent-request isolation.
- MUST define rejected-promise behavior: normally share the same failure within the request; any deliberate retry/eviction must be bounded and tested.

## PERF-05 — parallelize independent reads, preserve dependent evaluation

- MUST map dependencies before adding `Promise.all`. Validate referenced ownership before customer-sensitive or maintenance-producing work.
- SHOULD overlap independent configuration/fact reads after the applicable security gate. Resolve currency-dependent rounding after currency is known; evaluate amount thresholds and caps after their amount inputs exist.
- MUST preserve current discount stacking, tax ordering, exemption, gift cap and rounding semantics. Parallel loading does not mean parallel execution of order-dependent financial math.
- MUST bound fan-out. Optional or unused features should not become universal dependencies merely because requests can run concurrently.
- MUST NOT assume parallel promises inside a single-connection transaction create parallel database execution. Preserve transaction boundaries and measure actual pool/connection behavior.
- MUST handle rejection and late completion of all started work. A failed quote must not produce unhandled promise rejections or make late data authoritative.

## PERF-06 — control database work and query growth

- MUST select only required fields and use tenant-scoped, bounded queries. Avoid per-line metadata/tax/customer reads when the facts are shared.
- SHOULD deduplicate identical complete lookup inputs and use a bounded bulk read when available. Do not aggregate separate line quantities if that changes quantity-tier pricing.
- MUST count both application/RPC round trips and SQL work performed inside functions. One RPC containing a resolver loop is not one cheap database operation.
- MUST measure realistic unique-line and duplicate-line carts under concurrency. Fewer queries alone do not prove lower p95 or adequate pool/lock headroom.
- MUST inspect actual function definitions and appropriate query plans before an approved SQL optimization. Use controlled non-mutating reads for production discovery; run any write-capable/executing plan analysis only in an explicitly suitable environment.
- MUST use new reviewed migrations for schema/function/index changes and document tenant predicates, precision, ordering, security and rollback. Never edit applied migrations, reset the DB or apply migrations as part of implementation automation.

Bulk pricing and the settings SQL rewrite remain [D03](deferred/D03_batch_pricing.md) and [D02](deferred/D02_set_based_settings_resolver.md).

## PERF-07 — make cache validity explicit

- MUST document cache purpose, owner, complete key, value sensitivity, lifetime, capacity, invalidation events, failure policy and authority limits before adding it.
- MUST distinguish request memoization, configuration caching, operational-state caching and financial display reuse. Their lifetimes and correctness requirements differ.
- MUST bound memory and entry count; never use an unbounded per-tenant/customer map in a long-lived process. A process cache has separate state in each server instance.
- MUST NOT treat a 30-second TTL, Redis, a database cache-clear function or a Next cache tag as proof of cross-system consistency. Invalidation must actually reach every cache layer and inherited scope that can be affected.
- MUST preserve HQ ownership of settings/platform policy. Do not add direct catalog queries or local settings-save logic to avoid an approved integration boundary.
- MUST keep shared financial-policy caches and their distributed invalidation behind [D01](deferred/D01_shared_settings_cache.md). Do not introduce them implicitly while implementing request-local reuse.

## PERF-08 — separate display reuse from payment authority

- MUST retain opening identity, monotonic input revision and response identity safeguards. A request ID or client hash is not a price guarantee, server quote version or reservation.
- MUST key reusable display data by the complete normalized request and authenticated tenant/cashier/session/branch/customer context. Include quantities, overrides, charges, express mode, discounts, preferences, ordered tax selection, promo and gift application inputs where relevant.
- MUST preserve meaningful array order and zero-versus-absent semantics. Never round or rewrite money merely to obtain a cache hit.
- MUST keep initial display reuse memory-only, bounded and short-lived as defined in P5. Do not persist financial snapshots in localStorage, IndexedDB, service workers or persisted query caches.
- MUST request current authority for a new opening before financial confirmation. Old content may remain visible with an explicit refresh/error state; a failed refresh never makes it ready.
- MUST clear sensitive reuse on logout, identity/tenant/session replacement and applicable permission changes. No response carrying balances may cross authority contexts.
- MUST preserve private, non-cacheable HTTP behavior. A client presentation cache does not authorize CDN or public-response caching.

See [the financial snapshot contract](technical_docs/financial_snapshot_contract.md).

## PERF-09 — respect time and external mutations

- MUST account for prices, taxes, exemptions, promo windows/usage, gift validity/balances, credit exposure, loyalty expiry and operational sessions changing without local input edits.
- MUST invalidate affected client entries after known successful mutations while retaining server validation for changes from other devices or processes.
- MUST NOT claim version-aware freshness when the source supplies no trustworthy revision or validity boundary. Do not fabricate versions or extend authority using client clock changes.
- SHOULD invalidate/revalidate on the applicable reconnect/focus/session lifecycle events according to the data's authority requirements; do not turn background refresh into uncontrolled traffic.
- MUST treat optional realtime/event notifications as invalidation hints, not proof that no event was missed or that a payment is authorized.

## PERF-10 — prefetch only deliberately safe work

- MUST classify each fetch as a pure read, maintenance-producing operation, reservation or mutation before scheduling it speculatively.
- MUST NOT add hover/cart prefetch of the current full quote merely because it is called a quote: its availability path can synchronize loyalty expiry.
- SHOULD prewarm permitted metadata through shared query definitions first. Whole-quote speculation remains gated by [D04](deferred/D04_speculative_quote_prefetch.md).
- Once approved, speculative work MUST be eligibility-gated, deduplicated, bounded, cancellable and measured for waste/load. Rapid cart edits and pointer movement must not create a request storm.
- MUST NOT retry speculative financial work indefinitely, silently disable expiry maintenance, or make unsuccessful prefetch block an otherwise recoverable opening.

## PERF-11 — cancellation, deadlines and retries have separate roles

- MUST consume the query-provided AbortSignal in transport and cancel superseded work. Still verify active identity/revision before accepting results: cancellation alone is not a race-proof authority check.
- MUST preserve bounded body/line limits and centralized deadline conventions. Distinguish user cancellation, dependency timeout, invalid input and configuration failure in safe error handling.
- MUST NOT claim browser abort or an HTTP response deadline cancels a database statement or transaction already executing. Use database-side limits only under a separately reviewed compatible policy.
- MUST avoid stacked unbounded retries across browser, route, SDK and dependency layers. Retry only classified transient failures within a defined attempt/deadline budget.
- MUST preserve the existing idempotency identity for uncertain outcomes and identical-payload retries. Do not blindly replay a financial submission, issue a fresh key after an unknown outcome, or replay a changed payload under the old key.

## PERF-12 — preserve monetary meaning

- MUST use the established money/decimal and currency-rounding helpers; do not introduce float-based shortcuts, changed intermediate precision or arbitrary tolerances to hide mismatches.
- MUST keep verified tenant currency and precision authoritative. Missing setup and failed reads remain explicit blocking errors; never guess currency, tax or balances to improve readiness.
- MUST preserve charge inclusion, inclusive/exclusive tax, compound order, promo stacking/ties, gift caps and overpayment/change semantics.
- MUST keep a single effective tax-profile snapshot through quote display/calculation. Request-local shared facts reduce inconsistent rereads but do not imply that all database reads occurred in one transactional snapshot.
- MUST independently recalculate and validate at submit, with existing transaction-time debit/credit/session checks, audit records, idempotency and failure recovery. Performance work must not expand transaction lock duration unnecessarily or imply the multi-stage submission is one database transaction.
- MUST characterize existing precision/tie behavior before a bulk rewrite; intentional financial-rule corrections need explicit review and separate evidence from performance parity.

## PERF-13 — preserve entered money and explicit review

- MUST keep cart state, tender text, payment legs and references through a recoverable quote refresh. Do not silently rebalance, clamp, cap or replace user-entered values.
- MUST invalidate confirmation whenever current quote authority becomes pending, failed, changed or obsolete. Recheck identity and readiness at the actual Confirm action.
- MUST explain amount mismatches inline/in the established feedback flow, refresh in place under P4, and require explicit review before another submission.
- MUST use safe recovery when currency/precision changes; never relabel existing tender into another currency. Preserve the established no-silent-money-mutation rule.

## PERF-14 — load metadata early without stale operational approval

- SHOULD share brands/terminals query keys/options between prewarming and consumers so one request is reused rather than duplicated.
- MUST include applicable tenant, cashier and branch dimensions and consume cancellation for drawer/session reads.
- MUST distinguish relatively static configuration from current POS/drawer session state. Long configuration freshness must not authorize a closed, suspended or reassigned session.
- MUST refresh/invalidate affected operational state after existing lifecycle actions and revalidate at submission.
- MUST block only payment methods requiring unresolved metadata. A card-terminal failure must not globally disable an otherwise valid cash flow.

## PERF-15 — keep frontend rendering and feedback efficient

- MUST reuse Cmx components, existing query/state patterns, EN/AR keys and RTL-safe layouts. Preserve visible labels, keyboard focus, cancellation and accessible loading/error explanations.
- SHOULD subscribe to the state actually used and keep query input construction stable. Profile rerenders before adding memoization, custom comparators or state stores; do not suppress necessary financial updates to reduce render counts.
- MUST follow the repository React effect, form and lint rules. Do not create synchronization effects that repeatedly reset the form or cause a second initialization quote.
- MUST keep last confirmed presentation during eligible refreshes and localize loading to the affected area. New initial loading and cached-display refreshing have different UX states.
- MUST use resolved translations with `cmxMessage`/`useMessage()` where applicable; field validation and existing summary patterns retain their documented role.

## PERF-16 — instrument without leaking data or distorting results

- MUST use fixed, low-cardinality stage/outcome labels and safe correlation IDs. Do not log raw requests, financial fingerprints containing inputs, gift identifiers/PINs, tokens, customer identities or balances.
- MUST distinguish parent/child and overlapping spans. Do not sum parallel stages as wall time or infer SQL execution count from a duration map.
- MUST include proxy/auth, client CSRF availability, metadata and rendering gaps when reporting end-to-end latency. Handler-only `Server-Timing` does not cover the entire journey.
- SHOULD use existing telemetry, bounded retention and an explicitly recorded sampling policy. Sampling and tracing overhead must be comparable between baseline and candidate.
- MUST avoid secrets in cache keys and artifacts as well as logs. Hashing predictable sensitive values does not automatically make them safe to publish.

## PERF-17 — prove correctness and performance separately

- MUST add meaningful focused tests for the change: money parity, strict errors, tenant/user isolation, request-promise sharing, cancellation/out-of-order results, confirmation, cache eviction and operational transitions as applicable.
- MUST compare monetary outcomes across inclusive/exclusive tax, ordered compound tax, discounts/promos/gifts, deferred/credit, rounding, overpayment/change and expiry boundaries when those paths change.
- MUST test call growth by scenario and representative cart size. Mocked call-count assertions protect architecture; they do not prove actual DB plans, provider latency or concurrent debit correctness.
- MUST run required lint, explicit typecheck, applicable EN/AR checks and the production build after frontend changes. Do not assume a build's success proves type safety when its configuration permits type errors.
- MUST obtain configured-fixture production-build browser evidence and comparable runtime benchmarks before performance acceptance. Do not substitute broad unrelated test runs for missing relevant proof.

## PERF-18 — release incrementally and report actual limits

- MUST keep implementation units scoped and reversible, retain compatible existing consumers and document any cross-project/schema boundary before proceeding.
- MUST use the existing registration/migration process for new flags, permissions or navigation. Initial P0-P6 does not implicitly introduce them.
- MUST test rollback with already-open clients, cached configuration and pending confirmations in mind. A deployed server rollback does not instantly refresh every tab or cached kill switch.
- MUST NOT claim automatic rollback, globally immediate invalidation or percentage rollout exists merely because a flag name is written in the plan. [D08](deferred/D08_rollout_flag_and_automatic_rollback.md) contains that separate work.
- MUST record exact verification scope, evidence and residual risks. Numerical targets, production readiness and bug-free behavior must not be asserted without supporting proof.

## Review checklist for each implementation increment

- [ ] Current-system revalidation is recorded; the selected task remains necessary after related changes and existing work is preserved.
- [ ] Critical-path hypothesis and baseline are identified; the changed phase is in scope.
- [ ] Security, tenant predicates, currency authority and money semantics are preserved.
- [ ] Shared work is scoped, typed, promise-deduplicated and bounded; optional facts stay optional.
- [ ] Dependency order, concurrency, connection/pool impact and failure/late-completion handling are reviewed.
- [ ] Any cache has a full key, capacity, lifetime, invalidation contract and explicit authority limit.
- [ ] Cancellation, timeout and retry/idempotency behavior are tested independently.
- [ ] Typed money, quote identity, confirmation and operational session freshness remain correct.
- [ ] UI remains Cmx-based, bilingual, RTL-safe, accessible and recoverable.
- [ ] Telemetry avoids sensitive data; measurements separate display from safe readiness.
- [ ] Relevant regressions/static checks pass; required runtime and rollback evidence is captured.
- [ ] Deferred items, migration application and deployment are not silently included.

Supporting references: [financial contract](technical_docs/financial_snapshot_contract.md), [tests](testing_guide_and_scenarios.md), [benchmarking](technical_docs/observability_and_benchmarking.md), [release guide](deploy_guide.md), [decisions](decisions_and_risks.md), and [deferred work](README.md#separate-deferred-proposals).
