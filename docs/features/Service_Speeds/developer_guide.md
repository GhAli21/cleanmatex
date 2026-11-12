# Service Speeds — Developer Guide

Back to [README.md](README.md). Plan and decisions: [PLAN.md](PLAN.md).

## How it works

1. **Facts, once per request** — `lib/services/commercial/commercial-context.loader.ts` (and the Edit loader) read speeds, active speed rules, category hours (`sys_service_category_cd.turnaround_hh`), the calendar (branch → organization per field) and the holidays in the date window. Every `org_*` query filters `tenant_org_id`.
2. **Pure engine** — `lib/commercial/`:
   - `speed.ts`: rank by `display_order`; discounts only below STANDARD, floored at 0 (`SPEED_DISCOUNT_EXCEEDS_PRICE` refused at rule save).
   - `calendar.ts`: `resolveCalendar`, `nextOpening`, `addWorkingMinutes`, `addWorkingDays`, timezone from `timezone_code` (branch → organization).
   - `ready-by.ts`: start = drop-off local time; after cut-off or closed → next opening; `HOURS` adds working minutes; `WORKING_DAYS` N = Nth working day at `ready_time`; line = max of pieces, order = max of lines. No calendar → clock hours + `CALENDAR_NOT_CONFIGURED` note.
3. **Turnaround ladder** — rule hours → category `turnaround_hh` → platform default (any speed; the old `turnaround_hh_express` column is gone since 0721).
4. **Offered speeds (D5)** — STANDARD always; any other speed needs an active rule reaching the product, else `SPEED_NOT_OFFERED`. `service-speed-lookup.service.ts` marks `is_offered` for menus.
5. **Header speed (D6)** — fastest line/piece; split orders use `subOrderServiceSpeed` in `order-split.service.ts`.
6. **Money** — the client never computes speed prices: the cart quote `POST /api/v1/orders/quote` returns server figures (and `timezone`). See `/order-fin`.

## API

| Method | Route | Permission |
|---|---|---|
| GET / PUT | `/api/v1/settings/calendar` | `settings:read` / `settings:organization` |
| GET / PUT | `/api/v1/settings/branches/[id]/calendar` | `branches:read` / `branches:settings` |
| GET / POST | `/api/v1/settings/holidays` · PUT / DELETE `/api/v1/settings/holidays/[id]` | `settings:read` / `settings:organization` |
| GET | `/api/v1/lookups/service-speeds` | signed-in |
| CRUD | `/api/v1/catalog/speed-rules` (+ `/[id]`, `/bulk`, `/bulk-status`, `/resolve`) | `pricing:*` |
| GET | `/api/v1/public/customer/booking` → `serviceSpeeds` (offered only) | customer session |
| HQ GET | `/tenants/:id/calendar?year=` (read-only) | HQ identity |
| HQ CRUD | code tables `calendar-templates`, `public-holidays` | HQ `catalog.view` / `catalog.manage` |

Errors use `{ success:false, error:{ code, messageKey } }`; codes `SPEED_NOT_OFFERED`, `SPEED_DISCOUNT_EXCEEDS_PRICE`, `CALENDAR_INVALID_HOURS`, `HOLIDAY_DUPLICATE`.

## Files

| Where | Files |
|---|---|
| Engine | `web-admin/lib/commercial/{speed,calendar,ready-by}.ts` |
| Services | `lib/services/commercial/commercial-context.loader.ts`, `lib/services/settings/business-calendar.service.ts`, `lib/services/lookups/service-speed-lookup.service.ts`, `lib/services/order-split.service.ts` |
| Tenant UI | `src/features/settings/calendar/**`, `src/features/orders/hooks/use-speed-option-previews.ts`, `service-speed-select.tsx`, Speed Pricing `speed-rule-*` |
| HQ API | `platform-api/src/modules/products-items-config/code-tables/*` (registry entries, field types `time`/`date`/`weekHours`), `modules/tenants/tenants.service.ts` (`calendarDefaults`, `getCalendar`) |
| HQ web | `platform-web/src/features/products-items-config/ui/pic-week-hours-control.tsx`, `src/features/tenants/ui/tenant-calendar-screen.tsx` |
| Mobile | `mobile_domain/.../booking_service_speed_model.dart`, `order_booking_service.dart`, customer_app booking step 3 |
| i18n | tenant `settings.json › calendar`, `catalog.json`, `newOrder/serviceSpeed.json`; HQ `tenants/calendar.json`, `productsItemsConfig/*`; glossary `cutoff_time`, `ready_time`, `working_day` |

## Add a speed

Insert a `sys_service_speed_cd` row with its `display_order` (rank) in a new migration; add Speed Pricing rules for organizations that should offer it. No code change: menus, the engine and the customer app read the list.

## Tests

`__tests__/commercial/*` (ready-by vectors: cut-off, closed day, holiday, short day, weekend, timezone, fallback), `__tests__/services/commercial/*`, `__tests__/services/lookups/service-speed-lookup.test.ts`, `__tests__/features/settings/calendar-form-model.test.ts`, `__tests__/features/orders/use-speed-option-previews.test.tsx`; HQ `code-tables.calendars.spec.ts`, tenants create spec.
