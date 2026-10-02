# WP02 Foundation Preparation — Edit Order V2 v3.0

**Date:** 2026-10-02, Asia/Muscat. **Status: DONE.**

WP02 foundation evidence and migration review only. The living plan remains the sole sequence/progress authority. WP01.1–.4 DONE/WP01.5 PARTIAL preserved; WP03–WP20 NOT STARTED. Operator-applied0547/0548 are verified on both targets (section17). User-authorized scoped Prisma schema/client synchronization is complete (section18), alongside Supabase types. Sections19–20 close the WP02 data-preflight, Split-disposition and disposable PostgreSQL structural-fixture evidence. The agent applied no migrations or business-data writes; no runtime producer/service/UI/Finance/workflow/permission/flag behavior was implemented.

## 1. Repository baseline

Before new SQL was authored, the requested commands returned:

```text
git branch --show-current  => main
git rev-parse HEAD         => f33cff481c7a5d35fb16ad5a10983db2762c9818
git status --short         => empty (clean)
```

This supersedes the earlier review/preparation baseline a5fc878f4db53d83f3002e76036c3e613a28bc86. Fresh source/catalog inspections and scoped documentation edits followed. The current canonical Create now posts a cash-rounding voucher inside its existing transaction; this adds settlement evidence, not a commitment timestamp. Source matrix has exact current line anchors. No WP01 tests were restarted or completion inferred from old text.

During execution unrelated POS-session/i18n/Storybook working-tree edits appeared. They were preserved and excluded from this package's validation/ownership. Existing document line-ending conventions were preserved; the whitespace check accounts for CRLF.

## 2. Pre-application local and hosted schema baseline

Read-only metadata SELECTs succeeded through both Supabase MCPs. No tenant was selected for historical business-data inspection, so this report claims catalog verification only, not historical cohort counts or actor compatibility.

| Evidence | Local | Hosted ndjjycdgtponhosvztdg |
|---|---|---|
| Environment | 127.0.0.1:54321, PostgreSQL17.6 x86 | ndjjycdgtponhosvztdg.supabase.co, PostgreSQL17.6 aarch64 |
| Metadata session | postgres database / postgres role | postgres database / postgres role |
| Migration history | 552 records; numeric latest0546; six legacy timestamp IDs | same recorded count/latest |
| Ten proposed order columns | all absent | all absent |
| Nine structural removal columns | all absent | all absent |
| Two Change tables | absent | absent |
| Preference parent-shape CHECK | chk_ord_pref_item_req present | absent |
| Item created_by | TEXT | VARCHAR |
| Order/item UNIQUE names | differ from hosted | equivalent tuple definitions, different names |

Root migration files matched552 before authoring, including six legacy timestamp files. The numeric sequence was re-listed immediately before choosing0547 and0548; no0541 assumption was used. Existing Prisma schema was inspected and left unchanged because SQL is not deployed. Target history does not prove every migration body/catalog object is identical: the differences above remain explicit. This package does not repair unrelated drift.

## 3. Exact proposed schema and compatibility

Authoritative column definitions are the [Database Blueprint](CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Database_Schema_Blueprint.md) and the two reviewed SQL sources listed in section13.

