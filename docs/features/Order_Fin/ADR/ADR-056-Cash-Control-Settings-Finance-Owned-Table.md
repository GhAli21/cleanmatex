# ADR-056: Cash-Control Settings Live in a Finance-Owned Table

- Status: Accepted
- Date: 2026-09-23
- Owners: Order Fin / POS
- Related:
  - `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md` (§3.1)
  - `docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/STATUS.md` (D3, D4, D17)
  - `docs/dev/rules/integration-contracts.md`
  - `docs/features/Order_Fin/ADR/ADR-054-User-Owned-POS-Sessions.md`

## Context

The POS Session & Cash Drawer Hardening program introduces 19 tenant-configurable
cash-control settings (blind close, variance gating and thresholds, cash-change
rounding bearer, count modes, drawer custody, POS session lifecycle). Per
`integration-contracts.md`, tenant settings are owned by `cleanmatexsaas` (HQ) and
live in the general `sys_tenant_settings_cd` / `org_tenant_settings_cf` catalog,
resolved through `fn_stng_resolve_all_settings`.

Two constraints make the general catalog a poor fit for these specific settings
today:

1. **Type safety on financial policy.** The general catalog is a `stng_code` /
   `stng_value` key-value store — every value is effectively untyped until parsed
   at read time. A mistyped `variance_gate_mode` or an out-of-range threshold is a
   money bug, and the general catalog cannot enforce it with a DB `CHECK`.
2. **HQ round-trip latency.** Folding into the general catalog means these
   settings become HQ's to add/change, and the tenant app would need an HQ API
   round-trip to resolve them on every gated cash operation — an availability and
   latency dependency HQ's own settings resolver was not designed to carry at
   POS-transaction frequency.

## Decision

### 1. Dedicated table, not the general settings catalog

Cash-control settings live in `org_fin_cash_ctrl_stng_cf` (migration `0515`), a
tenant-owned, RLS-protected table with **one real column per setting** rather than
generic code/value rows (D4). Every column is nullable; `NULL` means "not set at
this scope, inherit." The set is small (19), closed for the life of this program,
and financial — the cost of an `ALTER TABLE` per new setting is accepted in
exchange for DB-enforced `CHECK` constraints on every enum and threshold.

### 2. Exactly one read path

All resolution goes through a single exported function,
`getCashControlSettings(scope)`, in `lib/services/cash-control-settings.service.ts`.
No call site reads the table directly, and no second `getSetting(code)` escape
hatch is added. Resolution order is declared once, privately, in that service:
`DRAWER → USER → BRANCH → TENANT → TypeScript default`
(`lib/constants/cash-control.ts`).

### 3. Exactly one write path

All writes go through `updateCashControlSettings(scope, patch, actor)` in the same
service. It is transactional, gated on `cash_control:manage`, and every change to
`variance_gate_mode` or `blind_close_enabled` (or any other field) is audited —
see the dedicated audit table decision below.

### 4. This is a scoped, recorded deviation from `integration-contracts.md`

`integration-contracts.md` assigns tenant-settings ownership to `cleanmatexsaas`.
This ADR records a deliberate, narrow exception: cash-control settings only,
editable through a tenant-side admin screen
(`/dashboard/settings/payments/cash-control-settings`, gated by
`cash_control:manage`) in **this** repo. HQ-console editing of these settings is
out of scope until the exit criteria below are met. This is not a precedent for
moving other settings domains out of the general catalog.

### 5. Cash-control audit is its own table, not the general settings audit log

Settings-change audit (`0516`, `org_fin_cash_ctrl_audit_dtl`) is a **dedicated**
table, not a reuse of the general `org_stng_audit_log_tr`. That table's RLS policy
is SELECT-only (it is populated by a DB trigger tied to `sys_tenant_settings_cd` /
`org_tenant_settings_cf`, never written to by application code), and its
`stng_audit_scope` vocabulary (`SYSTEM|PROFILE|TENANT|BRANCH|USER`) has no
`DRAWER` level. Reusing it would also recouple cash-control settings back into the
general settings audit system that point 1 above deliberately keeps separate.
Recorded as decision D17 in `STATUS.md`.

## Consequences

### Positive

- Every cash-control value is DB-typed and DB-validated; an invalid threshold or
  gate mode cannot reach the database, let alone a cashier's screen.
- Reading settings never depends on HQ availability — a cash close can never be
  blocked by an HQ API outage.
- The single-resolver design (point 2) confines the coupling to one private
  function (`loadOverrides`); nothing outside that function knows the storage is
  a dedicated table rather than the general catalog.

### Tradeoffs

- Not visible in the HQ settings console and not returned by
  `fn_stng_resolve_all_settings` — this program must build and maintain its own
  admin screen (W0-5).
- Adding a 20th setting costs a migration, not a row insert.
- Two audit tables now exist in the settings domain (`org_stng_audit_log_tr` for
  the general catalog, `org_fin_cash_ctrl_audit_dtl` for cash-control) rather than
  one. Accepted: the alternative was writing into a table this domain has no
  INSERT access to.

## Exit criteria — folding into `sys_tenant_settings_cd` later

This design is explicitly swappable, not permanent:

- The unpivot from 19 typed columns to N `stng_code`/`stng_value` rows is a
  one-time backfill script; it does not touch the resolver's public contract
  (`getCashControlSettings` / `updateCashControlSettings` signatures are
  unchanged — only the private `loadOverrides` implementation changes to call
  `fn_stng_resolve_all_settings` instead of querying
  `org_fin_cash_ctrl_stng_cf`).
- Revisit when either (a) HQ's settings resolver gains a caching/availability
  guarantee suitable for POS-transaction-frequency reads, or (b) HQ needs to edit
  these settings from the HQ console for a support/compliance reason.
- Until then, `org_fin_cash_ctrl_stng_cf` and `org_fin_cash_ctrl_audit_dtl` are the
  system of record and this ADR is the reference for why they exist outside the
  general catalog.
