# Development sequence

Status: proposed. Date: 2026-10-24. The detailed task and acceptance authority is [implementation_plan.md](implementation_plan.md); this file is its execution index, not a competing design.

Execute only the next small change justified by measurements, using the [tester handoff](tester-handoff-guide.md) and [results log](tester-results.md). Retest after each candidate and stop when agreed performance and correctness criteria pass. The sequence below expresses dependencies and available increments; it does not mandate completing every optimization.

## Active execution loop

Before the loop, perform **Step 0 current-system revalidation** in the main plan. The user is working on related changes; implementation waits for the future request. Review the resulting flow and latest evidence, remove solved/inapplicable work, revise changed tasks and record unfinished dependencies before measuring or choosing an optimization. Repeat the affected check after relevant changes and before resuming; preserve other work.

1. **Baseline first:** prepare an investigation brief in the tester log, inspect current prerequisites and capture a successful representative baseline. Record desired criteria explicitly; do not treat suggested numbers as agreed targets.
2. **Choose one change:** use the evidence to select one bounded subtask with a build identity, hypothesis, affected cases and rollback boundary. No candidate is preselected today. If the baseline already meets the agreed goal, record acceptance and stop.
3. **Implement and verify:** change only that scope, run relevant checks and issue a concrete tester handoff for the candidate build.
4. **Test and record:** append comparable baseline/candidate results, samples, outcomes and blockers; notify the engineer with the latest run ID.
5. **Review and decide:** record `FIX_AND_RETEST`, `MEASURE_AGAIN`, `ACCEPT_AND_MEASURE_NEXT`, `STOP_ACCEPTED` or `REJECT_OR_ROLLBACK`. No unexplained regression is carried into a new optimization.

The tester/engineer record is [tester-results.md](tester-results.md); the procedure is [tester-handoff-guide.md](tester-handoff-guide.md). A successful latency result cannot bypass correctness/security or turn missing evidence into a pass. Stopping the optimization loop and authorizing a deployment are distinct decisions.

## Candidate workstreams and dependencies

1. **P0: evidence and fixtures.** Establish configured currency/POS fixtures, baseline timings, regions, workloads and metric definitions. Instrument early enough to see proxy/auth and metadata outside the quote handler. Runtime configuration blockers do not authorize bypassing gates.
2. **P1: request facts.** Share strict settings promises by tenant/branch/user, remove avoidable serial reads, keep financial evaluation order and fail-closed behavior. No new shared cache or schema.
3. **P2: metadata.** Reuse shared query options, start brands/terminals and current operational reads earlier, fix drawer identity/cancellation and preserve method-specific blockers.
4. **P3: authentication deduplication.** Audit proxy/API refresh ownership, then remove redundant verification with session, tenant, permission and password-change semantics intact. This phase needs focused shared-boundary regression evidence.
5. **P4: mismatch recovery.** Replace the page-reload dependency with explicit in-place quote refresh and reconfirmation, preserving tender/legs and the existing idempotency lifecycle.
6. **P5: display reuse.** Add a bounded private presentation cache; retain a fresh opening quote as financial authority. No speculative full-quote prefetch or stale ready-to-submit quote reuse.
7. **P6: acceptance.** Consolidate meaningful tests, explicit typecheck, lint, build, configured-fixture browser proof, performance comparisons and rollback evidence.

The list is a design reference, not a queue to implement in full. P1/P2 are likely sources of small candidates if measurements support them; select a subtask rather than bundling both. P3 requires evidence and its shared-security gate. P4 is a separate reliability/UX improvement; P5 is optional and retains P4's stated prerequisite. P0 evidence and relevant P6 validation apply to every accepted change. If fixtures are blocked, continue diagnosis/preparation rather than starting speculative optimization. When criteria pass, stop with the unused workstreams deferred.

## Suggested review units

- Measurement/fixture/test-harness changes.
- Request-fact and calculation changes with golden-parity tests.
- Metadata/query-key/cancellation changes with frontend regressions.
- Shared-auth change with session/cookie/permission regressions.
- Mismatch recovery and EN/AR feedback.
- Display reuse with identity/freshness tests.
- Consolidated runtime evidence and documentation update.

Keep each unit reversible and do not combine a schema migration with an unrelated frontend release. Deploying only part of a unit must not make cached data payment authority.

## Later increments

[D03 batch pricing](deferred/D03_batch_pricing.md) is the leading database candidate when large-cart measurements justify it. [D04 speculative prefetch](deferred/D04_speculative_quote_prefetch.md) follows an explicitly safe read/maintenance contract. [D01-D02](README.md#separate-deferred-proposals) require settings ownership/invalidation and precedence decisions. Auth/authorization migrations and rollout automation have separate reviews.

No dates, staff assignments, or speed commitments are inferred. Assign owners and effort estimates after P0 and the open decisions in [decisions_and_risks.md](decisions_and_risks.md).
