# Observability and benchmarking

Status: proposed measurement design. Updated: 2026-10-24. No new telemetry instrumentation, sampling pipeline, dashboard, alert or benchmark run is delivered by this documentation.

See [test scenarios](../testing_guide_and_scenarios.md), [deployment](../deploy_guide.md), and [deferred rollout](../deferred/D08_rollout_flag_and_automatic_rollback.md).

## Current evidence and measurement gaps

`payment-quote/route.ts` already emits a server request ID, coarse `Server-Timing` and completion/failure logs through `PaymentQuoteTiming`. Existing stage names include `auth`, `quote`, `context`, `financials`, `tax_profiles`, `methods`, `balances`, `credit`, and calculation stages such as pricing/tax. Confirm names against the candidate source because stages may change during implementation.

The timer begins inside the route handler. It does not measure proxy authentication before the handler, connection establishment, network travel, page/CSRF prerequisites, browser parsing/rendering or metadata readiness. In the inspected baseline the proxy calls `getUser()` before returning API requests, and the route's validator calls it again. A fast `quote` span is not proof of a fast click-to-ready experience.

Historical local acceptance was blocked by missing tenant base currency and POS session. Previously quoted first-open/reopen values and proposed speedups must not be presented as verified benchmark results.

## Define user-observable milestones

Use monotonic browser time for durations. Create one attempt ID per intentional open; correlate to server request ID when a request is made, without embedding customer/cart contents.

- `click_to_shell_ms`: opening action to visible usable dialog shell with Cancel/focus behavior.
- `click_to_display_ms`: opening action to displayed verified or explicitly refreshing snapshot. Record whether display came from a previous compatible quote.
- `click_to_quote_ready_ms`: opening action to current quote accepted for active inputs.
- `click_to_method_ready_ms`: opening action to the selected method's required metadata and operational checks becoming ready.
- `click_to_interactive_ms`: opening action to safe entry/review for the intended method; define the method class and prerequisites. A visible modal or enabled Cancel alone is not ready to pay.
- `refresh_to_ready_ms`: financial edit or explicit retry to the current quote/method being ready again.
- `mismatch_recovery_ms`: rejected submit through refreshed quote and review availability; exclude cashier thinking time from technical duration and retain a separate journey duration if needed.

Record cancel, validation block, stale-discard and timeout as outcomes rather than assigning artificial zero latency. Do not classify expected missing configuration as a successful quick quote.

## Server spans and concurrency

Use a request root span covering handler entry to response creation, and a separate upstream/proxy span if the existing deployment telemetry can safely connect it. Record CSRF, authenticated context, required/optional permission checks, bounded body parsing, context ownership, settings resolution, currency, tax profile, base pricing, promotions, gift validation, credit, methods and balances as bounded fixed stage names.

Parent spans include child time. Parallel spans overlap. Do not add `financials + methods + balances` and call the sum wall time; do not add `quote` to its children. Report:

1. Root elapsed time.
2. Child elapsed spans and overlap/critical path.
3. Exclusive time only when instrumentation measures it by subtracting the union of child intervals, not a naive sum of durations.
4. Unattributed handler time and upstream/client gaps separately.

`PaymentQuoteTiming` currently stores one duration per stage label. Reusing a label overwrites the earlier duration; it is not a counter/histogram or a full trace tree. Add aggregation/span IDs deliberately if repeated events must be analyzed. Do not infer exclusive CPU time or query counts from current headers.

Deadline responses may return before underlying database work finishes. Measure late completion/cancellation effectiveness separately; an HTTP timeout or browser abort does not establish DB cancellation. A server timing header describes stages recorded before serialization, not work completed afterward.

## Work and cache metrics

Measure compatible settings-resolver calls per request and memo hit/miss/waiter counts. Separate success-unset, required-missing, infrastructure-failure and denial outcomes without raw values. Record candidate cardinality, unique price-lookup count versus input-line count and bounded concurrency where necessary.

Track three different cost layers:

- Application transport: RPC/HTTP requests and direct database round trips.
- Database execution: statements/function invocations, execution time, rows examined/returned, buffer usage and query-plan shape on controlled fixtures.
- Operational contention: connection-pool wait, active connections, locks, DB CPU and late-running operations.

One RPC can run many internal SQL operations. A target such as eight RPCs cannot prove a settings resolver loop or line-pricing workload is efficient. Obtain SQL-level evidence in an approved environment with representative parameters and safe read-only inspection; avoid indiscriminate production `EXPLAIN ANALYZE` because functions may have side effects.

