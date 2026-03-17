---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# Customer/Order/Item/Pieces Preferences — Implementation Requirements

Feature implementation checklist per PRD rules.

## Permissions

- Existing: `orders:service_prefs_view`, `orders:service_prefs_edit`, `config:preferences_manage`, `customers:preferences_manage`
- No new permissions for unified preferences

## Navigation Tree

- No new screens; preferences UI is within New Order (Order Details tab) and Edit Order
- Customer/Order/Item/Pieces panel: bottom-left of New Order screen

## Tenant Settings

- Existing SERVICE_PREF category settings unchanged
- No new tenant settings for unified model

## Feature Flags

- **`item_conditions_colors_enabled`** (default: true) — Enables conditions and colors in unified catalog and UI
- Migration 0168 seeds this flag

## Plan Limits

- N/A; available to plans that have service preferences enabled

## i18n Keys

| Key | EN | AR |
|-----|----|----|
| `newOrder.preferences.quickApply` | Quick Apply | تطبيق سريع |
| `newOrder.preferences.servicePrefs` | Service preferences | تفضيلات الخدمة |
| `newOrder.preferences.servicePrefsDesc` | Processing options: starch, perfume, delicate, etc. | خيارات المعالجة: النشا، العطر، العناية الخاصة، إلخ. |
| `newOrder.notesPalette.customerOrderItemPiecesPreferences` | Customer/Order/Item/Pieces Preferences | تفضيلات العميل/الطلب/العنصر/القطع |

## API Routes

- No new routes; existing order item/piece service-prefs and preference resolution endpoints use `org_order_preferences_dtl`

## Migrations

- **0165** — Extend sys_service_preference_cd, org_service_preference_cf
- **0166** — Create org_order_preferences_dtl; migrate and drop old tables
- **0167** — org_order_item_pieces_dtl.color to JSONB
- **0168** — Feature flag item_conditions_colors_enabled
- **0169** — Update get_last_order_preferences, suggest_preferences_from_history

## Constants & Types

- `lib/types/service-preferences.ts` — OrderItemServicePref, etc.
- `new-order-types.ts` — PreSubmissionPiece.conditions, OrderItem.servicePrefs
- database.ts, Prisma schema — org_order_preferences_dtl Row/Insert/Update

## Environment Variables

- N/A
