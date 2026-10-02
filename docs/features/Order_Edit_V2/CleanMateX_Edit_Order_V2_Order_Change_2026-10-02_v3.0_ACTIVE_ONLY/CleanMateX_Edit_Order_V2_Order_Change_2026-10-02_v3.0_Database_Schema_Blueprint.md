# CleanMateX Edit Order V2 — Database Schema Blueprint

**Version:** 3.0  
**Status:** Normative blueprint; migration SQL must re-check the live target catalog immediately before authoring/applying.

**Current reconciliation:** 2026-10-02, read-only local and hosted `ndjjycdgtponhosvztdg` catalog inspection. This blueprint describes proposed work, not applied migrations. The living implementation plan remains the sole WP authority.

## 0. Verified current catalog and reuse boundary

Both targets report PostgreSQL 17.6, 546 recorded migrations and latest numeric migration `0540`. Six older timestamp migration IDs also exist; a lexicographic maximum is not the next numeric sequence. Re-list root migration files and target metadata immediately before authoring; no migration number is reserved by this review.

Both targets lack the proposed commitment, commercial revision, edit-access and `service_speed` columns and both Change tables. Stable item/piece/preference UUIDs, `rec_status`, workflow `state_version` (INTEGER), workflow profile bindings, financial snapshot/amounts, order currency/FX fields, `org_idempotency_keys` and `org_domain_events_outbox` already exist. Reuse them; do not create another workflow counter, settlement ledger, outbox or replay table.

Verified existing domain tables include:

| Domain | Existing exact objects to reuse |
|---|---|
| Commercial structure/history | `org_orders_mst`, `org_order_items_dtl`, `org_order_item_pieces_dtl`, `org_order_preferences_dtl`, `org_order_edit_history`, `org_order_edit_locks`, `org_order_history`, `org_order_status_history`, `org_order_piece_hist_tr` |
| Commercial monetary facts | `org_order_discounts_dtl`, `org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_adjustments_dtl` |
| Settlement/refund | `org_order_payments_dtl`, `org_order_credit_apps_dtl`, `org_order_refunds_dtl`, `org_fin_vouchers_mst`, `org_fin_voucher_trx_lines_dtl`, `org_fin_voucher_audit_log` |
| Stored value | `org_customer_wallets_mst`, `org_wallet_txn_dtl`, `org_gift_cards_mst`, `org_gift_card_txn_dtl`, `org_credit_notes_mst`, `org_credit_note_txn_dtl` |
| AR | `org_invoice_mst`, `org_invoice_lines_dtl`, `org_invoice_orders_dtl`, `org_invoice_payments_dtl`, `org_invoice_adjustments_dtl`, `org_invoice_status_history_dtl`, `org_customer_ar_ledger_dtl`, `org_ar_credit_allocs_dtl`, `org_ar_disputes_mst` |
| Fiscal | `org_tax_documents_mst`, `org_tax_doc_lines_dtl`, `org_tax_doc_seq_counters`, `org_tax_doc_triggers_cfg` |
| Cash control | `org_cash_drawers_mst`, `org_cash_drawer_sessions_mst`, `org_cash_drawer_trx_mst`, `org_cash_drawer_trx_dtl`, `org_cash_drawer_movements_dtl`, `org_fin_cash_ctrl_stng_cf` |
| Replay/events/workflow | `org_idempotency_keys`, `org_domain_events_outbox`, `org_wf_gate_decision_mst`, `org_wf_profile_assign_cf`, existing `sys_wf_profile_ver_mst` and normalized `sys_wf_prof_ver_*` configuration |

RLS is enabled on the inspected tenant objects. That is catalog evidence, not proof of safe membership authorization or committed-write restrictions; the Security companion records the confirmed privilege/helper defects and required release gates.

Material local/hosted differences in the inspected structural catalog:

- local `org_order_items_dtl.created_by` is TEXT; hosted is VARCHAR; do not bundle an unrelated legacy type conversion;
- local preference parent-shape CHECK `chk_ord_pref_item_req` exists; hosted lacks it;
- order/item tenant-identity UNIQUE constraint names differ but tuple definitions agree. Detect equivalent definitions, not only object names, to avoid duplicate keys.

