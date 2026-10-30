# Decisions, risks and other follow-ups

Date: 2026-10-24. Status: planning register. Recommendations below are not silently approved infrastructure or business-rule changes.

## Initial design decisions

- **DEC-01 Request context:** prefer explicit request-owned fact/promise injection. No React Server Component cache assumption in the quote Route Handler, and no process-global authenticated data map.
- **DEC-02 Financial freshness:** reusable snapshots are display-only in P5. New openings continue to obtain current authority. The existing `requestId` remains correlation, not a signed quote version or balance reservation.
- **DEC-03 Money preservation:** refreshing a quote invalidates confirmation; it never silently changes tender/legs. A currency/precision change follows safe reopen/recovery.
- **DEC-04 Cache service:** no Redis or Next shared policy cache is introduced initially. Request-local reuse does not require distributed invalidation.
- **DEC-05 Boundaries:** no new settings/flag catalog reads in tenant code. Follow HQ consumption ownership and preserve existing service compatibility. A conflicting legacy access pattern is a scoped integration decision, not permission for further bypasses.
- **DEC-06 Initial infrastructure:** no new endpoint, migration, permission, navigation entry, flag, package or environment variable is assumed. Record and review any discovered need before implementation.

## Open decisions with entry gates

### OPEN-01 Measurement contract

Assign engineering/operations owners. Agree p50/p95, cold/warm definitions, Oman test origin, concurrency, representative datasets and acceptable error/timeout/resource changes before performance acceptance. The supplied targets are hypotheses until then. See [benchmarking](technical_docs/observability_and_benchmarking.md).

### OPEN-02 Test environment and legitimate fixtures

Confirm which environment may receive fixture setup and financial test writes. Use tenant currency/POS operational flows and disposable identifiers; no invented defaults, auth bypass or production transaction without authorization. Record current prerequisite status before treating the older missing-setup observations as present blockers.

### OPEN-03 Authentication refresh ownership

Before P3, identify API routes that rely on proxy cookie refresh. Choose the authoritative boundary and prove refreshed-token propagation plus session termination behavior. If the safe change exceeds scoped review, hold P3 independently rather than weaken guards.

### OPEN-04 Settings scope and strict credit mode

Verify inheritance dimensions and approved settings adapter. Confirm successful unset credit-policy mode behavior while distinguishing it from resolver failure. Share requests only when tenant, branch, user and relevant policy context are identical.

### OPEN-05 Submission attempt lifecycle

Trace idempotency claims for confirmed pre-write `AMOUNT_MISMATCH`, transport timeout, processing response, successful replay and reviewed changed payload. Preserve same-payload retry keys; use the existing established new-attempt path only after intentional changes. A mismatch-refresh UI must not break replay safety.

### OPEN-06 Future pricing parity

Before D03, decide treatment of equal-priority ties and the existing three-decimal scalar intermediate versus four-decimal money columns. Characterize first; do not combine an unnoticed money-rule correction with a performance parity release.

### OPEN-07 Future quote authority

If ready-to-submit cross-opening reuse is proposed later, specify server-issued lifetime, resource/policy versions, complete input/financial fingerprint, expiry boundaries and submit comparisons. Same numeric totals do not bind currency or tax provenance. This is excluded from display-only P5.

## Risk register and controls

### R-01 Cross-tenant or cross-cashier cache reuse

Impact: information disclosure or incorrect payment readiness. Control: authenticated scope in keys, explicit tenant predicates, no global client/session maps, logout/context eviction and multi-identity tests. Required evidence: simultaneous tenant/user requests and late-response cancellation.

### R-02 Stale financial settings or permissions

Impact: old tax, credit or authorization policy. Control: request-local scope initially; shared cache proposals require cross-instance version/invalidation, inherited-scope propagation and fail-closed behavior. A short TTL alone is not policy approval.

### R-03 Loyalty side effects during speculative fetch

Impact: unnecessary ledger maintenance, load and surprising timing. Control: keep current maintenance behind validated context; defer whole-quote hover/cart prefetch until read/maintenance semantics are reviewed. Never disable expiry handling merely to speed up tests.

### R-04 Parallel work overload

Impact: higher pool contention and p95 despite faster isolated requests. Control: bounded pricing/fact concurrency, optional-read gating and realistic concurrent-cashier benchmarks. Compare both traffic and executed work.

### R-05 Amount changed after confirmation

Impact: stale tender or unintended posting. Control: current-authority lock, explicit mismatch recovery/review, server recalculation and transaction-time limits. Test same-total changed-currency/tax provenance as well as obvious amount differences.

### R-06 Shared auth regression

Impact: security bypass, lost token refresh or redirect failures. Control: central boundary ownership, preserved session guard, required/optional permission semantics and focused API/page/session tests before P3 release.

### R-07 Apparent performance improvement hides failures

Impact: reporting a fast cached display or skipped test as successful payment readiness. Control: distinct visible/quote/method/confirm metrics, success/error cohorts, recorded fixture gaps and configured production-build acceptance.

### R-08 Unrelated checkout changes contaminate evidence

Impact: false parity or unreliable attribution. Control: record build/commit/diff, preserve others' work, avoid broad reformatting and scope tests to the exact reviewed increments. A prior successful build does not verify later concurrent changes.

### R-09 Monetary precision or ordering drift in SQL rewrite

Impact: changed invoice/tax totals despite fewer calls. Control: parity fixtures, explicit precision/tie decisions, effective-date boundaries, ordered compound taxes and forward-only reviewed migrations. See D02 and D03.

### R-10 Rollback is slower than assumed

Impact: a cached flag or old client continues the faulty path. Control: test actual flag TTL/propagation, compatible server contracts, stable cohorts and deployment rollback. Automatic rollback is deferred infrastructure, not an existing guarantee.

## Related work outside this increment

The nine [deferred files](README.md#separate-deferred-proposals) are the authoritative follow-ups for larger performance changes. Separately, existing platform navigation inventory drift and other in-flight line-money/Edit policy programs remain owned by their respective feature packs. Do not expand this performance task into those programs or claim their acceptance.
