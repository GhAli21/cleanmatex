# CleanMateX Edit Order V2 — Database Schema Blueprint

**Version:** 3.0  
**Status:** Normative blueprint; migration SQL must re-check the live target catalog immediately before authoring/applying.

**Current reconciliation:** 2026-10-02, read-only local and hosted `ndjjycdgtponhosvztdg` catalog inspection after user/operator application.0547/0548 are installed on both targets; later gated hierarchy/backfill design remains proposed. The living implementation plan remains the sole WP authority.

## 0. Verified current catalog and reuse boundary

Before authoring, both targets at HEAD f33cff481c7a5d35fb16ad5a10983db2762c9818 reported PostgreSQL17.6/552 migrations/latest0546; files were re-listed before assigning0547/0548. After operator application, both histories report555 records/latest0549 (outside WP02). Six legacy timestamp IDs remain. Fresh catalogs match all75 introduced columns,41 constraints including14 NOT VALID,24 valid indexes,8 enabled guards,3 invoker functions and157 comments. [WP02 evidence](WP02_Foundation_Preparation_v3.0.md) section17 owns deployment/type-check details and remaining proof. Applied migration files are immutable.

Both targets contain the reviewed commitment/revision/access/service_speed and removal-lineage fields and both Change tables. Existing UUIDs/rec_status/workflow state_version/profiles/Finance/currency/idempotency/outbox remain reused. No duplicate workflow counter/ledger/outbox/replay table was introduced. Supabase types and the scoped Prisma schema/generated Client now include all75 WP02 additions; the report section18 records validation. ORM models do not replace SQL CHECKs, deferred timing, partial indexes, guards or authorization.

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

The compatible WP02 SQL adds these CHECKs as NOT VALID (future DML enforced immediately) because all new commitment/block columns begin NULL/OPEN and revision0. OPEN has no stale block metadata; blocked states require a nonempty reason code or text and blocked_at. New runtime blocks require a server-derived actor; nullable blocked_by preserves explicit unknown historical provenance rather than fabricating identity. Expired temporary blocks are evaluated by later policy; time passage never implicitly rewrites a status. UPDATE/DELETE guard protects recorded commitment timestamp/actor and permanent-block reopening. No producer runs here. `service_speed` accepts NULL or STANDARD/EXPRESS as storage candidates only, supported by existing normal/express pricing; no priority-based backfill, pricing activation or SAME_DAY is added.

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

### Persisted audit target versus command scope

`target_type` describes the affected persisted fact after applying intent; command scope in the Operation Catalog identifies the parent receiving an addition. These concepts are distinct. ADD_ITEM's ORDER command records ITEM plus its preallocated item UUID; ADD_PIECE's ITEM command records PIECE plus item/piece UUIDs; ADD_PREFERENCE's ORDER/ITEM/PIECE command records PREFERENCE plus its new preference UUID and original nullable parent identities. Removals and changes use the same affected fact identity.

| Persisted target | Operation codes | Typed identity shape |
|---|---|---|
| ITEM | ADD_ITEM, REMOVE_ITEM, CHANGE_ITEM_QUANTITY | item required; piece/preference NULL |
| PIECE | ADD_PIECE, REMOVE_PIECE | item and piece required; preference NULL |
| PREFERENCE | ADD_PREFERENCE, CHANGE_PREFERENCE, REMOVE_PREFERENCE | preference required; piece requires item; ORDER preference has both parent IDs NULL |
| ORDER | CHANGE_PRIORITY, CHANGE_SERVICE_SPEED, CHANGE_READY_BY, CHANGE_ORDER_NOTES, CHANGE_CUSTOMER_SNAPSHOT | all typed entity IDs NULL; order_id is the target |

The SQL CHECK freezes this audit shape without changing the 13 command codes or capability policy. WP04 validates public command scope/clientRef; WP12 validates current hierarchy and final snapshots under locks. `source_context` is nonblank TEXT rather than an invented exhaustive enum. Financial snapshots/final response must be nonempty JSON objects; SQL cannot prove their domain completeness, command permission or required operation coverage. Those are real service/DB integration gates. New monetary delta excludes numeric NaN. Applied master/ops stay rec_status1/is_active=true with no mutable updated_* evidence.

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

**WP02 compatibility gate:** current item Split changes item.order_id in separate statements without moving pieces/preferences. Piece Split clones items/decrements quantities and does not transfer persisted piece/preference rows. Adding all-row live-parent FKs, even NOT VALID, would reject existing future writes while V2 is disabled. Removed descendants retained at origin also conflict with moved live parents even after an atomic Split rewrite. Therefore0548 adds only missing piece/preference `(id,tenant_org_id)` historical-identity keys. It does not add unused four-/three-column live keys, global hierarchy FKs or preference parent-shape CHECKs. The owning workflow must resolve active-only hierarchy/origin enforcement and fail-closed V2 Split support before those constraints/removals can activate. See [Split review](WP02_Split_Compatibility_Review.md). This is a recorded unresolved production dependency, not removal of the live-hierarchy invariant.

