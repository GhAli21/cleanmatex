
Database CPU Remediation Report from remote DB:

No database changes have been made. The findings below are a prioritized runbook for investigating and fixing the issues safely.

Executive summary
The strongest application-side optimization target is the settings resolver. fn_stng_resolve_all_settings loops through each active setting and calls fn_stng_resolve_setting_value separately. The resolver then repeats tenant, profile, plan, feature-flag, and override lookups. Table statistics show roughly 1.4 million sequential scans of org_tenant_settings_cf and more than 1 million of org_tenants_mst.

The statement rankings also include extensive Dashboard/schema introspection and Supabase internal work. They aren’t all application queries, and accumulated execution time does not prove a query is CPU-bound.

Important measurement limitation: pg_stat_statements reports elapsed execution time, not CPU time. Its counters were last reset on December 15, 2025, so the totals span about ten months rather than the current CPU spike. For live CPU trends, compare a fresh database-statistics window with the project’s Metrics.

1. Fix the settings resolver first
Evidence: the API call invoking fn_stng_resolve_all_settings took about 144 ms on average across 19,318 calls. The function loops through active settings, while the inner resolver re-reads catalog and tenant context and separately checks tenant, branch, and user overrides. The org_tenant_settings_cf scans are especially notable because that table has only about 20 live rows: repeated scans, rather than table size, are the concern.

Recommended changes
Rewrite the all-settings resolver as a set-based operation.

Load the tenant’s profile, profile chain, and plan once per request.
Fetch active settings and applicable profile/override rows in batches.
Select the winning non-null value by the existing layer priority.
Preserve current required/null handling and feature-flag behavior; test equivalence before replacing the current function.
Consider using the existing effective-settings cache. Its table is currently empty, and the resolver implementation inspected does not use it. Use it only if you also implement and test invalidation for changes to tenant settings, profiles, plans, and feature flags.

Test this index candidate. It matches the resolver’s active tenant/setting/scope lookups:

CREATE INDEX CONCURRENTLY IF NOT EXISTS org_tenant_settings_lookup_active_idx
ON public.org_tenant_settings_cf
  (tenant_org_id, setting_code, user_id, branch_id)
WHERE is_active;

