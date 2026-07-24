# Discovery — Remote DB

**Environment:** CleanMateX **remote** Supabase (`supabase_remote` MCP)  
**Rule:** Prefer remote for discovery / production evidence. Do not apply migrations via MCP.  
**Date:** 2026-07-24

## Code-verified infrastructure (repo truth)

| Asset | Location | V1.0 decision |
|-------|----------|----------------|
| Central outbox | `org_domain_events_outbox` via `web-admin/lib/services/outbox.service.ts` (`emitEventTx`, `claimBatch`) | **Reuse** — do not create `org_wf_outbox_tr` |
| Idempotency | `org_idempotency_keys` via `web-admin/lib/utils/idempotency.ts` | **Reuse** |
| Prep poison path | `app/api/v1/preparation/[id]/complete/route.ts` comments transition to `sorting` | Must retire in integ-preparation |
| Dual engine | `app/api/v1/orders/[id]/transition/route.ts` Legacy + Enhanced | Replace with `executeAction` |

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

## Results (fill when MCP/CLI succeeds)

| Check | Result | Signed |
|-------|--------|--------|
| Drift count / total | *Pending — remote MCP execute_sql still fails 2026-07-24 overnight* | ☐ |
| `sorting` rows | Pending | ☐ |
| `state_version` column exists | Pending (expect **false** until you apply `0427`) | ☐ |
| Central outbox exists | Expected **true** (code + migrations) | ☐ confirm on remote |
| Idempotency table exists | Expected **true** | ☐ confirm on remote |

### Agent note

`supabase_remote` MCP reports `serverStatus: ready` and tool schema loads, but `execute_sql` / `list_tables` still fail with:  
`Cannot call tool before MCP process client is registered`.  
Local MCP hits the same error. **P1 proceeded on code/ERD authority**; you must run SQL here (or paste results) before production canary.

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Product | | |