### 5.1 Active hierarchy versus removal origin — WP02 disposition

The distinction is frozen; implementation and enabled-cohort proof remain later-package gates:

- **Always:** tenant/entity identity is retained independently of current parents. Change master/operation `order_id` is the originating commercial order. Historical target and removal-lineage FKs use `(id,tenant_org_id)` with RESTRICT, not a mutable live parent tuple.
- **Active structure:** only `rec_status=1` participates in the live hierarchy. An active piece must have an active item in the same tenant/order; an active ITEM/PIECE preference must have the corresponding active ancestors in the same tenant/order/parent tuple. ORDER preferences have no item/piece parent; ITEM has item only; PIECE has both. Unknown/unsupported lifecycle rows are not silently active or eligible.
- **Governed removed structure:** `rec_status=0` with V2 lineage is immutable. Its existing `order_id`, item/piece parent IDs, sequence and commercial values retain their removal-origin meaning; they are not rewritten when a surviving active parent later moves. The immutable operation snapshot records that original parent tuple. A removed row may retain the UUID identity of a now-reparented parent without claiming to belong to its current live hierarchy. New active descendants cannot be attached beneath removed parents. Legacy inactive rows without V2 lineage are separately classified; no origin is fabricated.
- **Enforcement direction:** do not install all-row parent-tuple FKs on mutable structure. A normal FK has no active-row predicate; a partial UNIQUE index does not make it conditional. Use a reviewed active-aware database guard/constraint strategy, together with current-hierarchy checks under Apply locks, for the enabled cohort. A deferred row constraint trigger is a possible mechanism, but its exact affected-parent coverage, final-state reads, privileges, locking/deadlock behavior and cost must be specified and proven before SQL authoring. Parent reparent/removal and child insert/update must all be covered; checking only the edited child misses surviving descendants. Existing tenant-identity references remain in force. PostgreSQL supports deferred constraint triggers, but their `WHEN` condition is evaluated when the row changes, so a future implementation must not mistake it for final-state validation. See [PostgreSQL17 FK syntax](https://www.postgresql.org/docs/17/sql-createtable.html) and [constraint-trigger semantics](https://www.postgresql.org/docs/17/sql-createtrigger.html).

WP06/WP07/WP12 own structure/preference projection and lock-time command validation; WP17 owns writer/Split bypass closure and any scoped database enforcement; WP18 owns real role/concurrency/rollback proof. Until that proof exists, the later server boundaries must deny unsupported V2-governed Split and split-derived/unclassified Change eligibility as specified in the [Split review](WP02_Split_Compatibility_Review.md#wp02-disposition-after-operator-installation-and-prisma-synchronization). No such runtime denial has been implemented in WP02. The foundation is sufficient for disabled WP03 commitment/readers once its other prerequisites pass; it is not permission to enable Apply, removals or Split support.

## 6. RLS and privileges

- Enable RLS on new Change tables.
- Initial foundation has no authenticated read policy/grant: membership integrity is unproven. Server-owned history reads require explicit authenticated tenant/permission enforcement later; direct tenant read policy remains gated.
- Ordinary client direct INSERT/UPDATE/DELETE to Change tables is denied; server command path owns writes.
- Service-role/backend queries still include explicit tenant predicates.
- Audit direct Data API/RPC grants before pilot so a normal authenticated client cannot mutate committed commercial structure/money outside owned commands.

New objects inherit broad public-schema default ACLs in the inspected targets. Their migration must explicitly revoke unnecessary table/function privileges from PUBLIC, anon and authenticated, including non-row privileges, then grant only reviewed tenant-read/backend-command rights. A SELECT policy plus RLS does not remove inherited grants. Use the Security companion as the single detailed authority for membership/helper/RPC corrections.

0548 explicitly sets owner postgres, enables RLS with zero ordinary-role policies, revokes ALL from PUBLIC/anon/authenticated/service_role and grants only service_role SELECT/INSERT. Immutable row UPDATE/DELETE and statement TRUNCATE guards also constrain normal owner/BYPASSRLS commands. New trigger functions are SECURITY INVOKER, fixed pg_catalog search_path, no org queries and no direct ordinary EXECUTE grant. DBA schema/trigger administration remains a separate audited boundary. See [tenant preflight](WP02_Tenant_Security_Preflight.md) for default ACLs, observed Prisma role and unresolved membership/RPC dependencies.

## 7. Migration order

1. target catalog/preflight;
2. additive order columns;
3. verified missing immutable identity keys, complete Change tables/indexes, removal lineage and explicit default-deny ACLs/immutability in0548;
4. operator review only; no agent application;
5. later tenant-bounded historical classification, active-only hierarchy/Split design, backfill and explicit constraint validation after proof;
6. compatible application readers/writers in WP03 and later packages;
7. permission/feature/config seeds in WP05, not WP02;
8. real role/FK/deferred insertion/rollback proofs, writer closure and deployment reconciliation;
9. V2 pilot only after owning release gates pass.

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
