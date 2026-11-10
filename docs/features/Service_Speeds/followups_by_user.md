# Service Speeds — Owner Follow-ups

Actions only the owner can do. Engineering state lives in [STATUS.md](STATUS.md).

| # | Action | Why | Since |
|---|---|---|---|
| F1 | Review every `sys_public_holidays_cf` row with `is_estimated = true` (all Islamic holidays 2026–2027 for OM, SA, AE, BH, QA, KW) once official announcements are out; HQ "mark confirmed" arrives in S5. | Only secondary sources were found; they disagree by 1–2 days. | 2026-11-07 |
| F2 | Confirm Oman National Day dates (seeded 20–21 Nov, estimated) and whether Accession Day (11 Jan) is a holiday (not seeded). | Sources disagree (18 / 20 / 25 Nov). | 2026-11-07 |
| F3 | Note the behaviour change: with a calendar, product/category turnaround hours count as working hours inside opening hours. | Ready-by times for orders near closing move to the next opening. | 2026-11-07 |
| F4 | Commit the Service Speeds work when S-steps are reviewed. | Owner commits. | 2026-11-07 |
| F5 | Run [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) on a demo organization (EN and AR). | No screen has been opened in a browser yet. | 2026-11-08 |
| F6 | Apply `0723_retire_category_express_hours.sql` (local + remote), then Prisma pull + types in both repos. Until then, organizations with no EXPRESS rule do not see Express. | Drops `sys_service_category_cd.turnaround_hh_express`. | 2026-11-09 |
| F7 | Decide whether to fund a public customer quote API, so the customer app can show price and ready time per speed before booking. | Today the customer sees the server's result only after booking. | 2026-11-10 |
