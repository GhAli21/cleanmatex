# Remaining work register — POS_Session_Cash_Drawer_Hardening

**Refreshed 2026-10-09 — the program is COMPLETE** (STATUS D67), and the post-program polish D68–D70 is delivered. Every open box of the plan is delivered or explicitly superseded with its reason (see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)). Nothing below blocks release.

**Migrations:** `0515`–`0562`, `0578` (POS-session least-privilege RBAC) and `0587` (POS Settings menu entry) are applied, local and remote (0578 and 0587 on 2026-10-09; the remote grants were checked against the intended matrix).

## Owner-only

1. Commit web-admin, the HQ repo (`cleanmatexsaas`) and the docs. Re-check that `web-admin/prisma/schema.prisma` still contains `org_cash_drawer_transit_tr` (it has reverted by itself before).
2. Restart the dev servers: web-admin (3000), HQ web (3001), HQ api (3002).
3. Run [QA_TEST_GUIDE.md](./QA_TEST_GUIDE.md) §13–§19. §18.10 now applies (0578 is live); §19 covers the POS Settings page.
4. Force-close the two historical `CLOSING` sessions (drawers ac312993 / 65546cc7) from the session page.
5. After 0578, anyone who held a `pos_session:*` permission only through the old over-grant lost it on next sign-in. If a role needs one back, say which role and permission; it is a one-row change in a new migration.

## Optional follow-ups

1. `(tenant_org_id, closed_at)` index on `org_cash_drawer_sessions_mst` when a tenant exceeds ~100k drawer sessions (variance report date filter).
2. `PATCH /api/v1/branches/[id]` pricing-mode fields have no permission check (pre-existing; only `timezone_code` is gated).
3. Human-sequential POS `session_no` (needs a per-tenant per-day counter) — deliberately not built.
4. Partial receipt of an in-transit transfer — deliberately out of scope (a shortage is a destination variance).
5. Global date display now follows the tenant timezone; any remaining hard-coded `Asia/Muscat` strings are sample data in registration/settings forms and Storybook.
6. **Z-report archive has no sidebar entry** — it is reached by a button on POS Sessions. A menu item needs `config/navigation.ts` plus a `sys_components_cd` migration.
7. **POS Settings reuses `cash_control:view` / `cash_control:manage`.** A dedicated `pos_settings:*` permission pair would let a role edit one page but not the other; it needs a permissions migration and a role matrix, so it is only worth doing if an owner asks for that split.
8. **Tenant-wide only.** The resolver supports BRANCH / USER / DRAWER overrides of the POS-session settings, but only the tenant level has a screen (drawer overrides exist on the drawer Policy tab). A branch-level override screen is a separate pass (STATUS D19).
9. **Dead switch on Cash Control Settings:** `cashDropRequiresDest` ("cash drop requires a destination") is still saved and shown, but the database marks `cash_drop_requires_dest` deprecated (migration 0528) and no service reads it — custody transactions always name a destination. Hide the switch (or drop the column in a new migration) so users are not offered a setting that does nothing.

## HQ repo (`cleanmatexsaas`) — not part of this program's tenant work

- `system-codes/code-locking.service.ts` uses a table that does not exist (`hq_code_locks`); the lock feature of the generic system-codes module has no table (a tenant-repo migration would be needed if it is wanted).
- The generic system-codes registry still lists code tables that no longer exist (`sys_billing_cycle_cd`, `sys_garment_type_cd`, …).
- The old payment-setup cash-drawer table, two hooks and two list endpoints are used only by the route-less `PaymentSetupScreen`; delete them together if that screen is retired. See `docs/features/Cash_Pos_Catalogs/progress_status.md`.
