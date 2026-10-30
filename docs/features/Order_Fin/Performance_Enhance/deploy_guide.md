# Deployment guide

Status: planning documentation only. Updated: 2026-10-24. All enhancements described by this pack remain pending implementation and release validation. This guide does not authorize database application, production load generation, or deployment.

See [README](README.md), [test guide](testing_guide_and_scenarios.md), [benchmarking](technical_docs/observability_and_benchmarking.md), and [deferred rollout design](deferred/D08_rollout_flag_and_automatic_rollback.md).

## Existing baseline versus this proposal

The coordinated Payment V4 quote already exists in the working tree. Its earlier [implementation evidence](../Payment_Modal_Review/Payment_Modal_v4_Quote_Performance.md) records 393 passing focused tests, lint, typecheck, build and scoped access checks. Those are historical results for that implementation, not validation of this enhancement plan or every subsequent checkout change.

The earlier local runtime fixture lacked an active base currency and active POS session. Successful quote readiness and production latency therefore remain unproven. Six baseline navigation-inventory mismatches were also recorded. Recheck them at implementation time and distinguish baseline failures from new regressions; do not suppress unrelated contracts to obtain a green result.

## Stage 0: agree the bounded release

1. Select the approved enhancement subset and record its commit and baseline commit. Keep deferred database, authorization, cache and rollout work outside that release until individually approved.
2. Document affected New/Edit callers, financial snapshot identity, cache lifetime, session boundaries, cancellation behavior and mismatch recovery. No new permissions, navigation, environment variables or dependencies are required merely to document this proposal.
3. Nominate application, security/finance and release reviewers. Record the previous deployable application artifact and recovery owner before releasing.
4. Establish realistic test fixtures: two tenants, two users with different permissions, valid base currency, relevant branches/customers/catalog, and legitimate cashier POS/drawer sessions. Use approved local/staging fixture setup; do not bypass business gates.
5. Capture baseline latency and resource measurements using the same production build mode, environment, representative carts and geographic path as the candidate.

## Stage 1: implement and review locally

Keep changes scoped and reversible. Prefer request-local reuse of validated facts before introducing cross-request caches. A request memo must not turn unavailable configuration into a default value, or share user/customer-sensitive results across requests.

Security review must verify that any authentication optimization retains session revocation, tenant membership, idle/absolute timeout, forced password change and permission semantics. A locally verified JWT alone is insufficient. A cached list of permission strings must not replace authoritative scope/deny evaluation.

Client review must verify that display reuse does not grant payment authority to stale quotes. Typed money is preserved, changed financial authority invalidates confirmation, and final submission independently validates prices, methods, credit and transactional stored-value availability.

Run the focused checks in the [test guide](testing_guide_and_scenarios.md). Capture complete exit status and output. For frontend implementation, the production build and full quiet ESLint gate are mandatory. A documentation-only pass does not warrant claiming any of these checks were rerun.

## Stage 2: PR acceptance

Attach the following evidence to the implementation PR:

- Exact changed scope, tenant isolation reasoning, known limitations and rollback behavior.
- Money parity fixtures and assertions, including inclusive/exclusive tax, promotions, gifts, credit, rounding and overpayment.
- Auth/session/permission/CSRF regressions for any touched shared boundary.
- Request memo concurrency and error tests; quote lifecycle, confirmation and mismatch recovery tests; affected shared caller regressions.
- Lint, typecheck, focused tests, i18n when applicable and production build results against the candidate commit.
- Real database and production-build browser evidence, clearly separated from mocked tests.
- Matched baseline/candidate timings, cold/warm sample counts, p50/p95, failure counts and resource/load observations.
- Explicit explanations for skipped fixtures and baseline inventory mismatches. Neither is a passed release gate.

If access guards, route dependencies or flags change, run the repository access-contract and inventory workflow for that actual scope. Existing quote routes do not need new navigation or permissions merely because their execution is faster.

## Stage 3: staging deployment and runtime acceptance

Deploy using the existing application pipeline. This plan does not establish a new deployment service or provider automation.

Use a production build against the intended staging database and HQ configuration. Verify New and shared Edit payment, EN/AR and RTL, one initial core quote, metadata readiness, cancel/reopen, discount edits/reverts, optional metadata failure, session expiry and in-place mismatch recovery. For actual payment-posting tests, use an explicitly approved isolated financial fixture with reconciled expected order/invoice/voucher/debit effects and idempotent retries.

Do not create real payments merely to measure quote speed. Even the quote may invoke existing loyalty-expiry maintenance, so use controlled fixture accounts for repeated benchmarks and inspect those side effects deliberately.

Run load tests only against an approved isolated environment. Stop when DB/pool/lock pressure or auth/provider failures exceed the agreed limits. Report failures and timeouts alongside successful latency; dropping slow samples is prohibited.

## Stage 4: production release

For ordinary application changes, follow the existing reviewed release and rollback process. A 5%/50%/100% rollout is conditional on separately implementing and verifying [D08](deferred/D08_rollout_flag_and_automatic_rollback.md). This pack does not claim a new feature flag, automatic rollback mechanism or tenant cohort control exists.

Start with an observation period agreed from actual cashier traffic. Compare baseline/control and candidate by cart size, environment/region and cold/warm state. Distinguish financial-safety failures from expected policy rejections. Any confirmed tenant leak, unauthorized balance disclosure, stale-confirm acceptance or duplicate financial write stops expansion immediately regardless of latency gains.

## Rollback and recovery

Restore the previous reviewed application artifact through the existing process. Preserve data and audit records. Do not reset the database or use destructive changes to restore speed.

Before enabling client reuse, define how the rollback build recognizes or discards in-memory quote data and pending confirmations. A deployment alone does not force already-open browser tabs to reload. Mutating submission still uses current server validation; old browser sessions must get a clear recovery path rather than silently posting against a changed contract.

If a shared cache is eventually introduced, rollback must identify its schema/version and invalidate or isolate incompatible entries. A feature kill switch has a documented propagation deadline; cached flag evaluations cannot be assumed instantaneous. Settings/price/tax changes must preserve their authoritative invalidation boundary across tenant and HQ owners.

No migration is proposed by the immediate documentation work. Any later SQL, batch-pricing RPC, settings materialization, new flag or permission migration needs its own reviewed forward migration. Never apply migrations from this guide; the user applies approved migrations under repository policy.
