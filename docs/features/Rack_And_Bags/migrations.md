# Rack & Bags Modal — Migrations

## 0497_org_orders_locker_hanging.sql

**Status:** ✅ Applied to both local and remote (2026-09-11), verified via direct read-only query on both — all 3 columns present with matching types/defaults, and `chk_hanging_count` matches the migration file exactly (`CHECK (((hanging_count IS NULL) OR (hanging_count >= 0)))`).

**Prisma follow-up:** `web-admin/prisma/schema.prisma`'s `org_orders_mst` model was missing these 3 fields even after the user ran their type-regeneration step (it regenerates the client from the existing schema file, it doesn't introspect the DB) — a prior comment in the same model (`wf_profile_version_id` etc., migration 0457) already flags this exact risk: "Prisma must know these columns or order create fails at runtime even when the DB already has them." Added the 3 fields manually (matching column types) and re-ran `npx prisma generate`; `tsc --noEmit` clean afterward.

**Table:** `org_orders_mst`

| Column | Type | Default | Constraint |
|---|---|---|---|
| `locker_location` | TEXT | — | nullable |
| `locker_code` | TEXT | — | nullable |
| `hanging_count` | INTEGER | `0` | `chk_hanging_count CHECK (hanging_count IS NULL OR hanging_count >= 0)` — no upper bound (unlike `bag_count`'s 1-100), and explicitly nullable, per owner decision |

**RLS:** No changes needed — the existing blanket `tenant_isolation_org_orders_mst` policy (`0081_comprehensive_rls_policies.sql`) already covers new columns on this table.

**Rollback note:** Not scripted in this migration. If ever needed, a follow-up migration would `ALTER TABLE org_orders_mst DROP COLUMN locker_location, DROP COLUMN locker_code, DROP COLUMN hanging_count;` (drops `chk_hanging_count` automatically with the column).
