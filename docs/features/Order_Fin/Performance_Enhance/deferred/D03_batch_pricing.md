# D03 — Bulk authoritative product pricing

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). No bulk pricing function or migration is created by this document.

## Motivation and current evidence

[PricingService](../../../../../web-admin/lib/services/pricing.service.ts) already deduplicates complete line lookup inputs and bounds scalar RPC concurrency at six. Distinct lines still invoke `get_product_price` individually, so large carts can benefit from one bounded bulk request.

The scalar function source in [migration 0014](../../../../../supabase/migrations/0014_catalog_pricing_tables.sql) already falls back to product defaults inside SQL. The application product query is an exceptional fallback, not an unconditional second query for every line. The scalar selection orders by price-list priority descending and minimum quantity descending; its internal `v_price NUMERIC(10,3)` variable imposes three-decimal rounding before the result reaches the application.

Read-only local `pg_proc` inspection on 2026-10-24 confirmed `get_product_price(uuid, uuid, character varying, integer, date)`, catalog return type `numeric`, internal `v_price NUMERIC(10,3)`, priority/minimum-quantity ordering, product-default fallback, and `security_definer = false`. The parent price-list join had no visible `pl.tenant_org_id` predicate, while the item predicate was explicit. This is **local definition evidence**, not a measured value-parity test, production deployment evidence, or a query plan. Re-capture the live definition, signature, and effective grants before implementation; no DDL was executed and no bulk function has been applied.

## Why outside the initial scope

A bulk function requires a new database contract and migration. Pricing is shared financial authority, so changed tie-breaking, decimal precision, fallback, or ordering can change money. Those decisions must be explicit rather than incidental to a performance rewrite.

## Entry criteria

- Measurements show distinct-line scalar round trips materially affect representative cart sizes.
- Capture live local and target-environment scalar definitions, grants, dependencies, and representative pricing fixtures.
- Agree on numeric precision and deterministic tie behavior before coding; document whether each decision preserves or deliberately changes current behavior.
- Confirm price-list/customer precedence and effective-date semantics with the existing submit and quote consumers.

## Proposed design and tasks

1. Define a bounded bulk request with a stable line identifier/ordinal, product, quantity, price-list type, effective date, and authenticated tenant scope. Keep duplicate lines distinguishable and return results in original line order.
2. Resolve customer pricing tier once using the existing precedence: standard/express, customer B2B/VIP type, then supported preferences override. Preserve express/default fallback semantics exactly until a separately approved change.
3. Implement set-based or bounded lateral selection over tenant-scoped products and price lists. Explicitly constrain **every** joined `org_*` table, including the parent price-list table; do not rely on RLS or a prior product check alone.
4. Preserve active/effective-date filters, quantity tiers, priority, percentage discounts, zero price, missing product, and strict infrastructure failures. Return sufficient error/source metadata without exposing unrelated products or prices.
5. **Precision decision:** the scalar's internal variable imposes `NUMERIC(10,3)` while persisted catalog amounts use `DECIMAL(19,4)`; PostgreSQL reports the function return as `numeric`. Decide whether bulk must reproduce the scalar result before currency rounding or whether a financial correction is separately authorized. Do not silently widen precision and call it parity.
6. **Tie decision:** equal list priority and quantity tier do not currently define a complete winner order. Inventory collisions read-only and report them. Agree a deterministic business tie-breaker; do not silently pick a winner in the implementation.
7. Add an adapter in PricingService so current callers keep their public contract. Preserve full-key deduplication and final tenant-currency rounding; reject partial/malformed bulk results instead of fabricating zero prices.
8. Inspect plans and payload/query limits for small, large, and repeated-product carts. Count database operations and work, not only HTTP/RPC calls; a one-RPC wrapper around the scalar loop is not proof of set-based efficiency.

## Ownership and invariants

- **Tenant app/repository:** pricing orchestration, financial parity fixtures, and migration ownership. **HQ:** coordinate any shared catalog/pricing-policy contract actually affected; no speculative HQ API is introduced.
- Create a **new** reviewed migration only after approval. Never modify migration 0014 or another applied file. The user applies migrations; agents must not run them.
- Keep authenticated tenant ownership, explicit predicates, RLS, input limits, safe grants, and invoker/definer behavior under review.
- Preserve server-authoritative recalculation on submit. Cached/bulk quote data never authorizes stale prices or bypasses price-override permission/reason rules.
- Cross-request pricing cache is outside this document unless a separately reviewed invalidation/version contract exists.

## Required tests

- Scalar-versus-bulk parity for standard, express, B2B, VIP, preference override, default fallback, zero, missing/inactive products, and unavailable database reads.
- Quantity boundaries, overlapping tiers/lists, equal-priority collisions, date boundaries, percentage discounts, and three/four-decimal examples.
- Duplicate input lines, stable ordering, large carts, bounded payloads, malformed output, and partial failure.
- Cross-tenant product/list attempts, explicit join scoping, grants, unauthorized access, and price-override policy.
- End-to-end quote/submit financial parity for inclusive/exclusive tax, promos, gift cards, rounding, and change due.

## Rollout and rollback

Start with shadow scalar/bulk comparison on controlled representative requests. Enable bulk reads for an approved cohort after parity and plans pass. Monitor mismatch, errors, latency distributions, and database load. Retain scalar fallback selection for rollback, but do not silently fall back after an integrity/tenant/partial-result error. Keep the new function additive until all consumers are stable; rollback schema through reviewed forward migrations when needed.

## Completion evidence

Required: captured live definitions; approved precision/tie decisions; collision report; parity fixture results; query plans and load measurements; security review; new migration review plus user application record; regenerated types if needed; application build/checks and rollback rehearsal. None of these constitute completed bulk implementation today.
