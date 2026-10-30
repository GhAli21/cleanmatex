# D08: rollout flag and automatic rollback

Status: deferred, not implemented or scheduled for deployment. Updated: 2026-10-24.

See [deployment](../deploy_guide.md), [testing](../testing_guide_and_scenarios.md), and [measurement design](../technical_docs/observability_and_benchmarking.md).

## Decision and reason

A reviewed staged rollout is useful for financial UI performance changes. A new `payment_quote_v2` flag and automatic rollback are not prerequisites for evaluating request-local efficiencies, and this documentation does not create them. The proposed flag name is a candidate only, not an approved database code, API contract, environment variable or deployed capability.

Automatic rollback needs trustworthy health signals, adequate control traffic, stable cohort evaluation, an operational controller, permission to act and a verified recovery path. None is established merely by adding a Boolean flag. Until that infrastructure is approved and proven, use the existing application release/rollback process with a human release owner.

## Preconditions before implementation

1. Identify the precise behavior controlled by the flag and confirm it can safely run beside the baseline. Shared auth/schema changes may not be safely selectable by one client flag.
2. Verify current HQ feature-flag APIs, schema/catalog naming, evaluation cache lifetime and existing release tooling. Do not query feature-flag/settings source tables directly from tenant runtime.
3. Follow the `create-feature-flag` skill. A new flag requires a reviewed forward migration in the tenant-owned migrations repository, applicable plan mappings when plan-bound, and the TypeScript catalog sync. Do not invent a plan limit or permission for this flag.
4. Create migration SQL only after explicit approval of that work. Never apply a migration through this guide, CLI or MCP. The user reviews/applies approved migrations under repository policy.
5. Establish baseline/candidate metrics, privacy controls, alert ownership, minimum sample counts, hold windows and rollback artifact compatibility.

## Proposed cohort contract

Evaluate a deterministic tenant cohort on the server through the authoritative HQ consumption path. Keep an Organization on the same behavior across users, tabs and instances for a given rollout version. Do not use random selection per request or choose financial behavior from caller-supplied headers/local storage.

The candidate sequence is an internal/allowlisted cohort, then 5%, 50% and 100%, with explicit review and hold periods at every step. These percentages are suggestions. Advancement requires enough representative traffic, correctness/security checks and resource headroom; a quiet cohort cannot prove safety merely because time elapsed.

Carry the selected behavior/version through the relevant quote/UI contract where needed. Expanding a percentage must not reinterpret an already-reviewed quote or mutate typed amounts. Final submission stays authoritative regardless of cohort. Avoid routing one logical submission across incompatible protocols on retry.

## Kill switch semantics

Define a maximum kill propagation delay, evaluation-cache TTL and version before release. A candidate starting objective could be a maximum 30-second propagation under healthy infrastructure, but it must be approved, implemented and measured; it is not current behavior or a guarantee.

If evaluation is unavailable, prefer the approved baseline only when that baseline can satisfy the active contract safely. If neither path can validate the required financial authority, fail closed with recovery. A cached enabled flag must not continue indefinitely. Do not claim `revalidateTag` or process-memory eviction instantly updates every instance, browser and HQ evaluation cache.

When disabled, new attempts use the approved baseline. Existing tabs, active quotes and pending confirmations follow an explicit expiry/review policy. A switch must not silently change amounts, bypass a refresh or undo committed transactions. Already-running financial writes complete or fail under their transactional/idempotency rules; a kill switch is not a transaction cancellation API.

## Automatic rollback design, if separately approved

Use an existing approved deployment/controller mechanism where possible. Read bounded low-cardinality health aggregates for candidate and control across comparable windows. Require minimum volume and consecutive breached windows; define hysteresis/cooldown and a human override to avoid oscillation.

Monitor user click-to-interactive, server quote p95, timeout/unavailable rates, database pool/lock pressure and work amplification. Separate expected policy rejections from infrastructure regressions, while recording both. Security/financial integrity signals stop rollout immediately and trigger investigation; automation must not hide or repair ledger discrepancies by reversing data.

The rollback action must be explicitly authorized and audited: who/what acted, observed threshold, cohort/version, flag state before/after, artifact if applicable and acknowledgement. Alert the release owner through an already-approved channel/workflow. No messaging integration or new service is created by this plan.

Test controller loss, stale metrics, partial flag propagation, HQ outage, incompatible client tabs and failed rollback. Metrics absence does not mean healthy. Decide whether it holds expansion or disables candidate; retain manual recovery if the controller is unavailable.

## Acceptance evidence required to close D08

- Registered flag/catalog/mappings are consistent and tenant runtime uses the HQ API.
- Tenant cohorts are stable, reproducible and isolated; no new permission/navigation/plan behavior was added accidentally.
- Measured kill propagation meets the approved bound across instances and active browsers.
- A staging drill demonstrates halt/rollback, pending-confirmation safety, independent server recalculation and idempotent submission.
- Metrics/threshold/controller failure tests pass; ownership, retention and audit evidence are recorded.
- Application rollback is proven without DB reset/destructive operations or reversal of committed financial records.

Until those gates pass, report D08 as deferred. No flag migration, automatic cohort rollout, alerting controller or automatic rollback is delivered by this pack.