Because the table is small, the planner may still prefer a sequential scan. Treat the index as a measured candidate, not a guaranteed fix. Add it in a deployment path that permits CREATE INDEX CONCURRENTLY, then compare before/after plans and buffer counts. Supabase’s Postgres index guide (https://supabase.com/docs/guides/database/postgres/indexes) explains the trade-offs.

2. Review Realtime workload
realtime.list_changes accounted for about 15.7 million ms over 2.52 million calls, averaging 6.2 ms. That is high cumulative activity, but the history alone doesn’t prove Realtime is the current CPU bottleneck.

Audit clients for broad or wildcard Postgres Changes subscriptions, unnecessary subscribers, and duplicate subscriptions that aren’t cleaned up. Narrow subscriptions to the tables and events clients actually need. For workloads where it fits, consider server-side processing with Realtime Broadcast instead. Supabase explains the scaling behavior and alternatives in its Postgres Changes guide (https://supabase.com/docs/guides/realtime/postgres-changes).

3. Don’t add indexes to the observed worker paths without plans
The notification outbox already has polling indexes that are heavily used, including indexes for queued, retryable, and leased rows. The campaign scheduler also has a scheduler index. Based on the inspected definitions and usage, there is no clear missing index on those polling paths.

The high-time notification functions are thin wrappers around net.http_post; their elapsed time is not proof of CPU-heavy SQL. Review their cron frequency, request volume, and worker batching, but don’t disable them or alter schedules without checking operational consequences.

The _http_response cleanup query already has an index on created. Its high total time reflects many calls, so first verify cleanup frequency, retention requirements, and deleted-row counts. Don’t add a second index on the same timestamp column without a plan showing why it helps._

4. Use fresh measurements to separate product work from platform overhead
The rankings’ highest mean times were largely Dashboard/schema-introspection or internal queries. For example, several catalog queries averaged seconds and some wrote many temporary blocks. The top-total list also included net._http_response cleanup and realtime.list_changes._

The live activity check found five active sessions, with the longest about 7.9 seconds, plus one session waiting on ClientRead. The incident check showed no active Supabase incidents. These are snapshots, not a diagnosis of the earlier CPU peak.

Recommended measurement cycle:

Save the current rankings as a baseline.
Choose a representative traffic window and record CPU alongside query statistics.
If you need a clean comparison, reset statement statistics only after saving the baseline; resetting clears the accumulated counters.
Repeat the same workload after each change and compare total time, mean time, calls, block reads/hits, and temporary blocks.
Use EXPLAIN (ANALYZE, BUFFERS) on the specific application query or function path before and after changes.
Supabase’s database inspection guide covers these checks(https://supabase.com/docs/guides/observability/inspect).

5. Address Performance Advisor findings selectively
The Performance Advisor reported:

517 unindexed foreign keys
96 RLS initialization-plan findings
591 unused-index findings
1,005 multiple-permissive-policy findings
11 duplicate-index findings
Two tables without primary keys
These are broad inventories, not proof that every item causes this CPU issue.

For unindexed foreign keys, prioritize large or frequently modified tables and indexes used by actual joins or parent-row deletes. Don’t create hundreds of indexes in one pass. See the unindexed foreign key remediation(https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
For the RLS initialization-plan findings, review row-independent calls such as auth.uid() in policies and, where appropriate, wrap them as (select auth.uid()). Test the changed policies’ behavior. See RLS performance guidance(https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

Don’t drop an “unused” index based on a single cumulative report. First verify its usage over a representative window and confirm it isn’t supporting a constraint or infrequent critical workflow.
The duplicate-index findings included these pairs: hq_crm_marketing_visitor_sessions_session_id_key / idx_hq_crm_mkt_vis_session_id, idx_gc_tenant_cust / idx_gift_cards_customer, idx_inv_stock_tr_branch / idx_inv_stock_tr_branch_product, idx_invoice_type / idx_oim_t_type, idx_history_action_type / idx_history_tenant_action, idx_order_items_tenant / idx_org_items_tenant, idx_orders_status / idx_org_orders_status, idx_org_orders_mst_idempotency_key / uq_org_orders_mst_idempotency_key, sys_auth_permissions_code_key / sys_auth_permissions_pkey, sys_auth_roles_code_key / sys_auth_roles_pkey, and idx_currency_iso_numeric / idx_sys_currency_cd_iso_numeric_code. Preserve primary-key and uniqueness enforcement; inspect the constraints before considering any removal. See the duplicate-index remediation(https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).

6. Treat the security findings as a separate priority
The refreshed Security Advisor reports 181 public tables without RLS; an earlier schema scan reported 192, so reconcile the inventory. It also reports 22 RLS-enabled tables without policies, one table with a policy but RLS disabled, seven SECURITY DEFINER views, 170 functions with a mutable search_path, and 102 SECURITY DEFINER functions executable by anon plus 103 executable by authenticated. The advisors additionally flag leaked-password protection and MFA configuration.

Safe RLS/function review process
Classify each table as an intentionally public reference table, tenant data, user-private data, or service/HQ-only data.
For each table, inspect grants and existing policies; then enable RLS and define the appropriate policies as part of the same controlled change.
Test access as anon, authenticated, and service_role. Enabling RLS without policies blocks API access for non-bypass roles, so don’t blanket-enable the 181 tables.
Specifically, sys_stng_profile_values_dtl has an authenticated-read policy but RLS is disabled, so that policy currently does not enforce row access.
Review SECURITY DEFINER function grants by exact function signature. Revoke anon/authenticated access only where it is unintended; some RPCs may be intentional application entry points. Pay particular attention to migration, cleanup, job-trigger, and user/tenant-management functions.
Review SECURITY DEFINER views for whether they should use invoker security or have more restrictive access. For SECURITY DEFINER functions, set a safe search_path or schema-qualify referenced objects after reviewing behavior.
A representative statement to enable RLS is:

ALTER TABLE public.sys_otp_codes ENABLE ROW LEVEL SECURITY;
Run the query to see results

Do not run it by itself or apply it as a blanket script. Confirm the intended policies and API grants first. The RLS guide(https://supabase.com/docs/guides/database/postgres/row-level-security) and Security Advisor(https://supabase.com/docs/guides/observability/advisors) provide the relevant safeguards and remediation context.

Suggested order of work
Security triage: review exposed SECURITY DEFINER RPCs and sensitive public tables.
Settings resolver: remove the per-setting lookup loop; test the partial composite index if the plan supports it.

Realtime: narrow subscriptions or evaluate Broadcast for suitable workloads.
Fresh baseline: compare CPU metrics and statement statistics over the same representative window.
Advisor cleanup: work through foreign-key indexes, RLS expression warnings, duplicate indexes, and unused indexes based on current workload evidence—not as bulk changes.