Existing item price/total fields are NUMERIC(10,3); piece/preference and current financial facts use NUMERIC(19,4). New Change monetary fields use 19,4. Preview/Apply must qualify persistence precision and currency rounding without silently converting all legacy prices. Item insert/update/delete triggers still call `fn_recalc_order_totals`; its installed body on both targets is disabled by `IF 1=2`. Application calculation/snapshot composition remains authoritative; do not assume the old SQL trigger rolls totals up.

Metadata checks did not read historical business rows, prove actor/timezone lineage, validate orphan-free data, execute RPCs, or exercise authenticated Data API/RLS/concurrency behavior. Those remain target-specific preflight/test gates.

## 1. `org_orders_mst` additions

| Column | Type | Null/default | Rule |
|---|---|---|---|
| `committed_at` | `TIMESTAMPTZ` | NULL | non-null = committed; irreversible in normal runtime |
| `committed_by` | `UUID` | NULL | server-derived actor; unknown legacy actor may remain NULL |
| `edit_state_version` | `INTEGER` | NOT NULL DEFAULT 0 | draft 0; initial commit 1; each successful Change +1 |
| `edit_access_status` | `TEXT` | NOT NULL DEFAULT `OPEN` | `OPEN`,`TEMPORARILY_BLOCKED`,`PERMANENTLY_BLOCKED` |
| `edit_block_reason_code` | `TEXT` | NULL | stable support/policy code |
| `edit_block_reason_text` | `TEXT` | NULL | operator-readable reason |
| `edit_blocked_at` | `TIMESTAMPTZ` | NULL | required when blocked |
| `edit_blocked_by` | `UUID` | NULL | server-derived actor |
| `edit_block_until` | `TIMESTAMPTZ` | NULL | temporary block only |
| `service_speed` | `TEXT` | NULL during compatibility | distinct from priority; initial supported tokens must be catalog/policy verified |

Retain physical `state_version` initially. V2 API exposes it as `wfStateVersion`. Do not create a second independently writable workflow counter.

Require consistency CHECKs after legacy classification: uncommitted implies commercial version 0; committed implies version at least 1. Restrict commitment reversal and ordinary permanent-block reopening at the command/database boundary; a CHECK alone cannot enforce an irreversible transition. Blocked states require a blocked timestamp, permanent blocks have no expiry, and any temporary expiry is later than blocked time. Actor columns follow verified authenticated actor identity. System/unknown historical actors remain explicitly nullable according to the backfill contract; never invent an actor.

## 2. New `org_order_changes_mst`

