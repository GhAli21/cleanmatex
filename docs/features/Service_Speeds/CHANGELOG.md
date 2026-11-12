# Service Speeds — Changelog

## 1.0.0 — 2026-11-10

- Five ranked speeds (ECONOMY … URGENT); discounts below Standard; a speed is offered only with an active Speed Pricing rule (Express included since 0721).
- Ready-by on the working calendar: opening hours, cut-off, ready time, holidays, short days, timezones; clock-hours fallback without a calendar.
- Tenant: Business Calendar screen, Speed Pricing turnaround fields and guidance, speed menu with per-speed price and ready-by preview, header speed = fastest line (also on split).
- HQ: country calendar templates and public holidays (code tables), onboarding copies the country calendar, read-only organization Calendar view.
- Customer app: speed choice in booking.
- Migrations: 0707, 0711, 0720, 0721 (`sys_service_category_cd.turnaround_hh_express` dropped; its hours moved into 0-premium category Express rules).
