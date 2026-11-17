# Future check

**Owner decision:** 17 Nov 2026. These items are out of Phase 0. Phase 0 is GO without them.

| Item | When | What to do |
|---|---|---|
| Leaked-password protection | After the Supabase subscription is upgraded to Pro | In the Supabase Auth dashboard, turn on leaked-password protection. It checks new passwords against HaveIBeenPwned. Secure password change (S5) stays not needed. The switch is not stored in `auth.instances`. |
| S12 Arabic review of the security screens | Before public launch, when a native reviewer is available | A native speaker reviews the Arabic copy of the security screens. See file 12, Q19. Code cannot close this. |

Also watch, and do not treat as a Phase 0 failure: 24 `supabase_admin` default grants in `public` still allow `anon` and `authenticated` on objects that role creates later (for example a table made in the dashboard Table Editor). Migrations run as `postgres`, and those defaults are already closed. The SQL editor cannot become `supabase_admin`. `scripts/db/check-s0-privileges.sql` reports that count and does not fail the session for it. Run `scripts/db/s0-supabase-admin-default-privileges.sql` if Supabase later provides that role.
