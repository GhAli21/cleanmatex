# Discovery — Remote DB

**Environment:** CleanMateX **remote** Supabase  
**Rule:** Prefer remote for discovery / production evidence. Do not apply migrations via MCP.  
**Date signed:** 2026-07-25  
**Status:** **Signed** (results below)

## Code-verified infrastructure (repo truth)

| Asset | Location | V1.0 decision |
|-------|----------|----------------|
| Central outbox | `org_domain_events_outbox` via `web-admin/lib/services/outbox.service.ts` (`emitEventTx`, `claimBatch`) | **Reuse** — do not create `org_wf_outbox_tr` |
| Idempotency | `org_idempotency_keys` via `web-admin/lib/utils/idempotency.ts` | **Reuse** |
| Prep poison path | `app/api/v1/preparation/[id]/complete/route.ts` | Retire `sorting` write (engine / legacy bridge → `processing`) |
| Dual engine | `app/api/v1/orders/[id]/transition/route.ts` Legacy + Enhanced | Replace with `executeAction` under canary |

## SQL to run on remote (read-only)

```sql
-- 1) Drift
SELECT COUNT(*) FILTER (WHERE status IS DISTINCT FROM current_status) AS drifted,
       COUNT(*) AS total
FROM org_orders_mst;

-- 2) Drift + sorting breakdown
SELECT COALESCE(status::text, '(null)') AS status,
       COALESCE(current_status::text, '(null)') AS current_status,
       COUNT(*)::int AS cnt
FROM org_orders_mst
WHERE status = 'sorting'
   OR current_status = 'sorting'
   OR status IS DISTINCT FROM current_status
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 40;

-- 3) Header columns present
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'org_orders_mst'
  AND column_name IN (
    'status', 'current_status', 'current_stage', 'preparation_status',
    'state_version', 'updated_at', 'workflow_template_id'
  )
ORDER BY 1;

-- 4) Central infra exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'org_domain_events_outbox'
) AS has_central_outbox,
EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'org_idempotency_keys'
) AS has_idempotency_keys;

SELECT COUNT(*)::int AS outbox_rows FROM org_domain_events_outbox;
SELECT COUNT(*)::int AS idempotency_rows FROM org_idempotency_keys;

-- 5) Template / packing usage (if columns exist)
SELECT COUNT(*)::int AS orders_with_template
FROM org_orders_mst
WHERE workflow_template_id IS NOT NULL;
```

## Results (remote — 2026-07-25)

| Check | Result | Signed |
|-------|--------|--------|
| Drift count / total | **0 / 64** | ☑ |
| `sorting` / drift breakdown | **0 rows** (no `sorting`, no status≠current_status pairs) | ☑ |
| Header columns | All present: `current_stage`, `current_status`, `preparation_status`, **`state_version`**, `status`, `updated_at`, `workflow_template_id` | ☑ |
| Central outbox exists | **true** (`org_domain_events_outbox`, **197** rows) | ☑ |
| Idempotency table exists | **true** (`org_idempotency_keys`, **182** rows) | ☑ |
| Orders with `workflow_template_id` | **62** / 64 | ☑ |

### Interpretation (engineering)

- Remote order headers are **aligned** (`status` ≡ `current_status`); no `sorting` poison rows — safe for canary from a drift perspective.
- `state_version` is live after `0427` apply — engine concurrency can be used.
- Central outbox + idempotency confirmed in production DB — reuse decision stands.
- Most orders already have a template id (62/64) — useful later for profile snapshot / seed from templates; not a blocker for engine canary.

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | Remote SQL results provided by operator | 2026-07-25 |
| Product | | |
