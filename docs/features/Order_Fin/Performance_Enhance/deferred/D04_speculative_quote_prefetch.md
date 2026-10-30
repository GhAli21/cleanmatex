# D04 — Speculative quote prefetch

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). This concerns automatic preparation before the cashier requests the payment modal.

## Motivation and current evidence

Prefetch on a valid cart, Submit focus, or hover could overlap network/server work with cashier activity. [use-payment-quote](../../../../../web-admin/src/features/orders/hooks/use-payment-quote.ts) and the [quote API client](../../../../../web-admin/src/features/orders/api/payment-quote-api.ts) already coordinate input identity, cancellation, and strict response acceptance for requested quotes.

The current endpoint is not guaranteed to be a purely observational read. [Stored-value summary](../../../../../web-admin/lib/services/order-credit-application.service.ts) calls `syncAvailableLoyaltyPoints`, which can maintain expired loyalty lots through [loyalty.service.ts](../../../../../web-admin/lib/services/loyalty.service.ts). Aborting a browser request also does not prove already-running server/database work was cancelled. Automatic cart-change requests would increase that work even when the modal is never opened.

## Why outside the initial scope

The initial work must preserve cashier intent and financial semantics. Prefetch is safe to consider only after the preparation path is reviewed and split into a genuinely pure read operation where required. Repeated hover/focus/cart events must not become a hidden maintenance or load generator.

## Entry criteria

- Review every quote dependency for writes, expiry maintenance, external effects, rate limits, and sensitive response handling.
- Design and approve a pure-read preparation path, or explicitly separate maintenance so speculative work cannot trigger it.
- Define quote identity, freshness, eligibility, and final-submit validation independently of browser cache retention.
- Measure expected prefetch hit rate, waste, cancellation behavior, and backend capacity for real cashier activity.

## Proposed design and tasks

1. Separate pure fact loading/evaluation from loyalty maintenance and any other discovered effects. Do not bypass expiry rules to achieve a read-only implementation; derive spendable availability correctly and revalidate during settlement.
2. Reuse the exact requested-quote query function and canonical input serialization. Scope by authenticated tenant, user/session, branch, customer, complete cart, discounts, promo/gift selections, tax choices, preferences, and applicable version identifiers.
3. Prefetch only when required context/cart data is valid and stable. Debounce cart changes; coalesce identical in-flight requests; bound simultaneous work.
4. Consider intent-triggered focus/hover before continuous cart prefetch, based on measured usefulness and accessibility. Touch users must receive the same functional behavior without hover.
5. Propagate AbortSignal and maintain response identity checks. Abort is a client resource optimization, not proof of server-side cancellation.
6. Reuse successful data only under a reviewed freshness policy. Displaying cached numbers must not imply present payment eligibility; revalidate dynamic balance, promo, method, credit, and session facts before allowing protected actions.
7. Clear protected query data on logout/session or tenant change; invalidate affected entries on cart/context changes and after settlement. Prevent sensitive query data from being persisted unintentionally.
8. Instrument useful hits, wasted fetches, server work, and click-to-ready separately. No fixed latency gain is assumed.

## Ownership and invariants

- **Tenant app:** owns quote preparation, New/Edit Order consumers, TanStack Query scope, accessible triggers, EN/AR/RTL pending feedback, and final submit behavior.
- **HQ:** involved only where authoritative policy/version/invalidation contracts require it. Do not read system settings directly to construct speculative keys.
- **Money:** preserve user-entered amounts, no hidden gift consumption/reservation, no invented balance, and no submit using an outdated authority snapshot.
- **Security:** existing auth, CSRF, session, tenant validation, price-override permission, and balance visibility checks remain in force for prefetch.
- No new migration, feature flag, permission, or endpoint is assumed. Any later addition follows its own repository rules and approval.

## Required tests

- Prove speculative preparation has no financial/loyalty maintenance writes before enabling automatic prefetch.
- Rapid cart edits, edit/revert, branch/customer/session changes, hover/focus storms, close/reopen, abort, timeout, and out-of-order completion.
- Expired promo/gift/loyalty/credit/method configuration between prefetch, opening, confirmation, and final submit.
- Disabled prefetch, network/provider failures, browser back/forward, mobile/touch, keyboard use, EN/AR/RTL, and no duplicate opening fetch when reuse is valid.
- Cache isolation, logout cleanup, permission-restricted balances, bounded traffic, and accurate timing measurements.

## Rollout and rollback

Begin disabled and collect baseline interaction timings. After pure-read review, enable intent-prefetch for a controlled cohort and compare load as well as user delay. Disable triggers to roll back; the explicit opening path must remain correct and usable. Automatic rollback is not claimed unless implemented, configured, and rehearsed.

## Completion evidence

Required: effect audit and pure-read approval; identity/freshness contract; tests covering obsolete responses and dynamic money; measured useful/wasted work; production-like timing distributions; rollout control and rollback rehearsal. Prefetch remains deferred until those records exist.