- Order: committed_at TIMESTAMPTZ NULL; committed_by UUID NULL; edit_state_version INTEGER NOT NULL DEFAULT0; edit_access_status TEXT NOT NULL DEFAULT OPEN; nullable TEXT edit_block_reason_code/text; nullable TIMESTAMPTZ edit_blocked_at/until; nullable UUID edit_blocked_by; nullable TEXT service_speed. Commitment NULL requires revision0/no committed actor; non-NULL requires revision≥1. OPEN clears block metadata; blocked states need blocked_at and a nonempty reason; permanent blocks have no expiry; temporary expiry, if present, exceeds blocked_at. Unknown historical actors may remain NULL; new runtime commands must derive authenticated actors. Guards prevent recorded commitment timestamp/actor rewrite, committed order deletion, and permanent reopening. No producer/backfill is implemented.
- Master: org_order_changes_mst has the complete frozen Blueprint column set, required final nonempty financial_before/after/apply_response JSON objects, DECIMAL(19,4) commercial_delta, four approved outcomes, positive change number/revisions, and nonblank source/key/hash. No pending shell or updated audit fact is allowed. SQL cannot prove semantic snapshot/response completeness; WP12 owns that proof.
- Ops: org_order_change_ops_dtl has the complete frozen Blueprint column set, positive sequence, all13 approved operation codes, four persisted audit target types, typed UUID/null shape and original safe before/after JSON. Persisted addition targets are the newly affected ITEM/PIECE/PREFERENCE, distinct from command parent scope. New entity UUIDs/clientRef mapping are preallocated later by the command; this package implements no command/service.
- Structure: add only deleted_at TIMESTAMPTZ NULL, deleted_by UUID NULL, deleted_order_change_id UUID NULL to items/pieces/preferences. No structural is_deleted/is_active truth or preference table is introduced. Removed facts with lineage become immutable; historical inactive rows with no lineage remain unchanged.

Existing physical state_version INTEGER NOT NULL DEFAULT1 remains workflow-owned; later API wfStateVersion is an alias only. Existing wf_profile bindings, branch/customer identity, currency/FX, financial snapshots, idempotency and outbox are reused. No second workflow counter, Edit payment/effect ledger or event store is created. STANDARD/EXPRESS are schema candidates supported by current normal/express pricing; rows remain NULL and no capability/pricing mode is enabled. SAME_DAY is excluded.

## 4. Keys, foreign keys and indexes

Existing order(id,tenant) and item(id,tenant)/(id,order,tenant) nondeferrable UNIQUEs are reused. Add only missing piece(id,tenant) and preference(id,tenant) UNIQUEs. Existing piece(tenant,order,item,piece_seq) UNIQUE remains unchanged. No unused live-hierarchy tuple/index is added.

Master UNIQUEs: (id,tenant); (id,order,tenant); (tenant,order,change_no); (tenant,order,edit_state_version_after); (tenant,idempotency_key). Ops UNIQUE: (tenant,change,operation_seq). Existing UUID PKs preserve single identity; the qualified keys are required FK targets. Master order FK and ops aggregate FK prove same tenant/order; typed historical target FKs use only immutable(id,tenant), never mutable parent tuples. Tenant/currency/actor FKs reference existing org_tenants_mst/sys_currency_cd/auth.users. Every new FK has ON DELETE RESTRICT and ON UPDATE RESTRICT.

| Index family | Query/invariant rationale |
|---|---|
| Master number/revision/key UNIQUEs | prohibit duplicate per-order Change number/revision and tenant-wide key reuse, including cross-order conflict |
| Master identity/aggregate UNIQUEs | required nondeferrable targets for lineage and same-order ops FKs |
| Master tenant/order/applied DESC; tenant/created DESC | order history and recent tenant support history |
| Ops tenant/change/sequence UNIQUE; tenant/order/change | ordered Change operations and tenant/order-scoped aggregate loading |
| Ops tenant/item, tenant/piece, tenant/preference | entity history after reparent, support and FK-reference lookups |
| Ops tenant/created DESC | recent operation support queries |
| Tenant/status and tenant/active on both new tables | retained current schema-standard support shapes; invariant values mean low selectivity, no measured performance benefit claimed |
| Structural tenant/deleted_change partial indexes | sparse lineage/history/reference lookups without indexing unresolved NULL population |

Leading UNIQUE/index tuples already cover tenant alone; no duplicate tenant-only index is authored. All explicitly named objects are≤30 characters. Cardinality/EXPLAIN proof and operator lock sizing remain unperformed. Global active hierarchy/shape enforcement is held pending section10, not silently weakened into ID-only production validation.

## 5. RLS, grants and immutable facts

