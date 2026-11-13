# Service Speeds — Changelog

## 1.2.0 — 2026-11-14

- Business Calendar: "If an order is placed now" card (ready time per speed, per organization or branch), "Fill from the country template", and protection against two people saving at once.
- Speed Pricing: the cut-off field shows the organization's cut-off it overrides; the loader reads only rules in force today.
- HQ: bulk "mark confirmed" for one country and year of public holidays.

## 1.1.0 — 2026-11-13 (review fixes)

- Fixed: a holiday closing at 24:00 and impossible dates (30 Feb) are refused instead of failing or saving another day; a malformed stored hours value no longer stops orders; a branch with no open day inherits the organization's hours; seeded non-RFC ids (demo branches) are accepted.
- Ready-by: a faster speed is never promised slower than Standard; a speed ranked below Standard defaults to Standard's hours; rules are capped at 60 working days / 500 hours and an unreachable promise falls back to clock hours (note `CALENDAR_UNRESOLVABLE`).
- Offered speeds: `offered_scope` (ALL / SOME). The customer app lists organization-wide speeds only; staff menus mark "Some items only"; the New Order top-bar menu previews like the summary menu; the booking confirmation promises the calculated ready-by.
- Speed Pricing: bulk fixed price leaves out products priced above it and reports them; a rule that priced orders keeps its speed and scope; rule dates use the organization's time zone.
- Business Calendar: unsaved edits survive tab switches, branch switch asks first, cross-field warnings, clearer messages (EN/AR), holiday overrides marked, Branches tab needs `branches:read`.
- HQ: `weekend_days` is derived from the hours; duplicate public-holiday date shown on the date field; country normalized to upper case; year switch is race-safe.
- Setup Health (0739): `SPEED_NO_EXPRESS` (no organization-wide Express rule) and `CAL_HOLIDAYS_MISSING` (HQ only).

## 1.0.0 — 2026-11-10

- Five ranked speeds (ECONOMY … URGENT); discounts below Standard; a speed is offered only with an active Speed Pricing rule (Express included since 0721).
- Ready-by on the working calendar: opening hours, cut-off, ready time, holidays, short days, timezones; clock-hours fallback without a calendar.
- Tenant: Business Calendar screen, Speed Pricing turnaround fields and guidance, speed menu with per-speed price and ready-by preview, header speed = fastest line (also on split).
- HQ: country calendar templates and public holidays (code tables), onboarding copies the country calendar, read-only organization Calendar view.
- Customer app: speed choice in booking.
- Migrations: 0707, 0711, 0720, 0721 (`sys_service_category_cd.turnaround_hh_express` dropped; its hours moved into 0-premium category Express rules).
