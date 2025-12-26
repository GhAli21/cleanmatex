# PRD-004: Quick Start Guide

**Version**: 1.0
**Last Updated**: 2025-10-25

---

## Quick Reference

### What is PRD-004?
**Order Creation & Itemization** - Implement Quick Drop order intake workflow with preparation/itemization capability.

### Key Goals
- ✅ Sub-5 minute order intake
- ✅ Unique order number generation (ORD-YYYYMMDD-XXXX)
- ✅ QR code and barcode for tracking
- ✅ Flexible preparation workflow
- ✅ Automatic pricing calculation

---

## Implementation Phases (18 Days)

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1**: Database Schema | 2 days | Migration + Rollback scripts |
| **Phase 2**: Utilities & Logic | 2 days | Order number, QR/barcode, pricing |
| **Phase 3**: Backend API | 3 days | API routes + Server actions |
| **Phase 4**: Order List UI | 2 days | List, filters, search |
| **Phase 5**: Quick Drop UI | 2 days | Intake form |
| **Phase 6**: Preparation UI | 2 days | Itemization workflow |
| **Phase 7**: Photos & Labels | 1 day | Upload + printing |
| **Phase 8**: Testing | 2 days | Unit + Integration + E2E |
| **Phase 9**: Deployment | 2 days | Docs + Deploy |

---

## Getting Started

### Prerequisites
- PRD-001 (Auth) completed
- PRD-002 (Tenant) completed
- PRD-003 (Customer) completed
- Supabase Local running
- MinIO configured

### Step 1: Run Database Migration

```bash
# Navigate to project root
cd f:\jhapp\cleanmatex

# Start Supabase Local (if not running)
npx supabase start

# Create migration file
npx supabase migration new order_intake_enhancements

# Copy migration SQL from PRD-004_IMPLEMENTATION_PLAN.md
# Save to: supabase/migrations/0012_order_intake_enhancements.sql

# Run migration
npx supabase migration up

# Verify
npx supabase db diff
```

### Step 2: Install Dependencies

```bash
cd web-admin

# Install QR code and barcode libraries
npm install qrcode jsbarcode canvas
npm install --save-dev @types/qrcode @types/jsbarcode

# Install validation library
npm install zod

# Install date utilities
npm install date-fns
```

### Step 3: Create Utilities
 
Create these files in order:

1. **Order Number Generator**
   - File: `web-admin/lib/utils/order-number-generator.ts`
   - Test: `web-admin/__tests__/utils/order-number-generator.test.ts`

2. **Barcode Generator**
   - File: `web-admin/lib/utils/barcode-generator.ts`
   - Test: `web-admin/__tests__/utils/barcode-generator.test.ts`

3. **Ready-By Calculator**
   - File: `web-admin/lib/utils/ready-by-calculator.ts`
   - Test: `web-admin/__tests__/utils/ready-by-calculator.test.ts`

4. **Pricing Calculator**
   - File: `web-admin/lib/utils/pricing-calculator.ts`
   - Test: `web-admin/__tests__/utils/pricing-calculator.test.ts`

### Step 4: Create Backend API

**Option A: Server Actions (Recommended for Next.js 15)**

```
web-admin/app/actions/orders/
├── create-order.ts
├── add-order-items.ts
├── complete-preparation.ts
├── get-order.ts
├── list-orders.ts
└── upload-photo.ts
```

**Option B: API Routes**

```
web-admin/app/api/orders/
├── route.ts
└── [id]/
    ├── route.ts
    ├── items/route.ts
    ├── preparation/route.ts
    └── photos/route.ts
```

### Step 5: Build UI Components

**Order List** (Start here)
1. Create `app/dashboard/orders/page.tsx`
2. Create `components/order-table.tsx`
3. Create `components/order-filters-bar.tsx`
4. Create `components/order-stats-cards.tsx`

**Quick Drop Intake**
1. Create `app/dashboard/orders/new/page.tsx`
2. Create `components/quick-drop-form.tsx`
3. Create `components/customer-search.tsx`
4. Create `components/photo-upload.tsx`

**Preparation Workflow**
1. Create `app/dashboard/orders/[id]/prepare/page.tsx`
2. Create `components/product-catalog.tsx`
3. Create `components/shopping-cart.tsx`
4. Create `components/item-detail-modal.tsx`