Exact catalog/default ACL/RPC evidence lives in [Tenant Security Preflight](WP02_Tenant_Security_Preflight.md). New tables owner postgres, RLS enabled, no ordinary policy. Explicit REVOKE ALL FROM PUBLIC,anon,authenticated,service_role cancels inherited ACLs; only service_role SELECT/INSERT is granted. Ordinary browser roles have no direct reads/writes/non-row privileges. No unsafe current_tenant_id helper or new membership helper is installed. Later server history routes must enforce permission and a proven server-controlled membership authority with explicit tenant predicates; there is no new endpoint now.

Unconditional BEFORE UPDATE/DELETE row and BEFORE TRUNCATE statement guards protect new history even under normal postgres/service-role DML. Removed fact guards prevent subsequent deletion/reactivation/reparent/rewrite once V2 lineage exists. Trigger functions are SECURITY INVOKER, fixed pg_catalog search_path, no table queries and no direct ordinary EXECUTE grants. Owner/DBA can administratively alter schema/triggers: that is an audited privileged-maintenance limitation, not application permission. No fake session-setting bypass is provided. Runtime connection identity is not proven by configured Prisma postgres URLs alone.

## 6. Migration sequencing and locks

1.0547: additive order columns, NOT VALID consistency/actor FKs and irreversible evidence guard; no producer/data DML.
2.0548: verified missing historical identity keys, complete immutable aggregate, indexes, nullable lineage and deferred FKs, guards and explicit creation-time ACLs in one transaction.
3.Later reviewed work: tenant-bounded data classification, active-only hierarchy/Split resolution, separately authored validation/backfill and security closure; no SQL for these unresolved actions is supplied.

Both files use repository BEGIN/COMMIT convention, lock_timeout5s and statement_timeout120s as reviewable operational bounds, not verified SLOs. ALTER ADD COLUMN/CHECK/UNIQUE takes ACCESS EXCLUSIVE; nullable/constant-default additions avoid rewriting business facts. ADD FK alone takes SHARE ROW EXCLUSIVE, but combined ALTER uses the strongest lock. NOT VALID avoids existing CHECK/FK scans while enforcing future DML. UNIQUE cannot be NOT VALID and its index scans existing pieces/preferences. Regular index build takes SHARE and blocks writes; structural partial indexes also scan their tables. No CREATE INDEX CONCURRENTLY is used inside transaction. Later VALIDATE CONSTRAINT takes SHARE UPDATE EXCLUSIVE plus referenced-table locks as applicable. Operator must confirm row counts/size, blocking sessions, maintenance window, backup and finite timeout suitability. These statements fail atomically on unexpected duplicate/schema/timeout errors rather than hiding drift with IF NOT EXISTS. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html).

## 7. Backfill strategy

[Backfill Source Matrix](WP02_Backfill_Source_Matrix.md) covers canonical/POS/Quick Drop, alternate staff creation, public booking, in-memory/persisted/remote draft, external catalog sources, legacy unknown, compensation and Split children. Known current producer boundary is not historical row provenance. No source is automatically historical-backfill eligible from code alone; created_at/status/payment/items/source label are insufficient proof. Proven source-specific accepted aggregate may later receive revision1; uncommitted drafts stay0. Unresolved historical rows remain committed_at NULL/edit_state_version0 and V2-ineligible. No backfill SQL or fabricated actor/removal lineage is authored.

## 8. Actor and timezone findings

Both targets verify auth.users(id) UUID PK and legacy org_order_edit_history.edited_by FK to it. New committed_by/edit_blocked_by/deleted_by/actor_user_id therefore use auth identity, not org_users_mst membership row ID. Staff source actor, public customer session.customerId and missing Split actor are different cases; created_by string compatibility is unproven per historical row. Unknown approved historical actor remains NULL; new runtime facts use authenticated server-derived UUID.

Legacy order created_at/received_at/prepared_at are TIMESTAMP WITHOUT TIME ZONE. Current catalog timezone cannot prove each historical writer's convention. No implicit conversion is approved; record original source timezone/offset evidence before historical conversion. All new event times are TIMESTAMPTZ. Ambiguous timezone/actor/source cohorts stay ineligible.

