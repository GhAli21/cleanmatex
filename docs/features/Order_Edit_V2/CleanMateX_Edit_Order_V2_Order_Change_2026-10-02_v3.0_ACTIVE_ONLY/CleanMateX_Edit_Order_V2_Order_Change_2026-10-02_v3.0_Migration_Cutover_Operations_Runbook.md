# CleanMateX Edit Order V2 — Migration, Cutover & Operations Runbook

**Version:** 3.0

## 1. Preflight

- record branch/HEAD/status;
- verified backup for environment being changed;
- re-list current migrations and target schema;
- verify remote auth/catalog before production decisions;
- run canonical Create protection and legacy Edit characterization;
- refresh committed writer inventory;
- verify current RLS/grants/RPC functions and settings/permission catalogs.

### Current read-only baseline and remaining proof

2026-10-02 inspection reached local (`http://127.0.0.1:54321`, x86 PostgreSQL 17.6) and hosted (`https://ndjjycdgtponhosvztdg.supabase.co`, aarch64 PostgreSQL 17.6) through their respective MCPs. Both catalog sessions run as postgres and both record 546 migrations, latest numeric `0540`, plus six legacy timestamp entries. Metadata access is currently available; older Unauthorized observations do not describe current access. No SQL migration or mutation was authored/executed during this review.

Do not assume identical target schema from migration counts: local preference parent-shape CHECK exists but hosted lacks it, item audit-column TEXT/VARCHAR differs, and equivalent order/item UNIQUE tuple names differ. Use the Blueprint's verified tuple definitions and target-specific absence checks. Re-list root numeric migration sequence immediately before authoring; old timestamp placeholders do not reserve a future sequence.

Catalog success proves installed columns/keys/indexes/policies/function definitions/grants, not orphan-free data, historical commitment classification, actor/timezone provenance, runtime application role, JWT authorization, Data API exposure, concurrency or rollback. Every enabling tenant/order needs source classification evidence; unresolved rows remain V2-ineligible. Backfill must be repeatable and bounded, preserve existing valid classifications, report ambiguous/orphan rows and validate after application by the authorized operator. Never infer commitment from creation time or synthesize typed history from lossy legacy diffs.

## 2. Additive deployment sequence

1. additive DB foundation, feature disabled;
2. compatible Prisma/types/readers;
3. commitment producers + active-row readers;
4. contracts/context;
5. capability/RBAC/config;
6. projection/calculation/Finance adapters;
7. Preview;
8. persistence + Apply;
9. frontend Review flow;
10. finance follow-up;
11. migrate/guard every committed writer;
12. historical backfill/preflight;
13. concurrency/security/UAT;
14. internal pilot;
15. selected cohort;
16. default cutover;
17. bounded legacy cleanup.

## 3. Feature/cohort rule

V2 may not be enabled for an order/cohort while an ordinary committed commercial writer remains able to bypass Change for the same scope. Partial authority breaks revision/proof correctness.

The Security companion's confirmed installed helper/grant/RPC defects are mandatory closure gates, not hypothetical audit work. A feature flag cannot stop direct Data API writes or SECURITY DEFINER RPCs. WP02 includes safe new-object privilege design; WP17 closes current bypasses; WP18 proves actual identities/roles/direct access; WP19 enables only the proved cohort. Existing Create, Workflow, Finance and operator maintenance access must retain their reviewed behavior. No broad production grant/helper change is authorized by this documentation review.

## 4. Pilot checklist

- normal, Quick Drop, paid/unpaid/partial/B2B scenarios;
- EN/AR/RTL;
- same product repeated lines;
- pieces/preferences;
- workflow conflict;
- two commercial editors;
- payment/refund race;
- retry after lost Apply response;
- financial follow-up failure;
- legacy route blocked;
- direct-client DML/RPC blocked;
- metrics/outbox visible.

- membership-safe tenant selection and forged metadata rejection;
- worker-only outbox claim and privileged-only repair/HQ maintenance execution;
- effective ordinary-role table/function/default-ACL restrictions, with dedicated security fixtures;
- real Change vs collection/refund/overpayment/workflow/split lock-order tests and bounded retry/timeout behavior;
- repeat Apply with same key after cache expiry replays the durable Change response; a different payload conflicts;
- no-op produces no Change/revision/event, and lost-response retries cannot commit a second Change;
- source-qualified commitment/backfill and local/hosted hierarchy differences resolved for the enabling scope.

Current collection takes an order FOR UPDATE lock (`order-settlement.service.ts:420`); workflow takes the same parent lock (`workflow/workflow-engine.service.ts:304`). Refund processing currently locks the refund row first (`order-refund.service.ts:759`) and reads the order without a parent lock through `getRefundableBalanceSummaryTx` before its eventual snapshot write. Do not claim a common Finance lock protocol already exists. Before WP12/Finance follow-up completion, agree and test a deterministic protocol across parent orders and refund/payment/stored-value/invoice/voucher/drawer sources; do not add a reverse lock order in Change. Lock source/destination orders deterministically for split. A successful mock transaction cannot establish these properties.

## 5. Rollback

For V2-modified orders, rollback is read-only/disable further V2 editing, never fallback to full replacement. Preserve Change history and allow safe Finance follow-up. Legacy writer may remain only for orders never entering V2 and only inside documented compatibility cohort during rollback window.

## 6. Incident support

For any suspected bad Change:

1. identify order/change/revision/request/idempotency key;
2. freeze further Edit with temporary block if needed;
3. inspect operations and canonical facts;
4. inspect financial snapshot and immutable settlement facts;
5. do not manually rewrite payment/receipt/history;
6. use domain correction/repair authority with audited reason;
7. record incident and add regression test.

## 7. Data repair

Generic SQL repair is not normal Edit. Production repair requires explicit privileged runbook, dry-run/report, tenant/order scope, backup, reason/actor, post-reconciliation and audit. Once V2 is authoritative, commercial repairs should prefer a governed `REPAIR` source through Change where semantically expressible.