Recommended exact columns:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_org_id UUID NOT NULL,
order_id UUID NOT NULL,
change_no INTEGER NOT NULL,
edit_state_version_before INTEGER NOT NULL,
edit_state_version_after INTEGER NOT NULL,
wf_state_version_expected INTEGER NOT NULL,
source_context TEXT NOT NULL,
actor_user_id UUID NOT NULL,
actor_name TEXT NULL,
change_reason TEXT NULL,
currency_code TEXT NOT NULL,
financial_before JSONB NOT NULL,
financial_after JSONB NOT NULL,
commercial_delta NUMERIC(19,4) NOT NULL,
financial_outcome TEXT NOT NULL,
idempotency_key TEXT NOT NULL,
request_hash TEXT NOT NULL,
apply_response JSONB NOT NULL,
applied_at TIMESTAMPTZ NOT NULL,
metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
created_by TEXT NOT NULL,
created_info TEXT NULL,
updated_at TIMESTAMPTZ NULL,
updated_by TEXT NULL,
updated_info TEXT NULL,
rec_status SMALLINT NOT NULL DEFAULT 1,
rec_order INTEGER NULL,
rec_notes TEXT NULL,
is_active BOOLEAN NOT NULL DEFAULT true
```

Required checks/uniques:

- after version = before + 1;
- before >= 1;
- financial outcome in approved tokens;
- unique `(tenant_org_id,order_id,change_no)`;
- unique `(tenant_org_id,order_id,edit_state_version_after)`;
- unique `(tenant_org_id,idempotency_key)`;
- composite FK `(order_id,tenant_org_id)` to order;
- UNIQUE `(id,order_id,tenant_org_id)` for the operation aggregate FK and `(id,tenant_org_id)` for removal lineage;
- tenant FK to existing tenant; currency FK to `sys_currency_cd(code)`; no currency default;
- actor FK to `auth.users(id)` with RESTRICT, matching authenticated actor/legacy Edit identity; verify historical actors before constraint validation. Do not substitute tenant-membership row IDs.

Applied rows are append-only to ordinary runtime roles.

### Atomic insertion contract

Do not insert a visible pending Change or an incomplete master shell: `financial_before`, `financial_after`, `request_hash`, `apply_response` and applied metadata are required final values, and ordinary applied history is immutable. Preallocate the Change UUID, target UUIDs, sequence/revision and client-ID map under the parent/order locks. Make the **new removal-lineage FK only** DEFERRABLE INITIALLY DEFERRED, so canonical logical removals may reference that preallocated Change UUID within the same transaction before its master exists. Persist/recalculate coherent canonical facts, build the complete final financial summaries and replay response, insert the complete master once, then insert operation facts and transactional replay/outbox records. Validate projection/persisted equality before commit; deferred lineage references must resolve at commit. Any failure rolls everything back.

This is a creation-order contract, not permission to update an applied audit row, expose a durable pending Change, leave response JSON nullable or relax live parent hierarchy. The final response must be stored before commit. The new lineage constraints, Prisma/raw-SQL transaction path and real DB tests must prove this exact insertion/rollback behavior in WP02/WP11/WP12/WP18. Do not substitute a provisional JSON placeholder that could commit.

Deferral applies to the referencing-row existence check during that creation order; ON DELETE/UPDATE RESTRICT remains immediate protection of the referenced immutable Change. Keep the referenced `(id,tenant_org_id)` UNIQUE non-deferrable. PostgreSQL distinguishes deferrable FK checks from referential actions ([PostgreSQL 17 CREATE TABLE](https://www.postgresql.org/docs/17/sql-createtable.html)). Prove both the valid late-master insert and rejection/rollback when the master is missing in a dedicated DB fixture, including the ORM transaction path; this review executed no schema experiment.

## 3. New `org_order_change_ops_dtl`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_org_id UUID NOT NULL,
order_id UUID NOT NULL,
order_change_id UUID NOT NULL,
operation_seq INTEGER NOT NULL,
operation_code TEXT NOT NULL,
target_type TEXT NOT NULL,
order_item_id UUID NULL,
order_item_piece_id UUID NULL,
order_preference_id UUID NULL,
client_ref UUID NULL,
before_values JSONB NOT NULL DEFAULT '{}'::jsonb,
after_values JSONB NOT NULL DEFAULT '{}'::jsonb,
audit_summary TEXT NULL,
metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
created_by TEXT NOT NULL,
created_info TEXT NULL,
updated_at TIMESTAMPTZ NULL,
updated_by TEXT NULL,
updated_info TEXT NULL,
rec_status SMALLINT NOT NULL DEFAULT 1,
rec_order INTEGER NULL,
rec_notes TEXT NULL,
is_active BOOLEAN NOT NULL DEFAULT true
```

- positive sequence;
- unique `(tenant_org_id,order_change_id,operation_seq)`;
- scoped FK to master `(order_change_id,order_id,tenant_org_id)`;
- operation/target tokens and typed-target nullability match the frozen operation catalog and validated command schemas; do not infer supported operations from arbitrary text columns;
- historical typed item/piece/preference FKs use immutable `(id,tenant_org_id)` identity keys with RESTRICT; snapshots retain the original order and parent IDs. Do not tie immutable history to mutable live order/parent tuples: split is a separate workflow that can reparent surviving entities;
- Apply validates current order/item/piece/preference hierarchy under locks before recording historical references; live hierarchy FKs below enforce current structure;
- JSON is bounded audit data, not an alternative untyped command model.

## 4. Stable removal lineage

Reuse `rec_status=0` as inactive/removed; do not introduce a second `is_deleted` truth.

Add to committed item/piece/preference rows where absent:

```text
deleted_at TIMESTAMPTZ NULL
deleted_by UUID NULL
deleted_order_change_id UUID NULL
```

For new governed removals: `deleted_order_change_id != NULL` requires `rec_status=0`, `deleted_at`, and `deleted_by`.

