# Performance engineering rules

Status: shared implementation guidance. Applies to the Organization app and its repository tooling; preserve module-specific access patterns and higher-priority security, money, migration and authorization rules.

## Scope and proportionality

Apply the relevant sections when changing data access, request orchestration, caching, asynchronous UI/query lifecycles, expensive rendering, or investigating a reported performance issue. Ordinary copy, styling and other low-impact edits do not require a benchmark project, new cache, new dependency or broad audit. Existing repository lint/typecheck/build requirements still apply.

This document is the common source for performance guidance across agent instructions and domain skills. The domain sections in `.agents/skills`, `.codex/skills`, `.claude/skills` and existing Cursor rules are concise adapters: keep their performance meaning aligned without overwriting their unrelated content or metadata. Change the common rule here, then update each affected adapter explicitly. Do not infer that entire skill copies are identical or automatically synchronized.

Feature plans add specific requirements; they do not silently become global implementation policy. Payment-specific details remain in [the Payment V4 coding rules](../../features/Order_Fin/Performance_Enhance/performance-coding-rules.md) and [financial snapshot contract](../../features/Order_Fin/Performance_Enhance/technical_docs/financial_snapshot_contract.md).

## 1. Revalidate before applying an old plan

- Check current related source, changed contracts/schema/types, actual prerequisites and latest evidence before implementing or resuming a proposed optimization. Limit discovery to the affected path and direct dependencies.
- Mark proposed work still needed, solved, changed, inapplicable or blocked by ongoing work. Revise stale assumptions before coding; do not duplicate behavior now provided by the system.
- Preserve other contributors' edits. Recheck selected files before applying a patch; never reset, revert, stash or overwrite unrelated work to fit an older plan.
- Refresh measurements when relevant changes break comparability. Retain unaffected evidence only with a reason. Revalidation is a technical check within existing authorization, not an invented extra approval flow.

## 2. Trace cost through the whole operation

- Trace UI, proxy/middleware, route, service, RPC/SQL, HQ/provider and render work as applicable. A small-looking helper can resolve an entire collection or repeat authentication.
- Record the expected query/request growth for representative input sizes. Count transport calls and executed database work separately; a single RPC can contain a costly loop.
- For a performance task, capture a comparable baseline and select one small change addressing a measured bottleneck. Retest and stop when the agreed performance and correctness criteria pass. Do not execute an entire optimization backlog without evidence.
- Distinguish current data ready for the user's action from merely visible/loading/cached content. Record outcomes, sample coverage, p50/p95 where justified, and resource pressure rather than quoting an unsupported speed guarantee.

## 3. Share verified facts within a request

- Reuse an in-flight promise for identical fact resolution so simultaneous consumers do not duplicate work. Include all resolution dimensions: tenant, user, branch, policy/operation context, inputs and effective time as applicable.
- Prefer explicit typed request-owned context. Do not use a process-global map of authenticated clients, tenant/customer facts or unresolved promises as a request cache.
- Keep strict failures distinct from successful absence, zero/false and denied access. A forgiving adapter's empty fallback must not become verified financial or authorization configuration.
- Keep optional reads lazy. Do not turn an unnecessary settings/customer/provider call into a universal dependency just to populate a snapshot.
- Do not assume a component-render memoization API provides Route Handler memoization. Verify the installed framework's supported context rather than copying an unrelated caching pattern.

## 4. Preserve dependencies and bound concurrency

- Separate loading verified facts from evaluating policy/math, reusing existing service/use-case boundaries. Keep controllers/routes thin and avoid a second business algorithm for a fast preview.
- Start independent reads together only after the applicable security/ownership gate. Preserve dependencies such as currency before currency-dependent rounding, amount before eligibility caps, and validation before maintenance-producing customer work.
- Avoid both sequential N+1 reads and unbounded `Promise.all` fan-out. Bound concurrency and measure connection-pool/lock pressure under realistic load.
- Do not assume concurrent promises inside a single-connection transaction produce parallel SQL execution. Preserve established transaction and lock ordering.
- Handle every started operation's failure/late completion. Cancellation and timeouts must not create unhandled rejections, accept stale results or silently abandon necessary financial recovery.

## 5. Make cache ownership and authority explicit

- Document purpose, complete key, sensitivity, lifetime/capacity, invalidation producers/consumers, failure behavior and authority limits before adding a cache.
- Distinguish request facts, relatively static configuration, operational state and presentation snapshots. Active sessions, spendable balances, usage limits and permissions are not static catalogs.
- Include tenant/cashier/session/branch/customer and complete input identity where they affect results. Preserve meaningful input ordering and absent-versus-zero semantics. Clear sensitive data on identity/logout/context changes.
- Bound memory and entry count. No indefinite financial authority or sensitive browser persistence without a separately reviewed contract. Retain private HTTP behavior for private data.
- Invalidation must cover actual affected layers and inherited scopes. A database cache-clear function does not also evict process, Redis or framework caches; a short TTL does not authorize stale financial/security decisions. Account for multiple instances and external changes.
- Respect HQ ownership and established API boundaries for settings/platform policy. Do not add direct catalog reads or bypass shared evaluators to reduce latency.

