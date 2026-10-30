# Payment performance developer guide

Status: **design only; implementation pending**. This document describes the next performance iteration. Current-source observations below do not mean the proposed changes are deployed or verified in production. No latency target is a measured result of this documentation work.

Start with [the plan](development_plan.md), [the financial snapshot contract](technical_docs/financial_snapshot_contract.md), and [developer diagrams](developer_guide_mermaid.md). Preserve the existing financial calculation and tenant boundaries while optimizing their execution.

## Current source and responsibilities

- `web-admin/src/features/orders/ui/new-order-modals.tsx` composes Payment V4 from the cart, selected customer, branch, user, express mode, service categories, and order preferences.
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx` creates an opening-session key, freezes the opening request, resolves the first quote, and mounts `PaymentFullView` when verified currency is available. It resets the form on opening and provides initialization, currency failure, Cancel, and Retry states.
- `web-admin/src/features/orders/hooks/use-payment-quote.ts` canonicalizes the complete request, shares shell/engine queries, debounces later edits by 300 ms, locks submission immediately on changed inputs, and distinguishes session, input revision, and response identity. The current query has `staleTime: Infinity`, `gcTime: 0`, and a new opening identity; this is not a reusable 30-second quote cache.
- `web-admin/src/features/orders/api/payment-quote-api.ts` sends the CSRF-protected quote POST, consumes React Query cancellation, applies a 30-second client deadline, validates response shape and monetary fields, and rejects responses with the wrong echoed request ID.
- `web-admin/src/features/orders/hooks/use-payment-totals.ts` builds quote inputs from current form/cart state and derives financial presentation from the returned snapshot.
- `web-admin/src/features/orders/hooks/use-payment-engine.ts` composes totals, settlement options, entered payment legs, gift/promo state, metadata, drawer requirements, and validation. Required metadata blocks only the methods that need it.
- `web-admin/src/features/orders/hooks/use-payment-catalog.ts` gets amount-sensitive methods from the same quote as totals. Brands and terminals have five-minute freshness; these queries currently start when the full payment view mounts.
- `web-admin/src/features/orders/hooks/use-cash-drawer.ts` combines drawer configuration with current drawer sessions and the cashier's active POS context. Drawer data currently has 30-second freshness; the active POS read has 15-second freshness. These responses are operational state, not static catalogs.
- `web-admin/src/features/orders/ui/payment-full-view.tsx` preserves form state and payment legs, binds confirmation to the reviewed client snapshot, and closes an invalidated confirmation before submission.
- `web-admin/src/features/orders/hooks/use-order-submission.ts` sends the order/payment workflow and handles its server responses. The existing invalidations of legacy checkout/balance query keys must be extended before a reusable quote cache is introduced.
- `web-admin/app/api/v1/orders/payment-quote/route.ts` owns the HTTP/security boundary. It delegates to `web-admin/lib/services/payment-quote.service.ts`, which coordinates financials, method configuration, and balances with timing metadata.

The first quote already removes the old independent browser totals/options/balances waterfall. There is still a later metadata wave because the shell mounts the full view after that quote. An optimization must not reintroduce separate amount-sensitive method authority.

## Proposed request-scoped financial context

Implement an explicit request-scoped context owned by the quote orchestration, with typed promises for shared settings and financial configuration. Pass it through service boundaries rather than adding process-global mutable state. A request-local `Map` of in-flight promises is sufficient where the existing service contract allows it; AsyncLocalStorage is an alternative only after its lifecycle and integration are demonstrated.

For settings, deduplicate the underlying resolved-settings result by the **complete** resolution scope: tenant, branch, user, and any resolver/profile context actually used. Tenant plus branch alone is insufficient when user overrides exist. Start equivalent reads once and share the promise, including concurrent reads.

Do not memoize only a permissive `getSettingValue` result and then feed it to `getSettingValueStrict`. The strict consumer must retain the difference between a successful missing setting and an unavailable resolver. Cache a typed raw success/failure outcome; let existing adapters apply their own strictness semantics. Do not replace unavailable financial configuration with empty objects, false, zero, or an invented currency.

React `cache()` must not be assumed to memoize arbitrary Route Handler/service calls. Select a mechanism that is demonstrated to share work inside this POST execution. Cross-request Redis, process-memory, or Next.js caching is a separate deferred consistency decision, not a prerequisite for request-local deduplication.

## Proposed dependency scheduling

Resolve authentication and authorization before using tenant-specific work. Validate referenced branch/customer ownership before performing speculative customer-related operations. Within that safe boundary, start independent config/data reads together and reuse their results.

The dependency graph remains meaningful: rounding configuration depends on the verified currency; amount-sensitive eligibility depends on computed totals; promo usage, gift validity, tax exemption, and balances need current server facts. Calling every operation in `Promise.all` cannot make dependent work independent. Retain existing rounding order, tax compound order, promo precedence, and eligibility semantics. Do not describe discount/promo/tax execution as pure in-memory math while their necessary data reads remain inside those services.

Keep controllers thin and all `org_*` reads/writes explicitly tenant-scoped. No direct settings-catalog query is introduced in the tenant application. The existing resolution boundary and HQ ownership remain intact.

## Complete input fingerprint

Use a single normalization utility and typed query-options factory for the shell, engine, and any future prefetch caller. A fingerprint covers every accepted financial input, including:

- Tenant and authenticated user/cache session; selected branch and customer.
- Ordered lines with product ID, quantity, price override, service-preference surcharge, and packing surcharge.
- Express mode, manual percent discount, manual amount discount, and service categories.
- Ordered order-level preferences, including preference code, source, extra price, and configuration ID when supplied.
- Tax-profile selection **in its meaningful order**; never sort tax arrays as though compound taxes commute.
- Promo code and gift-card ID/number/requested amount when applicable.
- Any future accepted input that changes calculation or eligibility.

Normalize empty/absent values using the server schema's semantics, not arbitrary coercion. Preserve meaningful array order. Never round values during hashing. Reuse the canonical request model instead of maintaining an unrelated list of hash fields that drifts as the API evolves.

Do not include PINs, auth/CSRF tokens, cookies, or credentials in a fingerprint. Do not persist or log full requests, raw query keys, gift-card numbers, balances, or amount-bearing fingerprints. Prefer an opaque digest for diagnostics and browser-cache keys; it is identity metadata, not server financial authority. Clear any future display cache on logout, auth/session change, or tenant/cashier change. Browser persistence is not part of this proposal.

## Display cache versus financial authority

The proposed display cache and the authoritative quote have separate jobs:

- A short-lived display entry can make an unchanged cart look ready immediately while current authority is being checked. It cannot authorize settlement, hide refresh failure, or grant access to a balance from a previous identity.
- An authoritative quote is server-computed from current verified facts. Current client session/revision/request IDs protect race handling and confirmation continuity. They are not an authenticated server quote version.

Retain monotonic input revisions even if the cashier reverts to an earlier cart. A late result must not overwrite the current revision, and a restored display entry must not reactivate an earlier confirmation. Never rewrite entered money or selected settlement legs as a side effect of cache refresh, mode switch, or dialog close. When refreshed facts make them invalid, explain the issue and require the cashier to choose a correction.

The initial proposed P5 cache is **display-only**, memory-only, with a provisional maximum of 30 seconds further bounded by known sensitive time windows. Every opening still obtains fresh server authority before submission. P4 establishes the reviewed-expectation/mismatch and retry contract first. It does not require a new server quote-version field or stored/signed quote infrastructure. Authoritative quote reuse is not enabled merely by changing `gcTime` or `staleTime`; it remains a separate deferred design. Full quote prefetch/reuse remains [D04](deferred/D04_speculative_quote_prefetch.md); batch pricing remains [D03](deferred/D03_batch_pricing.md).

## Metadata and operational state

Move brand/terminal query definitions into shared, typed query options and warm authorized metadata alongside the opening quote. Keep tenant/user/branch identities aligned across prefetch and consumers. Invalidate configuration caches after relevant successful changes; do not duplicate network calls with different keys.

Treat active POS and drawer sessions separately. They can close, suspend, or relink while the page remains open. Add cashier identity to any shared drawer key, consume cancellation signals, apply bounded failures, and ensure required operational state is current at financial submission. Warm reads may remove a waterfall; they must not bypass a session gate or turn a stale drawer session into permission to accept cash. The server must revalidate required session state at the write boundary.

Only required metadata blocks the applicable method. A brand lookup failure should remain a localized recoverable issue; optional terminal metadata must not disable cash. Drawer/POS errors must remain explicit for methods that require them. Cross-cashier invalidation is an optional later improvement described in [D09](deferred/D09_operational_state_events.md), not a condition on which financial correctness depends.

## Prefetch safety and cancellation

Cancellation already exists for the quote and brand/terminal reads. Preserve it. Client abort prevents stale UI updates; it does not prove a DB operation already executing has stopped. The quote route's response deadline likewise does not cancel all underlying database activity.

The current quote calls stored-value availability, which can synchronize due loyalty expiry into the ledger. Therefore the current endpoint must not be advertised as entirely side-effect-free or automatically invoked on every cart edit/hover. D04 requires a genuinely read-only spendable calculation, or another explicitly reviewed maintenance boundary, before speculative quote prefetch is enabled. Start with limited intent-based warming, deduplicate callers, debounce edits, and measure extra request volume.

## Verification and delivery

Implementation must add focused regressions for complete input identity, rapid edit/revert, open/close/reopen, logout/tenant/user changes, late replies, failed refresh, currency changes, stale confirmation, permissions, and operational session transitions. Compare financial outputs against the established calculator before accepting any batching or scheduling change. Include tax-inclusive/exclusive, ordered compound taxes, manual/automatic discounts, promo/gift behavior, pay later/credit, rounding, overpayment/change, and balance changes.

Measure server stages and click-to-interactive separately. Report 3-line and 30-line, cold/warm, customer/no-customer, method requirements, and network location. A cache paint is not a payment-ready measurement. Use [the testing guide](testing_guide_and_scenarios.md) and [deployment guide](deploy_guide.md); no production rollout, feature flag, migration, or telemetry pipeline is created by this documentation.
