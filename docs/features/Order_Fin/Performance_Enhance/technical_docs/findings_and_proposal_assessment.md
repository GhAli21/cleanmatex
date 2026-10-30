# Findings and assessment of the supplied suggestions

Review date: 2026-10-24. Evidence: scoped current-source review and read-only local function-definition discovery during the preceding review. No production timing or database-plan inspection was performed. This is a planning input, not a new runtime test report.

## 1. Server settings and parallel financial preparation

**Adopt in P1:** request-owned strict fact promises keyed by tenant/branch/user, with lazy resolution and a dependency-aware fetch/evaluate split.

`getSettingValueStrict` and the forgiving `getSettingValue` each reach the all-settings resolver independently. The quote conditionally needs VAT fallback and positive-limit credit policy, so its settings-RPC count is zero to two, rather than universally two or three. Currency reads `org_currency_cf`; pricing mode and rounding are distinct authorities. Reusing settings alone cannot eliminate those lookups.

React `cache()` is documented for the Server Component context, so it is not the route-handler memoization contract for this plan. Share raw strict reads; do not memoize the forgiving empty-map fallback into money calculations.

Some parallel work already exists: effective methods and stored-value availability run alongside financial calculation. Further concurrency must retain ownership validation before customer-related work and preserve amount evaluation dependencies.

**Defer:** [D01](../deferred/D01_shared_settings_cache.md) shared caches and [D02](../deferred/D02_set_based_settings_resolver.md) SQL resolver rewrite. Local SQL confirms a catalog loop and a Postgres-only invalidator. A TTL, tag or Redis copy does not supply the missing cross-owner invalidation contract.

Sources: [quote service](../../../../../web-admin/lib/services/payment-quote.service.ts), [settings service](../../../../../web-admin/lib/services/tenant-settings.service.ts), [calculation service](../../../../../web-admin/lib/services/order-calculation.service.ts).

## 2. Client quote reuse and prefetch

**Already implemented:** React Query cancellation signal reaches the quote transport, superseded results cannot become current authority, and opening/revision identity protects edit/revert behavior.

**Adopt in P5:** a separate bounded reusable display snapshot with complete request identity, identity clearing, explicit refreshing status and a fresh-authority confirmation lock.

**Do not adopt as written:** replacing opening identity with an incomplete cart hash and treating a thirty-second quote as current eligibility. External cashiers, expiry, settings and usage caps can change without a local cart edit. Submission must invalidate the new keys as well as legacy balance/options keys.

**Defer to D04:** whole-quote cart/hover prefetch and any authoritative cross-opening reuse. The current availability path calls loyalty-expiry synchronization; speculative fetches are not universally side-effect-free reads.

Sources: [quote hook](../../../../../web-admin/src/features/orders/hooks/use-payment-quote.ts), [transport](../../../../../web-admin/src/features/orders/api/payment-quote-api.ts), [stored-value service](../../../../../web-admin/lib/services/order-credit-application.service.ts).

## 3. Second loading wave

**Confirmed structural opportunity:** the full payment view waits for quote currency before mounting hooks that request metadata. Brands/terminals already have five-minute freshness. Start preparation earlier using shared query options rather than introducing another cache definition.

Cash-drawer results contain current session state. Their existing key lacks cashier identity and the fetch does not consume cancellation. P2 fixes those properties before broad reuse. Do not classify active session authority as rarely changed configuration or allow an optional terminal failure to disable unrelated cash methods.

Sources: [modal shell](../../../../../web-admin/src/features/orders/ui/payment-modal-v4.tsx), [catalog hook](../../../../../web-admin/src/features/orders/hooks/use-payment-catalog.ts), [drawer hook](../../../../../web-admin/src/features/orders/hooks/use-cash-drawer.ts).

## 4. Authentication, permissions and CSRF

**Adopt selectively in P3:** remove redundant identity verification after confirming proxy/API cookie-refresh ownership. Current proxy `getUser()` precedes the API early return, while the route validator calls `getUser()` again.

**Keep:** server session/membership/tenant/timeout/password-change guards and cheap fail-fast CSRF validation. Parallelizing a local cookie/header comparison with expensive unauthenticated work is not a meaningful improvement.

The normal modal remains mounted across opens, so its mount-only CSRF hook does not fetch on every normal reopen. Sharing token reads across multiple hook instances is a smaller improvement with expiry/rotation recovery.

The current authoritative `hasPermissionServer` path uses RPC checks, not Redis. Another permission-list method has a fifteen-minute Redis cache and flattened strings; substituting it can change scoped permission semantics. Local JWT migration, claims caching and a new authoritative batch primitive are separately reviewed in D05-D07.

Sources: [proxy](../../../../../web-admin/proxy.ts), [API validator](../../../../../web-admin/lib/middleware/jwt-tenant-validator.ts), [permission service](../../../../../web-admin/lib/services/permission-service-server.ts), [CSRF hook](../../../../../web-admin/lib/hooks/use-csrf-token.ts).

## 5. Batch pricing

**Good later candidate:** distinct price lookups still use separate scalar RPCs despite deduplication and concurrency six. D03 defines a bulk replacement and parity gate.

The extra application product lookup is exceptional: local scalar SQL already performs normal product-default fallback. Its internal price variable is `NUMERIC(10,3)` and tie ordering is priority then minimum quantity; a rewrite must explicitly address parity and ambiguity. The inspected legacy join visibly scopes the price-item tenant but not the joined price-list tenant. A new function must explicitly scope every tenant table; current production definitions and constraints need separate verification.

Source: [pricing service](../../../../../web-admin/lib/services/pricing.service.ts). Local SQL was inspected read-only; no migration was applied or drafted by this planning task.

## 6. Money correctness

Independent recalculation, amount comparison and idempotency already exist. The request ID is correlation, not quote versioning. Current mismatch recovery can reload the page, making P4's in-place refresh a valuable UX improvement before client reuse expands.

Preserve monetary provenance and currency/precision as well as numeric totals. A quote is not a funds reservation; all final operational and transactional validations remain authoritative.

Sources: [submit orchestrator](../../../../../web-admin/lib/services/order-submit-orchestrator.service.ts), [submit route](../../../../../web-admin/app/api/v1/orders/submit-order/route.ts), [modal wiring](../../../../../web-admin/src/features/orders/ui/new-order-modals.tsx).

## 7. Rollout and performance claims

Adopt phase-by-phase evidence, stable canary cohorts where supported, a tested rollback path, monetary parity tests and scenario-specific call-growth budgets. The existing handler timer misses prior proxy work and later metadata; stage durations can overlap.

The quoted two-second baseline, sub-second targets and claimed per-change savings were not verified by this review. Treat them as hypotheses. An eight-RPC target alone can hide expensive SQL inside a resolver. New feature-flag registration and automatic rollback are D08, not implied existing capabilities.

## External technical references

- [React cache](https://react.dev/reference/react/cache): Server Component context and request memoization caveats.
- [Supabase authentication methods](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs): verified claims, fresh user reads and token refresh behavior.
- [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims): local verification depends on signing configuration.
- [Next.js revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag): stale-while-revalidate versus immediate expiry.
- [Next.js use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache): configuration and cached-scope restrictions; not a mandated framework-mode change here.
- [TanStack cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation): consuming the supplied AbortSignal.

References were consulted during the proposal review. At implementation time verify installed library APIs against the lockfile/source; do not copy a newer documentation API into the current app or expand this work into a package upgrade.
