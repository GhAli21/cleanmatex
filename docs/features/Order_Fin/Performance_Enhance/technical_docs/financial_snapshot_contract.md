# Financial snapshot and cache contract

Status: **proposed extension; not implemented**. The current contract section records source behavior. The remaining sections specify acceptance requirements for future display caching, quote reuse, and reliable submission. No proposed DTO, hash, server quote version, expiry field, new response, or storage mechanism is created by this document.

Related: [developer guide](../developer_guide.md), [developer diagrams](../developer_guide_mermaid.md), [D04 quote prefetch](../deferred/D04_speculative_quote_prefetch.md), and [D09 operational events](../deferred/D09_operational_state_events.md).

## Current wire contract

`web-admin/lib/types/payment-quote.ts` defines `PaymentQuoteRequest` as preview inputs plus `requestId`. `PaymentQuoteData` returns monetary totals and tax details, currency code/precision/FX, selected tax profile entries, amount-matched checkout options, and a permission-safe optional stored-value summary. The route is `POST /api/v1/orders/payment-quote`; responses use `Cache-Control: private, no-store`.

The request body does not establish tenant or user identity. Authentication and authorization do. `orders:create` is required; detailed balances additionally depend on `stored_value:view_balances`. Denied details remain `null`, not an invented zero balance. Configuration failures retain structured missing/unavailable currency behavior.

Current client coordination uses an opening-session key, a monotonic financial-input revision, and the echoed `requestId`. These prevent stale response adoption and stale confirmation inside the current browser workflow. **None is a server-authenticated quote version, reservation, price guarantee, idempotency key, or financial authorization.** The route's independent request header is diagnostic correlation, not authority either.

Current POST does not post a payment/order, but customer stored-value preparation can synchronize due loyalty expiry. Therefore it is not completely read-only. Separate read-time spendable evaluation from expiry maintenance before speculative prefetch is enabled.

## Initial implementation scope

The initial P4 design compares reviewed financial expectations with a fresh authoritative calculation at submit and defines safe retry/idempotency behavior across the affected create/edit paths. Reviewed expectations can be sent as comparison input; they never become the source of financial truth. This does **not** require a new server quote version, signature, persisted quote record, or cross-request cache. Final mismatch DTO fields still require implementation design and tests.

The initial P5 design is display-only reuse in client memory, with a provisional maximum of 30 seconds and earlier expiry for known time boundaries. It always resolves fresh server authority before enabling submission. Browser persistence and authoritative cached-quote reuse are excluded from that initial scope.

## Proposed conceptual DTOs

Names below are design terms, not new exported TypeScript interfaces or API fields:

- **Display snapshot:** opaque input fingerprint, identity scope, creation/last-verification time, display expiry, safe financial presentation, and an explicit unverified/refreshing state. It must not carry submit authority merely because its display expiry has not elapsed.
- **Current-calculation snapshot:** verified financial output, authenticated identity scope, and complete normalized financial-input binding. The existing quote response can supply display/review values without inventing a server quote version.
- **Possible future reusable server quote:** server issue/expiry times and a server-owned quote identity or verifiable representation bound to relevant policy and source changes. Its storage/signature/version strategy is deferred; these fields are not prerequisites for P4 or P5.
- **Reviewed submission:** current user input and settlement legs, reviewed financial expectations, and one idempotency identity for the logical submit attempt. A client fingerprint or locally generated `requestId` cannot replace server verification. A server quote identity may be added only under a separately reviewed future reusable-quote contract.
- **Mismatch result:** machine-readable changed fields/reasons plus enough safe current financial data to refresh the same payment window and require another review. Its eventual wire shape, error code, and localization keys require explicit design and tests; they do not exist because they are described here.

Never return internal pricing records, secret credentials, raw SQL/provider errors, or unauthorized balance details. Do not accept a client-supplied quote hash as proof of server calculation. If a hash is used, the server independently computes and binds it to verified facts; a signature or stored record requires a separate threat model, expiry policy, and lifecycle decision.

## Identity and full financial input binding

Cache scope includes tenant, authenticated user, auth/cache session, branch, customer, and intended operation where create/edit calculation context differs. All consumers must use the same normalized request model. Include ordered item inputs, quantity, override price, service and packing charges, express mode, manual discounts, categories, ordered preferences and their amounts/IDs, ordered tax selection, promo, and gift identity/requested amount. New financial inputs must participate by construction.

Canonicalization may sort object property names, but it must preserve meaningful array order. Tax selection/order and compound-tax application are not commutative. A mere equal sale total does not prove equal financial meaning: different items, taxes, discounts, or eligibility can produce the same amount.