For future client reuse, distinguish cached display, freshness age, validated authority, reuse accepted/rejected and background refresh failure. For any future distributed cache, identify layer/version/TTL and invalidation propagation without putting cache keys containing customer data into logs.

## Privacy and cardinality

Telemetry must never include quote bodies, customer names/IDs, balances, entered amounts, card/PIN/gift data, promo codes, cookies, authorization/CSRF tokens, database URLs or raw provider errors. A server-generated random request ID is sufficient for request correlation. Avoid serializing errors with request context attached.

Use low-cardinality fixed dimensions: build identifier, deployment region, coarse cart-size bucket, method category, cold/warm category, outcome/error code and candidate/control cohort. Tenant/user identifiers are not metric labels. If isolated tenant-level troubleshooting is approved, use existing restricted access controls and short retention rather than exposing identity in headers or public analytics.

Review screenshots/traces separately; they may contain information intentionally excluded from structured telemetry. Apply the existing retention/access policy. Do not send telemetry to a new external service without separate approval.

## Proposed sampling policy

Subject to existing observability capacity and privacy review, start with full aggregate outcome/error counters, sampled successful duration traces and rate-limited error traces. A possible staging policy is 100% during controlled benchmark windows; a possible production starting point is 5% of successful traces and up to 100% of error traces with an explicit cap. These are proposals, not configured defaults.

Sampling must not bias duration percentiles toward fast requests. Define whether production p95 comes from a complete duration histogram or a representative sampled population and record coverage. Suppressing repeated errors must retain aggregate counts. Keep raw trace retention bounded and use existing facilities before adding a dependency.

## Reproducible benchmark protocol

1. Record baseline/candidate commits, build mode, region, instance size/runtime, database/HQ location, network path, connection reuse and fixture versions. Keep tracing overhead equivalent.
2. Use production builds. Separate development compilation from measured work. Disable unrelated test jobs that distort DB/pool pressure, or record that load explicitly.
3. Define cold categories precisely: new browser/session versus a genuinely new server process/instance versus cold DB/cache. Do not call a cleared React Query cache an infrastructure cold start.
4. Exercise 3/30 lines and realistic larger supported baskets; include unique and repeated products, customer/no-customer, branch, express, promo/gift and method-specific metadata paths.
5. Measure initial open, warm open, identical-cart reopen, changed cart, expired/invalidated display, retry and cancel. Keep enabled/disabled proposal behavior matched to the same data.
6. Measure near the deployment and on a real Oman path using the same cashier flow. Record network conditions. Emulated RTT/bandwidth is a supplementary diagnostic, not a claim of measured Oman performance.
7. For each warm scenario seek at least 100 completed attempts plus outcome counts; seek enough independent cold starts to estimate their distribution. An initial 30 cold observations may guide investigation but is insufficient for a confident cold-tail SLO. Record actual counts and uncertainty rather than fabricating a p95 confidence claim.
8. Report p50/p95, sample size, errors/timeouts, maximum, request/work counts and resource pressure. Compare matched windows and traffic mix. Include failed/canceled attempts in outcome statistics rather than silently excluding them.
9. Run approved staged concurrency ramps, allow stabilization and stop at agreed saturation/error thresholds. Benchmark quote preparation independently from any approved financial posting test.

The baseline/candidate evidence record should link sanitized artifacts, invocation parameters, timestamps and limitations. Do not commit credentials, storage state or identifiable quote payloads.

## Proposed acceptance budgets

The suggested 350 ms server quote for 3 lines, 500 ms for 30 lines, one second first-open from Oman and 100 ms same-cart reopen are hypotheses. They have no validated guarantee in this pack. A fast cached display is not equivalent to newly validated payment authority.

Before release, agree absolute p95 budgets from the measured baseline and product need, then apply a baseline-relative regression guard. A provisional guard might stop expansion after sustained p95 regression greater than 10%, or error-rate increase greater than 0.5 percentage points, with minimum sample counts and consecutive windows. Choose actual thresholds after baseline volume and natural variance are known; do not implement these sample numbers blindly.

Any money parity failure, cross-tenant/customer exposure, unauthorized balance disclosure, accepted stale confirmation or duplicate financial write is a correctness stop condition independent of sample size or latency. Performance acceptance also requires acceptable DB/pool/lock headroom and no work amplification from prefetch, refresh or retries.

For a DB-call budget, set a separate envelope for fixed core quote reads, unique-line pricing and optional balance/promo paths. First remove repeated compatible reads. Approve constant/bounded-growth targets based on actual function behavior; retain regression tests that count calls without mistaking a mocked call count for a measured database execution plan.