## 6. Make async lifecycle and side effects visible

- Pass the query's AbortSignal through transport, cancel superseded work and still check current identity/revision before adopting results. A fetch abort or HTTP deadline does not prove an already-running database statement or transaction stopped.
- Use centralized bounded deadlines/input limits and classify cancellation, timeout, invalid input and configuration failures. Avoid stacked automatic retries across layers.
- Before prefetching, classify the operation: pure read, maintenance, reservation or mutation. Names such as `get`, `preview` and `quote` do not establish read-only behavior.
- Start safe, authorized required metadata early using shared query options; avoid component-mount waterfalls. Deduplicate and bound speculative work, and measure wasted requests.
- Keep current mutation idempotency/outcome recovery. Do not replay an uncertain payment with a new identity or reuse an old identity for an intentionally changed payload.

## 7. Preserve correctness, access and user intent

- Every `org_*` read/join/write retains explicit tenant predicates or tenant assignment, even when RLS/context guards also exist. Preserve session, permission, CSRF, membership, forced-password-change and price-override checks.
- RLS policies must call auth helpers wrapped in a scalar subquery so they run once per statement: `tenant_org_id = (SELECT current_tenant_id())`, `(SELECT auth.uid())`, `(SELECT auth.jwt())`, `(SELECT auth.role())`, `(SELECT is_admin())`. A bare `current_tenant_id()` may run per row (measured 23× slower on admin `EXISTS` policies; see migration `0649`). Check with `supabase/checks/rls_unwrapped_auth_helpers.sql`, which must return zero rows.
- Remove duplicate security work only through a reviewed shared boundary with cookie-refresh and revocation behavior intact. A flattened permission list, verified JWT alone or caller header does not replace established authoritative session/access policy.
- Preserve money precision, rounding, ordering, fallback semantics and final transactional validation. A quote/display snapshot is not a reservation or substitute for current submission checks.
- Never substitute invented currency, zero tax/balances or successful empty catalogs for failed required reads. Explain recoverable failures using existing localized UX.
- Never silently rewrite typed money, payment legs or references to accommodate a refreshed result. Invalidate obsolete confirmation and require review where financial meaning changes.

## 8. Keep UI work focused

- Reuse Cmx, existing state/query/form conventions, EN/AR and RTL behavior. Share query definitions between prewarming and consumers so they reuse work.
- Subscribe only to needed state; profile meaningful render cost before adding memoization/custom comparators or new state stores. Do not suppress necessary updates to improve render counts.
- Keep loading/failure local to required controls where possible. An optional metadata failure must not globally disable an unrelated valid action. Preserve accessible focus, cancellation and recovery.
- Avoid synchronization effects that repeatedly reset forms or trigger a second initialization request. Apply the existing React effect/form/lint rules rather than adding a parallel state machine without need.

## 9. Validate the relevant claim

- Add meaningful scoped regressions for changed behavior: promise sharing/scope, strict errors, query growth, identity/cancellation, cache invalidation, financial parity, session/permission semantics and user-entered state as applicable.
- Mocks and call counts protect architecture; they do not establish DB plans, provider performance, transaction races or deployed latency. Runtime acceptance needs an appropriate configured fixture and production-build evidence.
- Run existing required static checks; keep explicit typecheck separate from build when configuration can ignore type errors. Do not run unrelated full suites or require new tooling merely to claim thoroughness.
- Use controlled, suitable environments for plans/load/write-capable tests. Keep database changes in new reviewed migrations; agents never reset the DB or apply migrations under repository policy.
- Instrument fixed low-cardinality stages/outcomes without request contents, secrets or customer financial data. Parent/parallel spans overlap; do not sum them as total elapsed time. Sampling, regions, cache state and fixture conditions must be comparable.
- Record exact evidence, skipped/blocked cases and limitations. Roll out/roll back through the existing authorized process; no automatic rollback, instantly propagated kill switch or deployment is implied by a flag name or test result.

## Review handoff

For a changed performance-sensitive path, record: current-system applicability; the expensive operation/query-growth expectation; request/cache ownership and freshness; concurrency/cancellation/failure behavior; preserved access/domain invariants; relevant checks; and runtime evidence appropriate to the claimed improvement. For a small unrelated edit, state that no performance-sensitive behavior changed rather than manufacturing measurements.