## 9. rec_status and precision

Governed active=1, removed=0. Legacy nullable rec_status is not silently active or removed: classify first; unresolved structures block V2 eligibility. New lineage CHECK explicitly requires rec_status IS NOT NULL AND rec_status=0 and all three lineage fields, rejecting SQL UNKNOWN. With no lineage, all new fields are NULL and legacy inactive rows are legitimate. Before validated classification, governed readers use rec_status=1 explicitly and surface an ineligible context for legacy NULLs, rather than coalescing them into editable rows. Reader implementation is WP03, not performed here.

Tenant-bounded preflight templates (unexecuted; bind $1 to an authorized tenant):

```sql
SELECT count(*) FILTER (WHERE i.rec_status IS NULL) AS unresolved,
       count(*) FILTER (WHERE i.rec_status NOT IN (0,1)) AS unsupported
FROM public.org_order_items_dtl i WHERE i.tenant_org_id = $1::uuid;
-- Run the same scoped classification separately for pieces/preferences.
SELECT count(*) AS invalid_parent_shape
FROM public.org_order_preferences_dtl p
WHERE p.tenant_org_id = $1::uuid AND NOT (
  (p.prefs_level = 'ORDER' AND p.order_item_id IS NULL AND p.order_item_piece_id IS NULL)
  OR (p.prefs_level = 'ITEM' AND p.order_item_id IS NOT NULL AND p.order_item_piece_id IS NULL)
  OR (p.prefs_level = 'PIECE' AND p.order_item_id IS NOT NULL AND p.order_item_piece_id IS NOT NULL));
-- Existing level is NOT NULL; retain separate enum validation where needed.
SELECT count(*) AS invalid_piece_parent
FROM public.org_order_item_pieces_dtl p
LEFT JOIN public.org_order_items_dtl i ON i.id = p.order_item_id
  AND i.order_id = p.order_id AND i.tenant_org_id = $1::uuid
WHERE p.tenant_org_id = $1::uuid AND i.id IS NULL;
```

Items price_per_unit/total_price remain NUMERIC(10,3), maximum magnitude9,999,999.999; pieces/preference extras use19,4. New delta DECIMAL(19,4) has maximum magnitude999,999,999,999,999.9999. WP08/WP12 must qualify currency exponent, signed deltas, legacy scale quantization and range before persistence; never claim four-decimal item storage or silently round a reviewed amount. No legacy precision conversion/Finance formula change is bundled.

## 10. Split and historical identity

[Split Compatibility Review](WP02_Split_Compatibility_Review.md) verifies item Split preserves item UUID but changes order_id in separate nontransactional statements without transferring descendants. Piece Split parses synthetic IDs, clones items/decrements source quantity and leaves persisted pieces/preferences; current UI passes UUIDs. These are confirmed existing incompatibilities, not WP02 fixes.

Immutable(id,tenant) history references survive valid later reparent without rewriting audit. Global all-row live hierarchy FKs, even NOT VALID, would immediately affect current Split writes. Removed descendants retained at origin conflict with moved parent tuples even after a future atomic Split. Active-only hierarchy/origin design and V2-referenced Split fail-closed policy must be reviewed in owning workflow packages before activation. No unsupported Split mode is enabled and no new live-parent constraint is authored here.

## 11. Security dependencies and repair RPCs

current_tenant_id trusts editable user_metadata before fallback; org_users_mst permissive self-row ALL policy plus ordinary INSERT/UPDATE privileges undermines membership integrity itself. A new EXISTS membership helper alone cannot cure that. Catalog confirms ordinary EXECUTE on SECURITY DEFINER fix_order_data, hq_mntnc_cleanup_tenant_orders and claim_outbox_batch. Their caller/tenant/global worker boundaries require WP17 closure and WP18 real-role proof. No platform-wide policy/function repair is performed. Initial new tables fail closed for ordinary roles; future server authority and V2 enablement remain gated.

