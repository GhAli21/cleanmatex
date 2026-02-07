---
version: v1.0.0
last_updated: 2026-02-07
author: CleanMateX AI Assistant
---

# Inventory Stock Management

Real-time tracking of retail and consumable items for laundry operations.

## Quick Links

- [Full Feature Documentation](./inventory_stock_management.md) -- comprehensive technical and user-facing documentation
- [Changelog](./CHANGELOG.md) -- version history
- [Current Status](./current_status.md) -- implementation state

## What It Does

- Track stock levels for detergents, hangers, bags, packaging, and other consumables
- 4 KPI dashboard cards: Total Items, Low Stock alerts, Out of Stock alerts, Total Stock Value
- Add, edit, and soft-delete inventory items with bilingual names (EN/AR)
- Adjust stock quantities (increase, decrease, or set) with mandatory reason logging
- View per-item transaction history with before/after snapshots
- Search by name, code, or SKU with filters for stock status and active state

## Access

```
Sidebar --> Inventory & Machines --> Stock
URL: /dashboard/inventory/stock
Roles: admin, operator
```

## Key Files

| File | Purpose |
|---|---|
| `supabase/migrations/0101_inventory_stock_management.sql` | Database migration |
| `web-admin/lib/constants/inventory.ts` | Constants and helpers |
| `web-admin/lib/types/inventory.ts` | TypeScript interfaces |
| `web-admin/lib/services/inventory-service.ts` | Service layer |
| `web-admin/app/actions/inventory/inventory-actions.ts` | Server actions |
| `web-admin/app/dashboard/inventory/stock/page.tsx` | Main listing page |
| `web-admin/app/dashboard/inventory/stock/components/` | UI modal components |
