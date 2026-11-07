# Service Speeds & Ready-By Calendar — Plan

**Status:** APPROVED by owner ("all approved", 2026-11-07) — implementation authorised in program order: Service Speeds S1–S7 → Setup Health → Tax Engine T0–T9
**Program:** 1st of Speeds → Setup Health → Tax Engine ([order](../Tax_Config/TAX_ENGINE_PLAN.md#0-program-order))
**Builds on:** [Line-Level Money Snapshot](../Order_Fin/Line_Level_Money_Snapshot/README.md) (`lib/commercial/speed.ts`, `ready-by.ts`, Speed Pricing)
**Rules:** `order-fin-rules.md` · `no-silent-money-mutation.md` · `cmx-message.md` · `cmx-shared-components.md`

## 1. Decisions (owner, 2026-11-07)

| # | Decision |
|---|---|
| D1 | Platform speeds `ECONOMY`, `STANDARD`, `NEXT_DAY`, `EXPRESS`, `URGENT` |
| D2 | Codes/names = platform (`sys_service_speed_cd`); surcharge + turnaround = each organization's Speed Pricing rules |
| D3 | No constant per speed; `SERVICE_SPEEDS` keeps `STANDARD` (no premium) and `EXPRESS` (legacy) only |
| D4 | Cut-off time, ready time, business hours on organization and branch; branch NULL = organization's |
| D5 | A speed is offered only when the organization has an active rule for it (STANDARD always) |
| D6 | Order header speed = fastest line speed (rank = `display_order`) |
| D7 | Names EN / AR: Economy / اقتصادي · Standard / عادي · Next day / اليوم التالي · Express / مستعجل · Urgent / طارئ |
| D8 | Minimum urgent charge: later |
| D9 | Daily urgent capacity per branch: later |
| D10 | HQ keeps a default calendar per country; the tenant's starter package (settings profile, `CALENDAR_TEMPLATE_CODE`) selects it at onboarding |

### Country calendars (HQ-owned, D10)

| Object | Purpose |
|---|---|
| `sys_calendar_templates_mst` | `calendar_code` (e.g. `OM`, `SA`), country, weekly `business_hours` JSON (same shape as tenant), weekend days, default `order_cutoff_time`, `ready_time` |
| `sys_public_holidays_cf` | country, date, `name/name2`, `is_estimated` (Islamic holidays until officially announced), year; maintained by HQ yearly |
| Onboarding | copies the template's weekly hours / cut-off / ready time into the tenant (tenant may edit later) |
| Holidays | not copied: ready-by reads public holidays for the branch's country **plus** the tenant's own `org_holidays_cf`; a tenant row with `is_closed = false` on a public-holiday date means "we open that day" |
| HQ screens | Master System Codes › Calendars (templates + public holidays per year, "mark confirmed" for estimated dates); tenant workspace › tenant calendar view |
| Setup Health | `CAL_HOLIDAYS_ESTIMATED` (INFO, HQ only) when next 60 days contain unconfirmed public holidays |

## 2. Current state (verified 2026-11-07, remote DB)

- `sys_service_speed_cd`: STANDARD «عادي» (1), EXPRESS «سريع» (2).
- Lines / pieces / rules FK to `sys_service_speed_cd`; header has CHECK `oc_order_speed_ck` (STANDARD/EXPRESS).
- `org_speed_price_rules_cf`: SELL_PRICE / MULTIPLIER / FIXED_AMOUNT, `turnaround_hh_speed`, scopes product / category / branch; CHECKs forbid negative values; CHECK `service_speed <> 'STANDARD'`.
- Express-only legacy: `sys_service_category_cd.turnaround_hh_express`, product Express columns, `org_orders_mst.is_express`, Edit review label.
- `ready-by.ts`: clock hours from drop-off. `org_tenants_mst.business_hours` JSON exists; branches none; no holidays.

## 3. Business model (guidance shown in the Speed Pricing screen)

| Speed | Typical promise | Typical price | Turnaround unit |
|---|---|---|---|
| Economy | 4–7 working days | −10 to −20% | working days |
| Standard | 2–3 working days | base | working days |
| Next day | next working day | +20–30% | working days (1) |
| Express | same day if in before cut-off | +50% | working days (0) + earlier cut-off |
| Urgent | 2–4 hours | +100% | working hours |

## 4. Database (one migration, then STOP)

| Object | Change | Invariant |
|---|---|---|
| `sys_service_speed_cd` | Seed ECONOMY, NEXT_DAY, URGENT; update EXPRESS AR name; `display_order` ECONOMY 1 … URGENT 5; add `default_turnaround_unit` (guidance only) | codes never renamed |
| `org_orders_mst` | Drop CHECK `oc_order_speed_ck`; add FK `fk_oom_service_speed` → `sys_service_speed_cd(code)` | header speed is a real code |
| `org_speed_price_rules_cf` | Add `turnaround_unit` (`HOURS`/`WORKING_DAYS`, nullable), `turnaround_days_speed` SMALLINT, `cutoff_time_speed` TIME. CHECK: unit HOURS ⇔ hours set & days NULL; WORKING_DAYS ⇔ days set & hours NULL. Replace non-negative CHECKs: negative multiplier (> −1) / fixed amount / sell price below standard only when `service_speed = 'ECONOMY'` | ECONOMY can discount, no other speed can |
| `org_tenants_mst` | `order_cutoff_time` TIME, `ready_time` TIME (reuse `business_hours`) | no defaults (locale rule) |
| `org_branches_mst` | `order_cutoff_time`, `ready_time`, `business_hours` JSONB — nullable, NULL = organization's | same JSON shape as tenant (validated by CHECK on keys) |
| `org_holidays_cf` (new) | `tenant_org_id`, `branch_id` NULL (= all branches), `holiday_date`, `name/name2`, `is_closed` (false = short day), `open_time`/`close_time` (short day), audit columns; RLS; UNIQUE (tenant, branch, date) NULLS NOT DISTINCT; composite FK branch `(branch_id, tenant_org_id)` in the parent key's order | tenant isolation |
| Permissions | none new: holidays & calendar use `settings:organization` / `branches:settings`; Speed Pricing keeps `pricing:*` | — |
| Navigation | Settings › **Business Calendar** `/dashboard/settings/calendar` (`navigation.ts` + `sys_components_cd`) | dual-write |
| Comments | `COMMENT ON` every table/column/constraint/index/function | repo rule |

S4 (later migration): copy `sys_service_category_cd.turnaround_hh_express` into category-scoped EXPRESS rules per tenant, then drop the column; drop product Express columns' special handling.

## 5. Backend (tenant app)

| Area | Change |
|---|---|
| `lib/commercial/ready-by.ts` (pure) | New calendar algorithm: start = drop-off local time; after cut-off or closed → next opening; `HOURS` = add working minutes inside opening hours; `WORKING_DAYS` N = Nth working day (0 = same day) at `ready_time` (≤ closing time); skip holidays; short days honored; line = max of pieces, order = max of lines; no calendar → clock-hours fallback + `CALENDAR_NOT_CONFIGURED` note |
| `lib/commercial/calendar.ts` (new, pure) | `resolveCalendar(branch, tenant)`, `nextOpening`, `addWorkingMinutes`, `addWorkingDays`; timezone via existing `timezone_code` (branch → tenant) |
| `lib/commercial/speed.ts` | ECONOMY negative premium (line net never below 0 → `SPEED_DISCOUNT_EXCEEDS_PRICE`); `SPEED_NOT_OFFERED` when no rule matches |
| `commercial-context.loader.ts` / `commercial-edit.loader.ts` | Load calendar, holidays (date window), cut-off chain (rule → branch → tenant) once per request |
| Header writer (create, Edit apply, split) | `service_speed` = fastest line by rank; `is_express` = ≠ STANDARD |
| `service-speed-lookup.service.ts` | Return offered speeds (active rule exists) with rank, names, unit guidance; `?all=true` for Speed Pricing editor |
| `speed-rules.service.ts` + `speed-rule-schemas.ts` | New fields, ECONOMY-only negative validation, unit/value consistency |
| `lib/services/settings/business-calendar.service.ts` (new) | Get/update tenant + branch calendar fields, holidays CRUD; every query `tenant_org_id` |
| Ready-by preview | `POST /api/v1/orders/ready-by/preview` already part of quote? → reuse the quote response (`readyByAt` per line + order) — no new endpoint if quote already returns it (verify) |

## 6. APIs

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/lookups/service-speeds` (offered) | auth |
| GET/PUT | `/api/v1/settings/calendar` (organization) | `settings:read` / `settings:organization` |
| GET/PUT | `/api/v1/settings/branches/[id]/calendar` | `branches:read` / `branches:settings` |
| GET/POST | `/api/v1/settings/holidays` · PATCH/DELETE `[id]` | `settings:read` / `settings:organization` |
| existing | `/api/v1/catalog/speed-rules*` (new fields) | `pricing:*` |
| existing | customer booking `/api/v1/public/customer/booking` (offered speeds, ready-by) | public token |

Errors use the existing `{ success:false, error:{ code, messageKey } }` shape; new codes `SPEED_NOT_OFFERED`, `SPEED_DISCOUNT_EXCEEDS_PRICE`, `CALENDAR_INVALID_HOURS`, `HOLIDAY_DUPLICATE`.

## 7. Frontend (tenant app)

| Screen | Change |
|---|---|
| New Order speed picker | Offered speeds only, ordered by rank, each with surcharge preview and promised ready-by ("Ready Tue 6 PM"); disabled speeds for a line show the reason |
| Order Edit | Same picker per line/piece; label from lookup (remove hardcoded Express) |
| Speed Pricing (`/dashboard/catalog/speed-pricing`) | Turnaround unit (hours / working days), days, speed cut-off, ECONOMY discount with inline explanation (no silent money change); guidance table §3 |
| **Business Calendar** (new, `/dashboard/settings/calendar`) | Weekly hours grid (open/close/closed per day), cut-off time, ready time, holidays list (add/edit/delete, short day), branch tab "Use organization's" toggle per field; Cmx components, `cmxMessage`, EN/AR + RTL |
| Branch settings | Link "Branch calendar" → same screen with branch selected |
| Order detail / receipts / labels / tracking | Speed name from lookup, ready-by unchanged display |
| Setup Health | `CAL_NO_BUSINESS_HOURS`, `SPEED_NO_RULES` checks ([Setup Health](../Setup_Health/PLAN.md)) |

i18n: `catalog.json` (speed pricing), `settings/calendar.json` (new), `newOrder`, `orders/edit.json`; glossary terms `service_speed` (exists), `cutoff_time` «آخر وقت للاستلام», `ready_time` «وقت الجاهزية», `working_day` «يوم عمل».

## 8. HQ (`cleanmatexsaas`)

- Catalog seeders `seed_product_speed_rules`: seed sample rules for NEXT_DAY / EXPRESS / URGENT (MULTIPLIER 0.25 / 0.5 / 1.0, units per §3) on demo/new tenants; ECONOMY not seeded.
- Tenant onboarding: optional default business hours from country template (Fri/Sat weekend by country).
- System codes screen shows the new speeds (read-only, platform data).

## 9. Mobile (`cmx_mobile_apps`)

Customer app booking: offered speeds + ready-by from the server; no client math.

## 10. Phases

| Phase | Content | Gate |
|---|---|---|
| S1 | Migration §4 | STOP → owner applies → Prisma pull + types both repos |
| S2 | Pure engine (`calendar.ts`, `ready-by.ts`, `speed.ts`) + unit tests | jest |
| S3 | Loaders, writers, services, APIs + route tests | jest, tsc |
| S4 | UI: picker, Speed Pricing, Business Calendar, Edit, labels; i18n; access contracts, nav | eslint, build, check:i18n, check:ui-access-contract |
| S5 | HQ seeders + onboarding hours; mobile booking | HQ build |
| S6 | Legacy retirement migration (category express hours → rules, drop column) | STOP |
| S7 | Docs: README, developer/user guide EN/AR, QA_TEST_GUIDE, CHANGELOG, STATUS | — |

## 11. Tests

Ready-by vectors: before/after cut-off, closed day, holiday, short day, Fri/Sat weekend, hours across closing, 0 working days, timezone (Asia/Muscat, Asia/Riyadh, a DST zone), no-calendar fallback. Speed: 5-speed selection by rank, ECONOMY discount and floor at 0, not-offered refusal, header = fastest line, Edit speed change re-computes ready-by only for changed lines. DB: holidays isolation, header FK, rule CHECKs. Parity: create = quote = Edit preview (existing oracle extended).

## 12. Risks

- Ready-by changes for existing demo orders: none (recorded values are kept).
- A tenant without business hours keeps clock-hour behavior; Setup Health warns.
