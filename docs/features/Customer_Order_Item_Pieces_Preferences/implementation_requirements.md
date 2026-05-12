---
version: v1.3.0
last_updated: 2026-05-12
author: CleanMateX Team
---

# Customer/Order/Item/Pieces Preferences — Implementation Requirements

Feature implementation checklist per PRD rules. **Runtime architecture** (tables, owner/source fields, APIs): [preferences-architecture-reference.md](../../dev/preferences-architecture-reference.md).

**Preparation / workflow piece prefs (completed 2026-05-12):** see [preparation-workflow-ui-status.md](./preparation-workflow-ui-status.md).

## Permissions

- Existing: `orders:service_prefs_view`, `orders:service_prefs_edit`, `config:preferences_manage`, `customers:preferences_manage`
- Piece-level edits on existing orders use **`orders:read`** / **`orders:update`** (and related order routes) — see `docs/platform/permissions/PERMISSIONS_BY_API.md` (piece PATCH, piece service-prefs, **piece conditions POST**).

## Navigation Tree

- No new **top-level** nav entries for unified prefs; preferences UI is within New Order (Order Details tab) and Edit Order
- **Preparation** (`/dashboard/preparation`, `/dashboard/preparation/[orderId]`): itemization + **piece preferences editor** (service, packing, conditions) aligned with DTL; contract-linked APIs documented under `orders-access` preparation details
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

- **Existing** order item/piece **service-prefs** and preference resolution endpoints use `org_order_preferences_dtl`
- **`POST /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions`** — replace piece condition rows (stain/damage/special UI codes → DTL); requires `orders:update`
- **`PATCH /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]`** — when body includes **`packing_pref_code`** (and optional **`packing_pref_cf_id`**), server syncs **PIECE** **`packing_prefs`** rows in **`org_order_preferences_dtl`** via `OrderPiecePreferenceService.replacePiecePacking` (canonical packing facts; piece row column updated for denormalization)
- **`GET /api/v1/preferences/last-order`** response shape includes optional catalog FK fields after RPC migration **0260** (`packing_pref_cf_id`, `service_prefs_catalog`)

## Migrations

- **0165** — Extend sys_service_preference_cd, org_service_preference_cf
- **0166** — Create org_order_preferences_dtl; migrate and drop old tables
- **0167** — org_order_item_pieces_dtl.color to JSONB
- **0168** — Feature flag item_conditions_colors_enabled
- **0169** — Update get_last_order_preferences, suggest_preferences_from_history
- **0260** — `get_last_order_preferences` adds `packing_pref_cf_id` + `service_prefs_catalog` (Repeat Last Order → `preference_id` alignment). See `docs/dev/preferences-architecture-reference.md` §8.4 (UI surcharge parity for packing/service: §8.3).

## Constants & Types

- `lib/types/service-preferences.ts` — OrderItemServicePref, etc.
- `new-order-types.ts` — PreSubmissionPiece.conditions, OrderItem.servicePrefs
- database.ts, Prisma schema — org_order_preferences_dtl Row/Insert/Update

## Environment Variables

- N/A
