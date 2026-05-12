---
version: v1.0.0
last_updated: 2026-05-12
status: completed
author: CleanMateX Team
---

# Preparation & workflow piece UI — plan status

Tracks delivery of **production-ready** preparation and cross-workflow **piece** UX aligned with unified preferences (**`org_order_preferences_dtl`**).

**Source plan (Cursor, marked completed 2026-05-12):** `.cursor/plans/preparation_page_enhancements_55dac9be.plan.md`

## Plan summary

| Area | Status | Notes |
|------|--------|--------|
| Nav: `/dashboard` hub vs child routes | Done | `isPathActive` — `/dashboard` matches only exact path; sidebar children use `isPathActive` for deep links (e.g. `/dashboard/preparation/:id`). |
| Piece list API parity | Done | `OrderPieceService.getPiecesByItem` enriches pieces with DTL-backed prefs (same pattern as `getPiecesByOrder`). |
| Editable piece prefs (preparation / workflow) | Done | Dialog: service prefs (existing APIs), packing (**PATCH piece** → `OrderPiecePreferenceService.replacePiecePacking` → DTL `packing_prefs` + denormalized `packing_pref_code`), conditions (**POST** `.../pieces/[pieceId]/conditions`). |
| Price preview refresh | Done | `FastItemizer` / `ItemList` bump `PricePreview` via `refreshNonce` after items or piece/pref changes. |
| Preparation list | Done | Debounced search, sort (`useScreenOrders`), Cmx inputs/pagination. |
| Preparation detail | Done | Order summary strip; `branch_id` passed into itemizer / piece tree. |
| Workflow screens + `OrderPiecesManager` | Done | Processing, assembly, QA, packing, ready: normalized **`GET /orders/[id]/state`** (`getOrderFromStateResponse`), **`branchId`**, compact density; QA/processing bulk where editable. |
| Permissions docs | Done | `PERMISSIONS_BY_API` (piece PATCH packing DTL, conditions POST), `all_contract-aligned_UI_Permissions`, `PERMISSIONS_BY_SCREEN` representative row. |
| Automated tests | Partial | `isPathActive`, `order-state-response` helpers covered; optional: service-level tests for `replacePiecePacking`, conditions route. |

## Key implementation references (web-admin)

- **Packing DTL:** `lib/services/order-piece-preference.service.ts` — `replacePiecePacking`
- **Piece update orchestration:** `lib/services/order-piece-service.ts` — `updatePiece` (packing fields)
- **Conditions API:** `app/api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/conditions/route.ts`
- **State JSON helper:** `lib/utils/order-state-response.ts`
- **Piece prefs UI:** `src/features/orders/ui/piece-preferences-editor-dialog.tsx`, `PieceCard.tsx`, `PieceList.tsx`, `OrderPiecesManager.tsx`
- **Preparation:** `app/dashboard/preparation/page.tsx`, `[orderId]/page.tsx`; `FastItemizer`, `ItemList` (workflow)

## Canonical architecture

All preference **facts** remain in **`org_order_preferences_dtl`** per [preferences-architecture-reference.md](../../dev/preferences-architecture-reference.md). Piece-row **`packing_pref_code`** is **denormalized** for legacy/operational screens; **writes** go through **`replacePiecePacking`** when updating via the piece PATCH API.

## Optional follow-ups

- Extend Jest coverage to `replacePiecePacking` and piece list enrichment.
- Add E2E for preparation prefs save + preview refresh.
- Stricter **page-level** permission gates for preparation (product decision; APIs already enforce `orders:read` / `orders:update`).
