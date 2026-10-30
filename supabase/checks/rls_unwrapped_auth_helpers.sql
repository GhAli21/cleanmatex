-- Read-only check: lists public RLS policies that call auth helpers without the
-- (SELECT fn()) initPlan wrapper, which can make them run once per row.
-- Must return zero rows. Rule: docs/dev/rules/performance-engineering.md §7; fix pattern: migration 0649.
WITH pat AS (
  SELECT '(?<!SELECT )\m(auth\.(?:uid|jwt|role)|(?:public\.)?(?:current_tenant_id|is_admin))\(\)'::text AS re
)
SELECT p.tablename, p.policyname, p.cmd, p.qual, p.with_check
FROM pg_policies p, pat
WHERE p.schemaname = 'public'
  AND (coalesce(p.qual, '') ~ pat.re OR coalesce(p.with_check, '') ~ pat.re)
ORDER BY p.tablename, p.policyname;
