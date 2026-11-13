# Setup Health — Follow-ups for the owner

Status: [STATUS.md](STATUS.md) · QA: [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md)

| # | Item | Then |
|---|---|---|
| U1 | Run the QA guide (tenant T1–T9, HQ H1–H12), including Arabic | Report anything wrong |
| U2 | ~~Apply 0716~~ — done 2026-11-07 | — |
| U3 | ~~Apply `supabase/migrations/0717_setup_health_summary.sql` (local + remote), regenerate types + Prisma~~ — done 2026-11-07 | — |
| U5 | ~~Apply `supabase/migrations/0724_setup_health_holidays_fix_route.sql` (local + remote)~~ — done 2026-11-10, verified | Run QA H11 |
| U6 | ~~Apply 0738~~ — done 2026-11-13, verified | — |
| U7 | ~~Apply `supabase/migrations/0740_nav_arabic_labels_and_jwt_test_retired.sql`~~ — done 2026-11-14, remote menu rows verified | Run QA T14 |
| U8 | Fix the demo user name "Admin Demo Lanudry" → "Admin Demo Laundry" in the Users screen (it is one user's display name, not seed data) | — |
| U9 | Run the new browser QA: HQ H12–H21, tenant T10–T16 (sign-out, login autofill and load times need a real browser) | Report anything wrong |
| U10 | Tell the Tax and Service Speeds sessions: (a) registry v2 (0738) — a new `sys_setup_health_check_cd` row must set `ok_name` + `ok_name2` and uses `feature_flag_keys TEXT[]` (the old `feature_flag_key` column is gone); 0739 already follows this. (b) HQ `useTenantTaxSetup` now always refetches on open (one change in `platform-web/src/features/tax-setup/hooks/use-tax-setup.ts`) | — |
| U4 | Commit the Setup Health work in both repos (files listed in STATUS.md) | — |