**Order Details**
1. Create `app/dashboard/orders/[id]/page.tsx`
2. Create `components/order-timeline.tsx`
3. Create `components/print-label.tsx`

### Step 6: Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:e2e

# Check coverage
npm run test:coverage
```

### Step 7: Deploy

```bash
# Build for production
npm run build

# Run production server
npm run start

# Verify
# - Create test order
# - Add items
# - Complete preparation
# - Print label
```

---

## Key Files Reference

### Database
- **Migration**: `supabase/migrations/0012_order_intake_enhancements.sql`
- **Rollback**: `supabase/migrations/0012_order_intake_enhancements_rollback.sql`

### Backend
- **Utilities**: `web-admin/lib/utils/`
  - `order-number-generator.ts`
  - `barcode-generator.ts`
  - `ready-by-calculator.ts`
  - `pricing-calculator.ts`
- **API**: `web-admin/app/actions/orders/` or `web-admin/app/api/orders/`
- **Validation**: `web-admin/lib/validations/order-schema.ts`
- **Storage**: `web-admin/lib/storage/upload-photo.ts`

### Frontend
- **Pages**: `web-admin/app/dashboard/orders/`
  - `page.tsx` (list)
  - `new/page.tsx` (intake)
  - `[id]/page.tsx` (details)
  - `[id]/prepare/page.tsx` (preparation)
- **Components**: `web-admin/app/dashboard/orders/components/`

### Tests
- **Unit**: `web-admin/__tests__/utils/`
- **Integration**: `web-admin/__tests__/api/`
- **E2E**: `web-admin/e2e/orders/`

---

## Validation Checklist

Before marking PRD-004 as complete:

### Database
- [ ] Migration applied successfully
- [ ] All columns created
- [ ] All indexes created
- [ ] Order number function works
- [ ] Rollback script tested

### Backend
- [ ] Order number generator tested
- [ ] QR/Barcode generation working
- [ ] Ready-By calculator accurate
- [ ] Pricing calculator correct
- [ ] All API endpoints functional
- [ ] Photo upload to MinIO working

### Frontend
- [ ] Order list displays correctly
- [ ] Filters and search working
- [ ] Quick Drop form functional
- [ ] Preparation workflow smooth
- [ ] Order details display complete
- [ ] Label printing works

### Testing
- [ ] Unit tests pass (80%+ coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Performance tests pass

### User Acceptance
- [ ] Quick Drop intake < 3 minutes
- [ ] Preparation of 10 items < 3 minutes
- [ ] Order number format correct
- [ ] QR/Barcode scannable
- [ ] Pricing accurate
- [ ] Ready-By date reasonable

---

## Common Issues & Solutions

### Issue: Order number not unique
**Solution**: Verify PostgreSQL function is using proper sequence logic

### Issue: QR code not scannable
**Solution**: Check error correction level and size (minimum 200x200)

### Issue: Ready-By date incorrect
**Solution**: Verify business hours configuration in tenant settings

### Issue: Photo upload fails
**Solution**: Check MinIO bucket permissions and CORS settings

### Issue: RLS policy blocking queries
**Solution**: Verify JWT contains `tenant_org_id` claim

---

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Quick Drop intake | < 3 minutes | ___ |
| Preparation (10 items) | < 3 minutes | ___ |
| Order number generation | < 100ms | ___ |
| API response p95 | < 500ms | ___ |
| Photo upload | < 5 seconds | ___ |
| Label print | < 2 seconds | ___ |

---

## Next Steps After Completion

1. **PRD-005**: Basic Workflow State Machine
   - Order status transitions
   - Workflow rules engine

2. **PRD-006**: Digital Receipts
   - WhatsApp receipt delivery
   - In-app receipt view
   - PDF receipt generation

3. **PRD-007**: Admin Dashboard
   - Order analytics
   - Revenue tracking
   - SLA monitoring

---

## Support & Resources

- **Full Implementation Plan**: [PRD-004_IMPLEMENTATION_PLAN.md](./PRD-004_IMPLEMENTATION_PLAN.md)
- **Original PRD**: [004_order_intake_dev_prd.md](./004_order_intake_dev_prd.md)
- **Master Plan**: [master_plan_cc_01.md](./master_plan_cc_01.md)
- **Documentation Rules**: [documentation_rules.md](../.claude/docs/documentation_rules.md)

---

**Version**: 1.0
**Status**: Ready for Implementation
**Estimated Completion**: 2 weeks (80 hours)