Use FK `(deleted_order_change_id,tenant_org_id)` to Change `(id,tenant_org_id)` with RESTRICT and DEFERRABLE INITIALLY DEFERRED, following the atomic insertion contract above; `deleted_by` uses authenticated actor identity. The CHECK must explicitly require non-null `rec_status` as existing nullable columns otherwise allow an UNKNOWN result. Applied lineage never authorizes ordinary reactivation. Removing an item records logical removal of every eligible active descendant in the same Change; historical inactive rows retain their origin.

Legacy inactive rows may retain NULL lineage rather than fabricated history.

## 5. Hierarchy hardening

Preflight first, then add/validate scoped keys/FKs needed to prove:

- item belongs to the same tenant/order;
- piece belongs to same tenant/order/item;
- preference ITEM target belongs to same order/item;
- preference PIECE target belongs to same order/item/piece.

Do not silently delete or rewrite legacy orphan/cross-hierarchy data during preflight.

Reuse existing order UNIQUE `(id,tenant_org_id)` and item UNIQUE `(id,tenant_org_id)` / `(id,order_id,tenant_org_id)`. Piece and preference immutable tenant-identity UNIQUEs are absent on both inspected targets; add only verified missing tuples. Add piece `(id,order_item_id,order_id,tenant_org_id)` and preference `(id,order_id,tenant_org_id)` keys where needed for live parent FKs. Current piece/preference parent FKs are ID-only and do not prove tenant/order hierarchy. Preserve level-token CHECKs; add parent-shape consistency only where absent after target data preflight.

Retain piece UNIQUE `(tenant_org_id,order_id,order_item_id,piece_seq)`. Allocate beyond the maximum historical sequence under the order/parent lock, including inactive rows. Never renumber or reuse removed committed sequence values. Preserve preference ordering with the same principle. Split compatibility must be reviewed before SQL authoring: active hierarchy moves consistently under deterministic source/destination order locks; immutable Change history and inactive removal origin remain intact. Unsupported combinations stay denied until their owning workflow is safe.

Required new indexes cover master `(tenant_org_id,order_id,applied_at DESC)`, operation `(tenant_org_id,order_change_id,operation_seq)`, typed target history and removal-lineage lookups. Existing tuple UNIQUE indexes already cover their leading lookups; do not add equivalent indexes solely under different names. Evaluate active order/item/piece/preference reader predicates with representative EXPLAIN evidence before selecting additional partial indexes. Every new object name is at most 30 characters.

## 6. RLS and privileges

- Enable RLS on new Change tables.
- Authenticated read is tenant-scoped according to existing CleanMateX tenant membership/context patterns.
- Ordinary client direct INSERT/UPDATE/DELETE to Change tables is denied; server command path owns writes.
- Service-role/backend queries still include explicit tenant predicates.
- Audit direct Data API/RPC grants before pilot so a normal authenticated client cannot mutate committed commercial structure/money outside owned commands.

New objects inherit broad public-schema default ACLs in the inspected targets. Their migration must explicitly revoke unnecessary table/function privileges from PUBLIC, anon and authenticated, including non-row privileges, then grant only reviewed tenant-read/backend-command rights. A SELECT policy plus RLS does not remove inherited grants. Use the Security companion as the single detailed authority for membership/helper/RPC corrections.

## 7. Migration order

1. target catalog/preflight;
2. additive order columns;
3. Change tables + indexes/RLS;
4. removal lineage columns;
5. permission/feature/config seeds;
6. compatible application readers/writers;
7. historical commitment classification/backfill;
8. hierarchy FK validation after orphan report is clean/resolved;
9. V2 pilot enablement.

Never edit old migration files. Re-list the latest migration immediately before assigning the next filename.

## 8. Backfill rules

- `created_at` is not automatically commitment time.
- classify canonical submit, persisted draft/legacy, public/remote booking, Quick Drop and failed compensation independently;
- use only provable timestamp/actor lineage;
- unresolved historical rows remain V2-ineligible until resolved;
- baseline historical committed order starts commercial revision 1; first real V2 Change is 1→2 and `change_no=1`;
- do not synthesize typed operations from lossy legacy edit diffs.

## 9. Rollback

After an order has a V2 Change, rollback means **disable further V2 editing while preserving V2 data/history**, never route it back to full delete/recreate Edit. Additive schema remains. No destructive down migration, reset, CASCADE, uncommit, or payment-history rewrite.
