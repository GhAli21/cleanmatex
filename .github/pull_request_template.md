## Summary

<!-- What changed and why -->

## Platform gating (when applicable)

If this PR touches permissions, navigation, feature flags, access contracts, or plan limits:

- [ ] Updated `*-access.ts` contract(s) and/or `web-admin/config/navigation.ts` (dual-write if nav changed)
- [ ] Ran `/rebuild-platform-info-inventories` (or `npm run rebuild:platform-info-inventories`)
- [ ] `npm run check:platform-info-inventories` passes (no new drift outside `KNOWN_EXCEPTIONS.json`)
- [ ] DB migration for new permission codes (if any)

**Skill:** `.claude/skills/rebuild-platform-info-inventories/` · **Mode used:** refresh | repair | rebuild-all

## Tenant isolation (when applicable)

- [ ] Every `org_*` query I added/changed (Prisma, Supabase, raw SQL, joins, and INSERT/UPDATE/DELETE writes) includes `tenant_org_id` directly in the query

## Test plan

- [ ] 
