# Edit Order Feature

**Version:** 1.0
**Status:** ✅ Phase 1 & 2 Complete - Ready for QA Testing
**Last Updated:** 2026-03-07

---

## Overview

The Edit Order feature allows authorized users to modify orders that haven't started processing. This includes updating customer information, items, quantities, services, and pricing for orders in DRAFT, INTAKE, or PREPARATION status.

### Key Capabilities

- **Smart Editability:** Only allows editing orders in early statuses before processing begins
- **Concurrent Edit Prevention:** Pessimistic locking with 30-minute TTL prevents conflicts
- **Complete Audit Trail:** Captures before/after snapshots with detailed change tracking
- **Multi-Level Control:** Global, tenant, and branch-level feature flags
- **Bilingual Support:** Full EN/AR interface with RTL support
- **Optimistic Locking:** Detects concurrent changes even without lock

---

## Quick Start

### Prerequisites

1. **Database Migrations Applied:**
   ```bash
   # Check migrations exist
   ls ../../../supabase/migrations/0126_order_edit_locks.sql
   ls ../../../supabase/migrations/0127_order_edit_history.sql
   ls ../../../supabase/migrations/0128_order_edit_settings.sql

   # Apply if needed (confirm with user first!)
   npx supabase migration up
   ```

2. **Environment Variables:**
   ```bash
   # .env.local
   FEATURE_EDIT_ORDER_ENABLED=true
   ```

3. **Tenant Settings:**
   ```sql
   -- Enable for specific tenant
   UPDATE sys_tenant_settings
   SET setting_value = 'true'
   WHERE setting_key = 'ALLOW_EDIT_ORDER_ENABLED'
   AND tenant_org_id = 'your-tenant-id';
   ```

4. **Branch Settings (optional):**
   ```sql
   -- Enable for specific branch
   UPDATE sys_branches_mst
   SET allow_order_edit = true
   WHERE id = 'branch-id';
   ```

### User Workflow

1. **Navigate to Orders:**
   - Go to `/dashboard/orders`
   - Find an order with status: DRAFT, INTAKE, or PREPARATION

2. **Click Edit Order:**
   - Blue "Edit Order" button appears in Order Actions panel
   - System checks editability and acquires lock

3. **Make Changes:**
   - Update customer details, items, services, pricing
   - Form pre-filled with current order data

4. **Save Changes:**
   - Click "Save Changes" button
   - System validates, saves, and creates audit record
   - Lock automatically released

---

## Business Rules

### Editable Orders

An order can be edited when **ALL** conditions are met:

1. **Status:** DRAFT, INTAKE, or PREPARATION
2. **Preparation Not Complete:** If status is PREPARATION, `preparation_status != 'completed'`
3. **Not Split:** Order is not split (`has_split = false` AND `order_subtype != 'split_child'`)
4. **Not Closed Retail:** If retail order, status must not be CLOSED
5. **Feature Enabled:** All three feature flags must be TRUE:
   - Global: `FEATURE_EDIT_ORDER_ENABLED=true`
   - Tenant: `ALLOW_EDIT_ORDER_ENABLED='true'`
   - Branch: `allow_order_edit=true` (or NULL if branch-level control not used)

### Non-Editable Orders

Orders cannot be edited if:
- Status is SORTING, WASHING, DRYING, FINISHING, ASSEMBLY, QA, PACKING, READY, OUT_FOR_DELIVERY, DELIVERED, or CLOSED
- Preparation is completed (`preparation_status = 'completed'`)
- Order has been split (`has_split = true`)
- Order is a split child (`order_subtype = 'split_child'`)
- Retail order in CLOSED status
- Currently locked by another user

---

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│          Frontend (Next.js 15)              │
├─────────────────────────────────────────────┤
│ • Edit Order Button (order-actions.tsx)    │
│ • Edit Order Page (/[id]/edit/page.tsx)    │
│ • Edit Order Screen (edit-order-screen.tsx)│
│ • State Management (new-order-reducer.ts)  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           API Layer (Next.js)               │
├─────────────────────────────────────────────┤
│ • PATCH /api/v1/orders/[id]/update          │
│ • GET /api/v1/orders/[id]/editability       │
│ • POST /api/v1/orders/[id]/lock             │
│ • POST /api/v1/orders/[id]/unlock           │
│ • Server Action: updateOrderAction          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Business Logic Layer                │
├─────────────────────────────────────────────┤
│ • Order Service (updateOrder)               │
│ • Order Lock Service (lock/unlock/check)   │
│ • Order Audit Service (createEditAudit)    │
│ • Editability Utility (isOrderEditable)    │
│ • Validation Schemas (Zod)                 │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│       Database (PostgreSQL + RLS)           │
├─────────────────────────────────────────────┤
│ • org_orders_mst (order data)               │
│ • org_order_items (items)                   │
│ • org_order_item_pieces (pieces)            │
│ • org_order_edit_locks (locking)            │
│ • org_order_edit_history (audit)            │
│ • sys_tenant_settings (feature flags)       │
│ • sys_branches_mst (branch flags)           │
└─────────────────────────────────────────────┘
```

### Data Flow

```
1. User clicks "Edit Order"
   ↓
2. Check editability (GET /editability)
   ↓
3. Acquire lock (POST /lock) → org_order_edit_locks
   ↓
4. Load order data into form
   ↓
5. User makes changes
   ↓
6. Click "Save Changes"
   ↓
