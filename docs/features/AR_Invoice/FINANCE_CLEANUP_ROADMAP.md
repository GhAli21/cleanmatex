# AR Invoice — Broader Finance Cleanup Roadmap

**Purpose:** Post-AR roadmap for finance architecture cleanup beyond the completed AR delivery  
**Last Updated:** 2026-05-22

## Why This Exists

AR is now complete and production-ready, but some older finance and invoice-related paths still exist outside the canonical AR stack.

These are not blockers for release, but they are important long-term cleanup items because they can:

- create duplicated business logic
- drift from canonical ledger behavior
- confuse future implementation work
- increase regression risk in payments and voucher flows

## Guiding Principle

All receivable-impacting behavior should converge on canonical finance artifacts:

- AR invoice service
- AR ledger
- AR allocation/reversal helpers
- approval-aware adjustment flows
- explicit access contracts and permission inventory

## Cleanup Scope

### Track 1. Legacy invoice path retirement

Goal:

- stop future work from extending older invoice behavior outside canonical AR

Actions:

1. Identify remaining call sites that still prefer older invoice service patterns.
2. Convert them to thin adapters over canonical AR services where feasible.
3. Mark older invoice-specific helpers as deprecated in code comments or docs.
4. Remove dead invoice paths once usage is fully migrated.

### Track 2. Payment mutation consolidation

Goal:

- ensure invoice balance changes always route through canonical AR allocation behavior

Actions:

1. Audit payment-related direct mutations to invoice header fields.
2. Replace remaining direct balance/status updates with canonical allocation/reversal helpers.
3. Standardize payment reversal behavior so refunds/cancels always restore AR consistently.

### Track 3. Voucher and AR wiring alignment

Goal:

- keep Business Voucher as canonical money movement while making AR effects fully inspectable

Actions:

1. Expand linked-effects visibility between vouchers and AR artifacts.
2. Tighten posting previews so AR-linked effects are consistently shown before posting.
3. Standardize voucher-to-order-to-invoice tracing for support/debugging.

### Track 4. Report source unification

Goal:

- prevent multiple financial truth sources

Actions:

1. Verify finance reports that expose invoice/payment balances are reading canonical sources.
2. Remove or isolate legacy reporting queries that compute AR-like balances independently.
3. Align reporting labels and filters with canonical uppercase AR statuses.

### Track 5. Operational observability cleanup

Goal:

- make finance incidents diagnosable without DB forensics

Actions:

1. Expand structured logging around allocation, reversal, dispute, and dunning actions.
2. Standardize support-facing references between invoice, voucher, payment, and ledger entries.
3. Add exception dashboards or triage views if issue volume justifies them.

## Recommended Sequencing

### Phase A. Safe consolidation

- legacy invoice service audit
- payment mutation audit
- route/entrypoint ownership map

### Phase B. Canonical behavior enforcement

- replace remaining direct invoice mutations
- centralize reversal patterns
- improve linked-effects visibility

### Phase C. Reporting and support hardening

- reconcile report sources
- tighten logs and troubleshooting references
- publish support runbooks for finance exceptions

## Priority Items

Highest-value next cleanup items:

1. Complete audit of non-canonical invoice mutations in payment and voucher-adjacent services.
2. Standardize all invoice balance changes on AR allocation/reversal helpers.
3. Make support/debug views expose linked voucher/payment/ledger/invoice facts consistently.

## What Not To Do

- do not reintroduce lowercase or alternate AR status strings
- do not build new finance features on legacy invoice mutation paths
- do not create a second AR balance engine for reports
- do not bypass canonical audit/history paths for “quick fixes”

## Exit Criteria

This cleanup track is considered complete when:

- no active finance workflow mutates AR exposure outside canonical helpers
- legacy invoice paths are clearly deprecated or removed
- support can trace money movement from voucher/payment to invoice and ledger without ambiguity
- finance-facing reports use canonical AR truth sources