## 12. Deferred insertion proof and unresolved gates

Preallocate Change UUID and required entity UUIDs; mutate commercial facts with removal lineage; insert master exactly once with final financial facts/hash/response; insert ops; commit all together. Only the three removal-to-Change FKs are DEFERRABLE INITIALLY DEFERRED and NOT VALID. Referenced identity UNIQUEs are nondeferrable. Referencing existence checks resolve at SET CONSTRAINTS … IMMEDIATE or COMMIT, so late master insertion is structurally supported. RESTRICT delete/update actions remain immediate. Actor and ops/history FKs are immediate; order/service hierarchy is verified under later command locks. [PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/17/sql-createtable.html).

Static PostgreSQL parsing proves grammar, not catalog symbol/type resolution, trigger permission/runtime behavior, deferred success/missing-master rollback, no partial history or Prisma transaction semantics. These real DB fixtures were deliberately not run because schema execution is operator-owned. Required gates remain: tenant-bounded NULL/orphan/source/actor/timezone classification; active-only hierarchy/removal-origin/Split design; verified deployed application identity and membership integrity; real migration/constraint/ACL/rollback proof; operator-approved lock/backup/application; subsequent schema sync. No frozen business decision is reopened.

## 13. SQL files authored — operator application verified on both targets

- [0547_wp02_order_change_foundation.sql](../../../../supabase/migrations/0547_wp02_order_change_foundation.sql)
- [0548_wp02_order_change_history.sql](../../../../supabase/migrations/0548_wp02_order_change_history.sql)

Only new files were authored. No existing migration was edited. No permission/flag seeds, live hierarchy validation, historical backfill, Preview/Apply, Finance follow-up or committed-writer migration exists in these files.

## 14. Focused validation