7. Validate input (Zod schema)
   ↓
8. Create before snapshot
   ↓
9. Update order in transaction
   ↓
10. Create after snapshot
    ↓
11. Generate change diff
    ↓
12. Save audit record → org_order_edit_history
    ↓
13. Release lock → DELETE from org_order_edit_locks
    ↓
14. Redirect to order detail
```

---

## Documentation Index

### For Users
- **[User Guide](./edit_order_user_guide.md)** *(future)* - How to edit orders
- **[FAQ](./edit_order_faq.md)** *(future)* - Common questions

### For Developers
- **[Implementation Guide](./edit_order_implementation.md)** - Complete technical documentation
- **[Developer Guide](./edit_order_developer_guide.md)** *(this could be created)* - Quick reference
- **[API Reference](./edit_order_api.md)** *(future)* - API endpoints and schemas
- **[Test Plan](./EDIT_ORDER_TEST_PLAN.md)** - QA test cases

### For Product/Project Managers
- **[Status Report](./STATUS.md)** - Current implementation status
- **[Future Enhancements](./FUTURE_ENHANCEMENTS.md)** - Planned improvements
- **[PRD](./edit_order_prd.md)** *(future)* - Product requirements

---

## Key Files

### Backend
- `web-admin/lib/services/order-service.ts` - Order update logic
- `web-admin/lib/services/order-lock.service.ts` - Lock management
- `web-admin/lib/services/order-audit.service.ts` - Audit trail
- `web-admin/lib/utils/order-editability.ts` - Business rules
- `web-admin/lib/validations/edit-order-schemas.ts` - Input validation

### Frontend
- `web-admin/app/dashboard/orders/[id]/edit/page.tsx` - Edit page
- `web-admin/src/features/orders/ui/edit-order-screen.tsx` - Edit screen
- `web-admin/src/features/orders/ui/order-actions.tsx` - Edit button
- `web-admin/src/features/orders/hooks/use-order-submission.ts` - Save handler
- `web-admin/src/features/orders/model/new-order-types.ts` - State types
- `web-admin/src/features/orders/ui/context/new-order-reducer.ts` - State reducer

### API
- `web-admin/app/api/v1/orders/[id]/update/route.ts` - Update endpoint
- `web-admin/app/api/v1/orders/[id]/lock/route.ts` - Lock endpoint
- `web-admin/app/api/v1/orders/[id]/unlock/route.ts` - Unlock endpoint
- `web-admin/app/api/v1/orders/[id]/editability/route.ts` - Editability check
- `web-admin/app/actions/orders/update-order.ts` - Server action

### Database
- `supabase/migrations/0126_order_edit_locks.sql` - Lock table
- `supabase/migrations/0127_order_edit_history.sql` - Audit table
- `supabase/migrations/0128_order_edit_settings.sql` - Feature flags

### i18n
- `web-admin/messages/en.json` - English translations
- `web-admin/messages/ar.json` - Arabic translations

---

## Testing

### Manual Testing

Follow the [Test Plan](./EDIT_ORDER_TEST_PLAN.md) which includes:
- 14 comprehensive test cases
- Feature flag testing at all levels
- Lock management and conflict scenarios
- Audit trail verification
- Bilingual support testing
- Edge cases and error handling

### Quick Smoke Test

```bash
# 1. Start development server
cd web-admin
npm run dev

# 2. Navigate to orders list
# Open: http://localhost:3000/dashboard/orders

# 3. Find a DRAFT/INTAKE order
# Click "Edit Order" button

# 4. Make changes and save
# Verify success message and redirect

# 5. Check audit history
# SQL: SELECT * FROM org_order_edit_history WHERE order_id = 'order-id';
```

---

## Support & Troubleshooting

### Common Issues

**Edit button not showing?**
- Check order status (must be DRAFT/INTAKE/PREPARATION)
- Verify feature flags enabled at all levels
- Check user permissions (`orders:update`)

**Lock conflicts?**
- Wait for lock to expire (30 minutes)
- Admin can force unlock via database
- Check for stale locks: `SELECT * FROM org_order_edit_locks WHERE expires_at < NOW();`

**Changes not saving?**
- Check browser console for validation errors
- Verify network requests in DevTools
- Check server logs for error details

### Database Queries

```sql
-- Check feature flag status
SELECT * FROM get_order_edit_feature_status('tenant-id', 'branch-id');

-- View active locks
SELECT * FROM org_order_edit_locks WHERE expires_at > NOW();

-- View edit history for an order
SELECT * FROM org_order_edit_history WHERE order_id = 'order-id' ORDER BY edit_number DESC;

-- Clean up expired locks manually
SELECT cleanup_expired_order_edit_locks();
```

---

## Project Context

- **Codebase:** CleanMateX - Multi-Tenant Laundry SaaS Platform
- **Region:** GCC region (EN/AR bilingual)
- **Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase, PostgreSQL
- **Feature Category:** Order Management
- **Related Features:** Cancel Order, Return Order, Split Order

---

## Contact & Resources

- **Plan Document:** `C:\Users\Administrator\.claude\plans\misty-sparking-ritchie.md`
- **Handoff Document:** `.claude/handoff-edit-order-implementation.md`
- **GitHub Issues:** Report bugs or request features
- **CLAUDE.md:** Project-wide guidelines and conventions

---

**Next Steps:** See [STATUS.md](./STATUS.md) for current implementation status and remaining work.