Never round, clamp, or coerce entered money to make a cache key match. Normalize absent/empty values only as allowed by the server schema. Tokens, PINs, auth cookies, CSRF credentials, and other secrets must never enter keys, persisted DTOs, analytics, or logs. Raw gift-card numbers and full financial request keys must not be persisted or logged; use opaque, non-authorizing identity metadata where needed.

The proposed cache is memory-only in the active client context. No localStorage, IndexedDB, persisted query cache, service-worker cache, CDN, or public HTTP cache is authorized by this contract. Clear client financial display/cache data on logout and auth, tenant, or cashier change. Do not reuse a balance-bearing response from another permission context.

## Time and external mutation

A matching cart fingerprint alone does not establish freshness. Relevant facts can change without any edit in this browser: prices, price-list assignments, time windows, tax profiles or exemptions, currency precision/rounding, promo start/end/usage, gift validity/balance, credit limits/current debt, wallet/advance/credit-note balances, loyalty expiry, method eligibility, and operational sessions.

Use server time for future quote issue/expiry rules. An effective validity budget must not extend beyond known time-sensitive boundaries. Client clock changes must not extend financial authority. Where a source does not expose a reliable version or next-boundary time, do not claim version-aware reuse; require recalculation according to the implemented contract. Source-version fields must not be populated with made-up constants to manufacture a freshness guarantee.

Invalidation after successful local writes is required but incomplete: other tabs, devices, administrators, or processes can change data. Bound display freshness and retain server write validation regardless of whether optional events exist. A stale or failed refresh can retain visible context with an explicit status, but cannot preserve submit permission.

## Proposed submit boundary

For every relevant create/edit entry point, the future server flow must:

1. Resolve current authentication, permissions, tenant context, input validity, and allowed overrides.
2. Recalculate current financial facts using the authoritative service path and validate requested balances, credit rules, method requirements, terminal/drawer/POS state, and gift/promo constraints.
3. Compare the reviewed financial expectations with current server facts according to an explicit financial comparison policy. The client can report what was reviewed; it cannot determine what is financially valid. Compare meaningful breakdown and eligibility, not sale total alone. Apply established currency precision; do not introduce arbitrary tolerances that hide changes.
4. If materially changed, return a structured non-posting mismatch. Refresh in place, preserve entered money/legs for explicit correction, invalidate old review, and require new confirmation.
5. If valid, execute the existing protected transactional submission steps with their audit, ledger, idempotency and failure-recovery invariants. Do not imply that the entire multi-stage orchestrator is one database transaction or introduce a broader transaction refactor in this performance increment. Revalidate facts that can race at each relevant transaction boundary; a pre-transaction calculation alone cannot prevent concurrent balance consumption.
6. Protect retry with a tenant-scoped idempotency identity and request fingerprint. Replays of the same logical request return the established outcome; reusing a key for different inputs fails explicitly. A new post-mismatch logical attempt needs clearly defined identity handling. Cover in-flight duplicates and lost-response retry, not only double-click prevention.

This end-to-end reviewed-expectation/idempotency/mismatch contract is **not asserted to exist across current flows**. Audit existing create/edit guards and storage before designing changes; reuse them where correct instead of adding a parallel duplicate mechanism. Any required migration is a separately reviewed forward draft, never automatically applied. P4 must not create quote-version storage merely to compare reviewed amounts with a fresh calculation.

## Operational and presentation invariants

Operational state is separately scoped and can become invalid before settlement. A warmed drawer/POS response is a convenience, not authorization. Optional notification events can invalidate it earlier; only current server checks determine whether a method may write.

Refresh must never silently mutate entered money, swap payment methods, change currency labels/precision under typed values, clear entered legs, or auto-accept a mismatch. A currency-rule change requires the established safe recovery/reopen path and clear explanation. For every error state, provide appropriate localized Retry/Cancel/session/configuration recovery while keeping invalid money entry closed.

## Required contract tests

- Identical semantic objects share identity; every financially relevant input change differs; ordered tax changes remain significant.
- Edit then revert cannot revive an earlier confirmation. Late replies, close/reopen, and cancellation never adopt the wrong revision/session.
- Logout, tenant/cashier/permission changes clear or isolate entries; denied balance details never become zero or leak through reuse.
- Price/tax/promo/time/balance changes without cart edits cause correct expiry, mismatch, or write rejection.
- Required operational sessions closing or relinking after warm reads are rejected at the write boundary.
- Inclusive/exclusive/compound tax, promo/gift/credit, rounding, overpayment and change retain established calculation results.
- Concurrent duplicate submissions and ambiguous network outcomes satisfy the defined idempotency behavior.
- Failure states preserve entered values, invalidate confirmation, and require deliberate review with English/Arabic and RTL support.

No speedup, correctness completion, security certification, or runtime pass is implied until these implementation and validation gates produce captured evidence.