pglast7.19 was installed into an isolated OS temporary directory, without changing repository dependencies. Its embedded PostgreSQL17.7 parser accepted both SQL files after the explicitly requested full object-comment pass (0547:27 statements/1 PLpgSQL function, 0548:181 statements/2 PLpgSQL functions). The [parser API](https://pglast.readthedocs.io/en/v7/parser.html) parses syntax only.

The comments-only follow-up documents all75 columns inline and all created/altered objects with157 catalog COMMENT ON statements:6 tables,75 columns,41 constraints including2 implicit PKs,24 indexes including constraint-backed indexes,3 functions and8 triggers. Existing legacy table descriptions were verified equal locally/hosted and preserved as prefixes. Before/after non-Comment PostgreSQL ASTs are identical after removing source-location fields; schema/constraint/grant/guard logic is unchanged. Focused21-test suite passed again. At that historical pre-application point,0547/0548 were absent from both migration histories and Change tables/committed_at were absent. The later operator installation, data preflight and fixture proof supersede the former partial status; WP03 remains NOT STARTED.

From web-admin:

```text
npx jest __tests__/migrations/edit-order-v2-foundation.test.ts --runInBand --watch=false
=> PASS: 1 suite, 21 tests
npx eslint __tests__/migrations/edit-order-v2-foundation.test.ts --quiet
=> exit0, no findings
```

The [contract test](../../../../web-admin/__tests__/migrations/edit-order-v2-foundation.test.ts) verifies full columns/defaults, guards, NULL-safe lineage, deferred timing source, all16 RESTRICT FKs, immutable tenant targets, RLS/ACLs, affected target mapping, index duplication/object names and no data DML/global hierarchy/counter duplication. It is a source-contract test, not simulated runtime proof. Final scoped whitespace/local-link checks passed. No scratch schema was created, Data API exploit attempted, DB reset/migration application/backfill/Apply test/browser E2E/full suite/build run.

## 15. Initial operator review handoff (superseded by section17 application record)

Compatible foundation SQL is ready for operator design review, with the catalog, locks, ACLs and validation limitations above. This is not permission to enable V2 or a claim of tested production application. Re-list migrations/reverify schema before scheduling application; on new drift, revise via new file only before any deployed history, never overwrite an applied migration. Keep V2 disabled and historical rows unclassified. Validation/backfill/live hierarchy require their separate evidence. Preserve applied audit/lineage if later disabling V2; no destructive down/reset/fallback replacement.

## 16. WP03 readiness and stop

| Acceptance evidence | Result / remaining gate |
|---|---|
| Current catalogs/history; no duplicate columns/tables/keys | PASS, operator-installed0547/0548 match both targets through0549; section17 has exact proof |
| Exact compatible columns/history/audit target/FK/ACL design | PASS, SQL and owning Blueprint/Security freeze it |
| Auth actor authority; known source/timezone treatment | PASS: `auth.users(id)` is the FK authority; live rows are explicitly classified as uncommitted/V2-ineligible unless a later approved source proof qualifies them |
| Immutable insertion/deferred timing | PASS for PostgreSQL structural contract: disposable PG17 fixture proved late-master commit, missing-master commit failure and complete rollback. Order Change ORM/service composition remains WP11/WP12/WP18 work |
| Source matrix, rec_status NULL handling and Split analysis | PASS: both target scans found no current structural/lifecycle violations; remote legacy cohort remains uncommitted/V2-ineligible; active-only hierarchy/removal-origin contract and temporary Split denial are frozen |
| Membership/runtime/direct authority | PASS for WP02 baseline: actual repository Prisma connection is non-superuser `postgres` with BYPASSRLS and no JWT actor; new tables fail closed to ordinary roles. Platform membership/RPC closure remains a WP17/WP18 activation gate |
| SQL review/static validation | PASS, PostgreSQL parser and21 focused source-contract tests |
| Migration application | Operator-applied on both; deployment verification PASS. Agent-applied NONE. Disposable structural fixture PASS; no production data or migration write was made |

WP01–WP20 sequence is unchanged. Operator installation, scoped Prisma schema/client sync, data classification and structural-fixture evidence are complete. WP17/WP18 still own membership/RPC/direct-authority closure and real authenticated application-flow proof for enablement; no later package was started.

**WP03 remains NOT STARTED.** Its foundation prerequisites are complete. WP03 requires explicit user approval and must keep V2 disabled, exclude unqualified historical/split-derived orders, and use server-validated tenant/actor authority. No new implementation plan is created.

## Files created/updated by this WP02 package

Created: this report; NEW0547/0548 SQL (section13); web-admin/__tests__/migrations/edit-order-v2-foundation.test.ts (section14).

Updated: WP02_Backfill_Source_Matrix.md; WP02_Tenant_Security_Preflight.md; WP02_Split_Compatibility_Review.md; Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md; the active v3.0 Database_Schema_Blueprint, Permissions_Security_Tenant_Isolation, Migration_Cutover_Operations_Runbook and Open_Decisions_Release_Gates Markdown documents. No other files belong to this package. Prior final review evidence and DOCX/ZIP snapshots were not changed.

## 17. Operator application and regenerated-type verification — 2026-10-02

The user reports successful application to both targets and type regeneration. Fresh metadata SELECTs confirm0547/0548 installed locally and hosted. Both histories now contain555 records, latest numeric0549(clf_backfill);0549 is outside WP02 and was not reviewed. Repository remains main/f33cff481c7a5d35fb16ad5a10983db2762c9818 with shared dirty edits preserved. Neither SQL file was changed or executed by this verification.

| Installed evidence | Local and hosted result |
|---|---|
| Order additions and structural lineage | All10 order and9 lineage columns match reviewed types/defaults/nullability |
| New Change aggregate | Master31/ops25 columns match reviewed SQL |
| Constraints and indexes |41 WP02 constraints,14 intentionally NOT VALID;16 FKs all RESTRICT; only3 lineage FKs DEFERRABLE INITIALLY DEFERRED;24 indexes valid/ready |
| Guard functions/triggers |3 SECURITY INVOKER functions with fixed pg_catalog search_path and owner-only direct EXECUTE;8 enabled guards |
| History tenancy/ACLs | postgres owner; RLS enabled; zero policies; ordinary/public grants absent; service_role SELECT/INSERT only |
| Catalog comments | Complete75-column/41-constraint/24-index/3-function/8-trigger/6-table coverage matching reviewed metadata |

Installation proves PostgreSQL accepted the schema/function/privilege definitions on both targets. It does not prove real deferred late-master/missing-master rollback, actor/tenant authorization, Data API enforcement, concurrency or future Prisma command behavior. No business rows or runtime functions were exercised. Historical classification, active-only hierarchy/Split design and existing membership/RPC dependencies remain open;14 NOT VALID constraints were not silently validated.

`web-admin/types/database.ts` and `database.generated.ts` are byte-identical and contain all WP02 fields/models: ten order fields, nullable lineage on all three structural tables, master31/ops25 columns and composite relationships. Row/Insert/Update nullability/default shapes agree. Generated CHECK-backed tokens remain strings and numeric money remains number; this is not a command-domain/decimal-safe contract or immutable write permission. Physical actor FKs remain auth.users; generated public projection relationship labels do not replace that authority.

**Pre-synchronization gap (resolved in section18):** At the section17 inspection, schema.prisma/installed Prisma.dmmf lacked both Change models and19 order/lineage additions. Supabase regeneration alone did not refresh Prisma. The later explicit authorization permitted scoped introspection reconciliation and client generation, preserving unrelated definitions; this historical gap is no longer open.

Focused checks passed: `npx tsc --noEmit --skipLibCheck types/database.ts types/database.generated.ts` (exit0); generated-type AST inspection (zero parse diagnostics); migration contracts (1suite/21tests). This is not full application compilation. The later disposable fixture in section20 supplies the PostgreSQL structural proof; application command composition remains later work. WP03 remains NOT STARTED pending explicit approval.

## 18. User-authorized scoped Prisma synchronization — 2026-10-02

Updated only web-admin/prisma/schema.prisma and generated Prisma Client6.19.3. Non-mutating `prisma db pull --print` output was captured in an OS temporary file as the deployed introspection reference; no full-schema overwrite occurred. The final schema adds231 lines with no deletions:19 scalar fields on existing order/structural models,31 Change-master and25 Change-op scalars, both Change models, required forward/inverse relations and mapped FK/UNIQUE/index names, plus missing piece/preference(id,tenant) identity keys. All original253 model definitions/lines and existing scalar definitions are preserved; generated DMMF now contains255 models.

All75 new fields match deployed-introspection type/default/nullability and have SQL-derived purpose comments. Documentation review found no missing comments. Native SQL CHECKs/append-only triggers/RLS/grants/deferred lineage timing remain SQL authority. The three sparse partial lineage indexes are documented rather than incorrectly declared as full Prisma indexes. Existing unrelated SetNull warnings were preserved.

Validation PASS: Prisma schema validation; `npm run prisma:generate`; generated-client DMMF coverage/preservation comparison; temporary noEmit TypeScript fixture selecting all75 fields and checking composite master idempotency/operation sequence inputs; deployed introspection parity; scoped migration contracts(1suite/21tests); whitespace check. No temporary fixture or dependency/package change was committed, no database query/write was run through the generated client, and no migration/data/backfill/constraint validation/runtime service/UI/WP03 implementation was executed.

The Prisma sync prerequisite is CLOSED. This follow-up changes the schema plus this report, living plan, Database Blueprint, Release Gates and Security Preflight status references. Subsequent sections record the completed data/hierarchy/runtime structural proof. WP03 still requires subsequent explicit approval; stop at WP02.

## 19. Tenant-bounded data preflight and runtime baseline — 2026-10-02

The reproducible [read-only query set](../../../../supabase/tests/wp02_data_preflight.sql) was executed against every catalogued tenant using explicit `tenant_org_id` predicates on every `org_*` source and join. The complete non-sensitive result is retained in [WP02_Data_Preflight_Evidence.json](WP02_Data_Preflight_Evidence.json). This was classification only: it did not assign `committed_at`, populate lineage, validate a `NOT VALID` constraint, repair finance, invoke an RPC, or mutate either target. The final recheck ran on current `main` HEAD `fea0d4f415330c2586f8b1afb7c7b4af498ae7d6`; its concurrent cash-drawer commit was not otherwise reviewed by WP02.

At 17:59 UTC, local contained no orders or related structure. Hosted contained 72 orders, 98 items, 114 pieces and 37 preferences; all Change tables remained empty. All current structural rows had `rec_status=1`; the scans found zero NULL/unsupported lifecycle values, orphan/wrong-parent/invalid-preference-shape records, foundation-check violations, actor/lineage FK violations and existing removal lineage. All 72 hosted orders remained `committed_at NULL`, `edit_state_version=0` and `service_speed NULL`; `created_by` values were UUID-shaped and exist in `auth.users`, but that is not commitment-actor evidence. They remain V2-ineligible until a later approved source/actor/timezone qualification. The hosted snapshot catalog reported 53 `MISMATCH` and 19 `CURRENT` rows; this is recorded as existing Finance evidence, not repaired or reclassified by WP02.

After the user reported deleting all orders, a fresh direct count confirmed local remains empty. The configured hosted target still returned 72 orders, 98 items, 114 pieces and 37 preferences. This report does not infer which environment the user deleted or perform a second deletion. Local and hosted sessions differ in current timezone (UTC and Asia/Muscat respectively); neither setting proves the original convention of legacy `TIMESTAMP WITHOUT TIME ZONE` writes.

The configured repository Prisma base connection was also tested in a read-only transaction. It runs as non-superuser `postgres` with `BYPASSRLS`, no JWT actor and UTC session timezone. `withTenantContext` and the Prisma tenant guard are therefore defense in depth; future V2 writers must still derive and validate actor/tenant server-side, include explicit tenant predicates, and never accept the bare metadata/header helpers as authority. Canonical submit has a stronger membership validator today, but the integrity of the membership/RPC authority remains an enablement gate owned by WP17/WP18.

## 20. Disposable PostgreSQL structural fixture — 2026-10-02

The new [fixture harness](../../../../scripts/tests/wp02-isolated-postgres.py) creates one self-labelled PostgreSQL17 container with `--network none`, no published port, no external volume, only a bounded tmpfs data directory and a local Unix socket. It rejects database URLs, host/port arguments, dotenv-derived `PG*` values, existing containers and migration runners; it removes only its verified owned container. It compiles the reviewed object DDL/comments/ACLs extracted verbatim from0547/0548 while skipping only migration transaction wrappers/history tracking, against a documented minimum synthetic prerequisite schema. No local/hosted database, migration history or business fact is connected or changed.

The fixture passed on PostgreSQL17.11. It proves all three deferred removal-lineage FKs accept late complete-master insertion at COMMIT, reject a missing master at COMMIT with `23503`, and leave no partial master/ops/removal/revision fact after failed COMMIT. It also proves immediate `SET CONSTRAINTS`, NULL-safe `rec_status` lineage checks, immutable removals/history/commitment/permanent blocks, tenant-qualified historical FKs, same-tenant reparent survival, `anon`/`authenticated` ACL and no-policy RLS denial, and service-role append-only access. The fixture uses a non-superuser BYPASSRLS owner to match the verified deployed runtime attribute; bootstrap administration is distinct. PostgreSQL checks an incomplete referenced-table TRUNCATE before the trigger (`0A000`); the complete-set case reaches the immutable-history trigger (`23514`).

This closes the WP02 database-structural proof. It does not implement or prove an Order Change Prisma/service transaction, actual Supabase JWT/Data API behavior, membership integrity, existing privileged repair RPC authorization, Finance races, Split execution, or end-user permissions. Those are owned later by WP11/WP12/WP17/WP18 and remain release/enablement gates, not reasons to leave the foundation package incomplete.
