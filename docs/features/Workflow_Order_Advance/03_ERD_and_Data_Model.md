# 03 — ERD and Data Model

**Status:** P0 correction pass · **Date:** 2026-07-24

## 1. Rename policy (corrected)

**Do not** make mass rename the primary P1 deliverable.

| Approach | When |
|----------|------|
| **Keep** existing table names | Responsibility still correct |
| **Add** new `sys_wf_*` / `org_wf_*` catalogs | Missing runtime authority tables |
| **Rename** | Only if name/responsibility is materially wrong; expand→contract; ≤30 chars; suffixes `_cd` `_mst` `_dtl` `_cf` `_tr` |

Suggested new catalog names (normalize suffixes):

| Table | Purpose |
|-------|---------|
| `sys_wf_statuses_cd` | Status catalog |
| `sys_wf_screens_cd` | Screens |
| `sys_wf_screen_status_cd` | Membership screen↔status |
| `sys_wf_transitions_cd` | Runtime edges |
| `sys_wf_actions_cd` | Action codes + EN/AR |
| `sys_wf_action_trans_cd` | action → transition |
| `sys_wf_initial_rules_cd` | Create rules |
| `sys_wf_gate_defs_cd` | Gates |
| `sys_wf_profiles_cd` / `sys_wf_profile_ver_mst` / `sys_wf_prof_ver_scr_dtl` | HQ-published profiles + versions + enabled screens (see `0444`, [ADR_SYS_WF_PROFILES.md](ADR_SYS_WF_PROFILES.md)) |
| `org_wf_profile_assign_cf` | Tenant/service/branch assignment (FK → profiles after `0444`) |
| `org_wf_idempotency_tr` | Only if central store insufficient |

**Reuse, do not invent:** central outbox tables/services already used by Fin/history consumers.

## 2. Order header columns (V1.0)

| Column | Purpose |
|--------|---------|
| `current_status` | Worklist SoT during V1.0 |
| `status` | Dual-write cutover |
| `state_version` | Optimistic concurrency |
| `wf_profile_id` / `wf_version_no` | Snapshot at create (names ≤30 TBD in migration) |
| `preparation_status` | **Bridge only** — migrate to stage executions in V1.1 |

## 3. Runtime structures

### V1.0

- Config catalogs + assignments + release mst/ln (partial fulfilment)
- Idempotency (reuse or `org_wf_idempotency_tr`)

### V1.1 (design reserved — not P1 blocker)

| Table (indicative ≤30) | Purpose |
|------------------------|---------|
| `org_ord_stage_exec_tr` | Stage executions/attempts |
| `org_ord_work_group_mst` | Mixed-service work groups |
| `org_ord_wg_item_dtl` | Work-group item assignment |
| Projection columns or view | fulfilment/exception/custody/milestone summaries |

### V1.2 (design reserved)

- Outsourcing vendor/job/job-line tables
- Custody event stream if not covered elsewhere

## 4. Seed + RLS

Full seed of V1.0 catalogs; graph CI; RLS on all new `org_*` tables; HQ assignment rows tenant-scoped where needed.

## 5. Related

- [04_Status_and_Vocabulary.md](04_Status_and_Vocabulary.md)
- Existing templates may **seed** profiles without forced rename
