# Service Speeds & Ready-By Calendar

How fast an order is done (Economy, Standard, Next day, Express, Urgent), what each speed costs, and when the order is ready, counted on the organization's working calendar.

**Version:** 1.0.0 (2026-11-10) · **Status:** engineering done, owner QA pending — see [STATUS.md](STATUS.md)

| Doc | For |
|---|---|
| [PLAN.md](PLAN.md) | Approved plan and decisions D1–D10 |
| [STATUS.md](STATUS.md) | Step-by-step progress, checks, log (authoritative) |
| [developer_guide.md](developer_guide.md) | How it works, files, API, tests |
| [user_guide.md](user_guide.md) | Organization admins and HQ staff (EN / AR) |
| [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) | Manual test scenarios |
| [followups_by_user.md](followups_by_user.md) | Owner actions |
| [CHANGELOG.md](CHANGELOG.md) | Changes per version |

## At a glance

| Area | What |
|---|---|
| Speeds | `sys_service_speed_cd`, ranked by `display_order` (ECONOMY 1 … URGENT 5). STANDARD is always offered; any other speed only where an active Speed Pricing rule reaches the product. A slower-than-Standard speed may carry a discount |
| Pricing | `org_speed_price_rules_cf` (Catalog › **Speed Pricing**): premium or discount (amount, multiplier, fixed price) and turnaround (hours or working days) per organization / branch / category / product |
| Calendar | Organization and branch opening hours, cut-off time, ready time (typed columns on `org_tenants_mst` / `org_branches_mst`); holidays in `org_holidays_cf`; HQ public holidays `sys_public_holidays_cf` and country templates `sys_calendar_templates_mst` |
| Ready-by | Counted in working time from drop-off; holidays skipped; header speed = fastest line |
| Screens | Tenant: Settings › **Business Calendar** `/dashboard/settings/calendar`, Catalog › Speed Pricing, speed menu in New Order with price/ready-by preview · HQ: Products & Items Config › **Calendars**, Organization workspace › **Calendar** · Customer app: speed choice in the booking schedule step |
| Permissions | No new codes: `settings:read` / `settings:organization`, `branches:read` / `branches:settings`, `pricing:*` |
| Settings / flags | None. No `sys_stng_*`: every value is a typed column (D10). No feature flag, no plan limit |
| Migrations | `0707` speed columns · `0711` calendar + holidays + nav · `0720` seeder units + samples · `0721` category Express hours → rules, column dropped |
