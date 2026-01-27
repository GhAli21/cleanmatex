---
name: Enhanced New Order Page - Complete Refactor
overview: Comprehensive refactoring plan combining architectural improvements, React Hook Form integration, context-based state management, accessibility, testing, and production readiness. Addresses specific issues like debug markers, hardcoded values, and monolithic component structure.
todos:
  - id: phase1-context
    content: "Phase 1.1: Create context & state management (new-order-context.tsx, new-order-types.ts, new-order-reducer.ts)"
    status: completed
  - id: phase1-constants
    content: "Phase 1.2: Create constants & configuration (order-defaults.ts, order-types.ts)"
    status: completed
  - id: phase1-utils
    content: "Phase 1.3: Create utility functions (validation-helpers.ts, order-item-helpers.ts, piece-helpers.ts, currency-helpers.ts)"
    status: completed
  - id: phase1-schemas
    content: "Phase 1.4: Create Zod schemas (new-order-form-schema.ts, payment-form-schema.ts)"
    status: completed
  - id: phase2-hooks
    content: "Phase 2.1: Extract custom hooks (use-new-order-state.ts, use-order-form.ts, use-order-submission.ts, use-category-products.ts, etc.)"
    status: completed
    dependencies:
      - phase1-context
      - phase1-schemas
  - id: phase2-refactor
    content: "Phase 2.2: Refactor main page component to thin shell (~100 lines) with new layout components"
    status: completed
    dependencies:
      - phase2-hooks
  - id: phase2-memoization
    content: "Phase 2.3: Add memoization to existing components (OrderSummaryPanel, ItemCartList, ItemCartItem, ProductGrid)"
    status: completed
    dependencies:
      - phase2-refactor
  - id: phase3-form-integration
    content: "Phase 3.1: Integrate React Hook Form with Zod resolver"
    status: completed
    dependencies:
      - phase2-hooks
  - id: phase3-payment-modal
    content: "Phase 3.2: Refactor PaymentModalEnhanced to use React Hook Form"
    status: completed
    dependencies:
      - phase3-form-integration
  - id: phase3-validation-feedback
    content: "Phase 3.3: Add form validation feedback (inline errors, success indicators)"
    status: completed
    dependencies:
      - phase3-payment-modal
  - id: phase4-custom-item
    content: "Phase 4.1: Implement CustomItemModal (catalog-free items)"
    status: completed
    dependencies:
      - phase2-refactor
  - id: phase4-photo-capture
    content: "Phase 4.1: Implement PhotoCaptureModal (camera capture for items)"
    status: completed
    dependencies:
      - phase2-refactor
  - id: phase4-notes-persistence
    content: "Phase 4.1: Implement notes persistence (auto-save draft)"
    status: completed
    dependencies:
      - phase2-refactor
  - id: phase4-validations
    content: "Phase 4.2: Add missing validations (duplicate product check, high quantity warning, unsaved changes confirmation)"
    status: completed
    dependencies:
      - phase3-validation-feedback
  - id: phase5-keyboard-nav
    content: "Phase 5.1: Implement full keyboard navigation support"
    status: completed
    dependencies:
      - phase2-refactor
  - id: phase5-screen-reader
    content: "Phase 5.2: Add screen reader support (ARIA labels, live regions)"
    status: completed
    dependencies:
      - phase5-keyboard-nav
  - id: phase5-visual-accessibility
    content: "Phase 5.3: Ensure visual accessibility (color contrast, focus indicators, responsive design)"
    status: completed
    dependencies:
      - phase5-screen-reader
  - id: phase5-i18n
    content: "Phase 5.4: Complete i18n (add missing translation keys, validate EN/AR coverage)"
    status: completed
  - id: phase6-debug-cleanup
    content: "Phase 6.1: Remove debug markers ([Jh], console.log statements, commented code)"
    status: completed
  - id: phase6-hardcoded-values
    content: "Phase 6.2: Extract hardcoded values (currency, debounce times, limits) to constants"
    status: completed
    dependencies:
      - phase1-constants
  - id: phase6-type-safety
    content: "Phase 6.3: Improve type safety (remove any types, add type guards, discriminated unions)"
    status: completed
    dependencies:
      - phase1-utils
  - id: phase6-documentation
    content: "Phase 6.4: Add code documentation (JSDoc comments, inline comments)"
    status: completed
    dependencies:
      - phase6-type-safety
  - id: phase7-unit-tests
    content: "Phase 7.1: Write unit tests (reducer, schemas, helpers, hooks) - >80% coverage"
    status: completed
    dependencies:
      - phase6-type-safety
  - id: phase7-integration-tests
    content: "Phase 7.2: Write integration tests (full order flow, payment, customer selection)"
    status: completed
    dependencies:
      - phase7-unit-tests
  - id: phase7-e2e-tests
    content: "Phase 7.3: Write E2E tests (complete user journey, tenant settings, accessibility)"
    status: completed
    dependencies:
      - phase7-integration-tests
  - id: phase8-security
    content: "Phase 8.1: Security enhancements (input sanitization, XSS prevention, permission checks)"
    status: completed
    dependencies:
      - phase4-validations
  - id: phase8-performance
    content: "Phase 8.2: Performance optimization (React Query, code splitting, virtual scrolling)"
    status: completed
    dependencies:
      - phase2-memoization
  - id: phase8-monitoring
    content: "Phase 8.3: Add monitoring & analytics (error tracking, metrics, performance monitoring)"
    status: completed
    dependencies:
      - phase8-performance
  - id: phase8-build-optimization
    content: "Phase 8.4: Build optimization (verify production build, bundle splitting, source maps)"
    status: completed
    dependencies:
      - phase8-monitoring
---

# E

nhanced New Order Page - Complete Refactor Plan

## Objective

Transform the New Order page into a production-ready, maintainable, accessible, and fully-featured POS interface following CleanMateX best practices and frontend architecture standards.

## Architecture Compliance

This plan **strictly follows** the CleanMateX frontend standards:

- **`app/`** – Next.js routing only (thin shell that composes feature screens)
- **`src/ui/`** – Global Cmx Design System (reusable UI components)
- **`src/features/orders/`** – Feature modules (domain UI + logic)
- `ui/` – Feature screens and components
- `hooks/` – Feature-specific React hooks
- `api/` – Feature API client functions
- `model/` – Types, schemas, mappers
- **`lib/`** – Shared infrastructure (root-level: API, hooks, utils, config)

**Path Aliases:**

- `@features/orders/*` → `src/features/orders/*`
- `@ui/*` → `src/ui/*`
- `@lib/*` → `lib/*`

**Import Rules:**

- Features MUST NOT import from `app/` or other features directly
- Features MUST compose from `@ui` (Cmx components) and `@lib`
- All reusable UI MUST be in `src/ui/` with `Cmx` prefix---

## Current State Analysis

### Critical Issues Identified

1. **Monolithic Component**: Single 996-line file with 20+ state variables
2. **Debug Markers**: `[Jh]`, `[Jh89-92]` prefixes throughout codebase
3. **Hardcoded Values**: Currency "OMR", payment methods, debounce times, limits
4. **Missing Memoization**: `OrderSummaryPanel`, `ItemCartList` not memoized
5. **Duplicate Code**: UUID regex repeated in multiple places
6. **No Form Validation**: Manual validation instead of React Hook Form + Zod
7. **Incomplete Features**: Photo capture, custom item modals are stubs
8. **Type Safety**: Some `any` types and loose type definitions
9. **Accessibility Gaps**: Missing ARIA labels, keyboard navigation incomplete
10. **Testing**: No unit/integration tests

---

## Implementation Plan

### Phase 1: Foundation & Architecture (Week 1)

#### 1.1 Create Context & State Management

**Files**:

- `web-admin/app/dashboard/orders/new/context/new-order-context.tsx` (new)
- `web-admin/app/dashboard/orders/new/context/new-order-types.ts` (new)
- `web-admin/app/dashboard/orders/new/context/new-order-reducer.ts` (new)

**State Structure**:

```typescript
interface NewOrderState {
  // Customer
  customer: MinimalCustomer | null;
  
  // Order Items
  items: OrderItem[];
  
  // Order Settings
  isQuickDrop: boolean;
  quickDropQuantity: number;
  express: boolean;
  notes: string;
  readyByAt: string;
  
  // UI State
  loading: boolean;
  createdOrderId: string | null;
  createdOrderStatus: string | null;
  
  // Modal States
  modals: {
    customerPicker: boolean;
    customerEdit: boolean;
    payment: boolean;
    customItem: boolean;
    photoCapture: boolean;
  };
  
  // Data
  categories: ServiceCategory[];
  products: Product[];
  selectedCategory: string;
}
```

**Actions**: Create reducer with actions for all state mutations (ADD_ITEM, REMOVE_ITEM, UPDATE_CUSTOMER, etc.)

#### 1.2 Create Constants & Configuration

**File**: `web-admin/app/dashboard/orders/new/constants/order-defaults.ts` (new)

```typescript
export const ORDER_DEFAULTS = {
  DEBOUNCE_MS: {
    ESTIMATION: 400,
    SEARCH: 300,
  },
  RETRY: {
    COUNT: 2,
    DELAYS: [1000, 2000],
  },
  LIMITS: {
    PRODUCTS_PER_CATEGORY: 100,
    QUANTITY_MIN: 1,
    QUANTITY_MAX: 999,
    ITEMS_HIGH_THRESHOLD: 10,
  },
} as const;
```

**File**: `web-admin/app/dashboard/orders/new/constants/order-types.ts` (new)

- Define all order-related enums and constants
- Payment method types
- Order status types

#### 1.3 Create Utility Functions

**Files**:

- `web-admin/app/dashboard/orders/new/utils/validation-helpers.ts` (new)
- Consolidated UUID validation
- Product ID validation
- Quantity validation
- Price validation
- `web-admin/app/dashboard/orders/new/utils/order-item-helpers.ts` (new)
- `addItemToOrder()`
- `removeItemFromOrder()`
- `updateItemQuantity()`
- `calculateItemTotal()`
- `calculateOrderTotal()`
- `web-admin/app/dashboard/orders/new/utils/piece-helpers.ts` (new)
- `generatePiecesForItem()`
- `updatePieceDetails()`
- `validatePieceData()`
- `web-admin/app/dashboard/orders/new/utils/currency-helpers.ts` (new)
- `formatCurrency()` - from tenant settings
- `parseCurrency()`

#### 1.4 Create Zod Schemas

**Files**:

- `web-admin/app/dashboard/orders/new/schemas/new-order-form-schema.ts` (new)
- Full order validation with piece support
- Customer validation
- Items validation
- Settings validation
- `web-admin/app/dashboard/orders/new/schemas/payment-form-schema.ts` (new)
- Payment method validation
- Check number validation (conditional)
- Discount validation (percent/amount)
- Promo code validation
- Gift card validation

---

### Phase 2: Component Extraction & Hooks (Week 1-2)

#### 2.1 Extract Custom Hooks

**Directory**: `web-admin/app/dashboard/orders/new/hooks/`| Hook File | Purpose | Dependencies ||-----------|---------|--------------|| `use-new-order-state.ts` | Context consumer with dispatch helpers | Context || `use-order-form.ts` | React Hook Form integration with Zod | react-hook-form, zod || `use-order-submission.ts` | API submission with error handling | Context, API || `use-category-products.ts` | Category/product data fetching with React Query | @tanstack/react-query || `use-ready-by-estimation.ts` | Debounced estimation calls | useDebounce || `use-order-totals.ts` | Memoized total calculations | useMemo || `use-tenant-currency.ts` | Currency from tenant settings | useTenantSettings || `use-order-validation.ts` | Order validation logic | Zod schemas |

#### 2.2 Refactor Main Page Component

**File**: `web-admin/app/dashboard/orders/new/page.tsx` (refactor to ~100 lines)

```tsx
export default function NewOrderPage() {
  return (
    <NewOrderProvider>
      <NewOrderLayout>
        <Suspense fallback={<NewOrderLoadingSkeleton />}>
          <NewOrderContent />
        </Suspense>
      </NewOrderLayout>
      <NewOrderModals />
    </NewOrderProvider>
  );
}
```

**New Components**:

- `NewOrderLayout.tsx` - Main layout wrapper
- `NewOrderContent.tsx` - Main content (tabs + grid + summary)
- `NewOrderModals.tsx` - All modals container

#### 2.3 Add Memoization to Existing Components

**Files to modify**:

- `web-admin/app/dashboard/orders/new/components/order-summary-panel.tsx`
- Wrap with `React.memo`
- Extract callbacks with `useCallback`
- Memoize expensive calculations
- `web-admin/app/dashboard/orders/new/components/item-cart-list.tsx`
- Wrap with `React.memo`
- Optimize item rendering
- `web-admin/app/dashboard/orders/new/components/item-cart-item.tsx`
- Wrap with `React.memo`
- Extract piece management callbacks
- `web-admin/app/dashboard/orders/new/components/product-grid.tsx`
- Virtual scrolling for >50 products
- Memoize product cards

---

### Phase 3: Form Integration & Validation (Week 2)

#### 3.1 Integrate React Hook Form

**File**: `web-admin/app/dashboard/orders/new/hooks/use-order-form.ts` (new)

- Use `useForm` with `zodResolver`
- Wire form state to context reducer
- Add field-level validation feedback
- Handle form submission

#### 3.2 Refactor PaymentModalEnhanced

**File**: `web-admin/app/dashboard/orders/new/components/payment-modal-enhanced.tsx`

- Convert to React Hook Form controlled inputs
- Add real-time validation for check number
- Improve error display with retry option
- Add loading states per field

#### 3.3 Add Form Validation Feedback

- Show inline errors for all form fields
- Add success indicators
- Disable submit button when invalid
- Show validation summary

---

### Phase 4: Feature Completion (Week 2-3)

#### 4.1 Implement Missing Features

**CustomItemModal** (`web-admin/src/features/orders/ui/components/custom-item-modal.tsx`)

- Add catalog-free item with name/price/quantity
- Validate custom item data
- Support piece tracking for custom items
- Add to order items list

**PhotoCaptureModal** (`web-admin/src/features/orders/ui/components/photo-capture-modal.tsx`)

- Camera capture for item documentation
- Image preview and retake
- Attach photos to order items
- Store photos in order metadata

**Notes Persistence**

- Actually persist notes (currently non-functional)
- Auto-save draft notes
- Load saved notes on page load

**Piece Tracking Warning**

- Alert when disabling with existing pieces
- Confirm before clearing piece data
- Show piece count in warning

#### 4.2 Add Missing Validations

- Duplicate product ID check
- High quantity warning (>10 items)
- Unsaved changes confirmation on navigation
- Price validation (min/max)
- Customer selection validation

---

### Phase 5: Accessibility & i18n (Week 3)

#### 5.1 Keyboard Navigation

**Files**: All component files in `components/`

- Full keyboard support for all interactions
- Focus management in modals (trap focus)
- Skip links for main content areas
- Tab order follows visual flow
- Keyboard shortcuts (document in help)

#### 5.2 Screen Reader Support

- Proper ARIA labels for all interactive elements
- Live regions for dynamic content updates
- Form field labels and error announcements
- Status messages for order creation
- Role attributes for complex components

#### 5.3 Visual Accessibility

- Sufficient color contrast (4.5:1 minimum)
- Focus indicators on all interactive elements
- Text alternatives for icons/images
- Responsive design for all screen sizes
- High contrast mode support

#### 5.4 Complete i18n

**Files**: `web-admin/messages/en.json`, `web-admin/messages/ar.json`**Add missing keys**:

```json
{
  "newOrder": {
    "errors": {
      "networkError": "...",
      "duplicateProduct": "...",
      "highQuantityWarning": "...",
      "unsavedChanges": "..."
    },
    "photoCapture": {
      "title": "...",
      "capture": "...",
      "retake": "..."
    },
    "customItem": {
      "title": "...",
      "addCustomItem": "..."
    },
    "keyboardShortcuts": {
      "addItem": "...",
      "removeItem": "..."
    }
  }
}
```



- Validate all keys exist in both languages
- Support RTL layout for Arabic
- Date/time formatting per locale

---

### Phase 6: Cleanup & Code Quality (Week 3-4)

#### 6.1 Remove Debug Markers

**Files**: All files in `web-admin/app/dashboard/orders/new/`Remove all instances of:

- `[Jh]`, `[Jh89]`, `[Jh90]`, `[Jh91]`, `[Jh92]` from logs/errors
- `console.log` statements with debug prefixes
- Commented-out code blocks
- Temporary workarounds

#### 6.2 Extract Hardcoded Values

| Value | Current Location | Extract To ||-------|------------------|------------|| `OMR` | Multiple files | `useTenantCurrency()` hook || `400` (debounce) | page.tsx:248 | `ORDER_DEFAULTS.DEBOUNCE_MS.ESTIMATION` || `100` (product limit) | page.tsx:181 | `ORDER_DEFAULTS.LIMITS.PRODUCTS_PER_CATEGORY` || Payment methods | PaymentModal | Tenant settings or constants || UUID regex | Multiple files | `validation-helpers.ts` |

#### 6.3 Type Safety Improvements

**File**: `web-admin/lib/types/order.ts` (enhance)

- Remove all `any` types
- Define strict types for all order-related data
- Add proper type guards for runtime validation
- Create discriminated unions for order states
- Export all types for reuse

#### 6.4 Code Documentation

- Add JSDoc comments to all exported functions
- Document component props and state
- Document business logic and edge cases
- Add inline comments for complex logic
- Document API contracts

---

### Phase 7: Testing (Week 4)

#### 7.1 Unit Tests

**Directory**: `web-admin/app/dashboard/orders/new/__tests__/`

- `reducer.test.ts` - Reducer logic tests (90% coverage)
- `schemas.test.ts` - Zod schema validation tests (95% coverage)
- `validation-helpers.test.ts` - Validation function tests
- `order-item-helpers.test.ts` - Item manipulation tests
- `piece-helpers.test.ts` - Piece management tests
- `hooks/use-order-totals.test.ts` - Calculation hook tests
- `hooks/use-order-submission.test.ts` - Submission hook tests

#### 7.2 Integration Tests

**File**: `web-admin/app/dashboard/orders/new/__tests__/integration.test.tsx`

- Full order submission flow
- Payment modal flow
- Customer selection flow
- Piece tracking flow
- Error handling scenarios

#### 7.3 E2E Tests

**File**: `web-admin/e2e/orders/new-order.spec.ts`

- Complete user journey
- Test with different tenant settings
- Test accessibility features
- Test error scenarios
- Test RTL layout

---

### Phase 8: Security & Production Readiness (Week 4-5)

#### 8.1 Security Enhancements

- Sanitize all user inputs
- Validate data types and ranges
- Prevent XSS in customer notes
- Validate file uploads (photo capture)
- CSRF token validation (already implemented, verify)
- Permission checks before actions
- Rate limiting for API calls

#### 8.2 Performance Optimization

- Implement React Query for categories/products caching
- Add optimistic updates for order creation
- Implement pagination for large product lists
- Virtual scrolling for product grid (>100 products)
- Code splitting for modals (lazy load)
- Bundle size optimization

#### 8.3 Monitoring & Analytics

- Add error tracking (Sentry or similar)
- Track order creation metrics
- Monitor API response times
- Track user interactions
- Performance monitoring (Web Vitals)
- Set up performance budgets

#### 8.4 Build Optimization

- Ensure successful production build (`npm run build`)
- Optimize bundle splitting
- Minimize CSS/JS sizes
- Add source maps for debugging
- Verify no console errors/warnings

---

## Final File Structure (Following Frontend Standards)

```javascript
web-admin/
├── app/dashboard/orders/new/
│   └── page.tsx                      # Thin shell - composes feature screen (~20 lines)
│
├── src/features/orders/
│   ├── ui/
│   │   ├── new-order-screen.tsx      # NEW - Main screen component
│   │   ├── new-order-layout.tsx      # NEW - Layout wrapper
│   │   ├── new-order-content.tsx     # NEW - Main content
│   │   ├── new-order-modals.tsx      # NEW - Modals container
│   │   ├── new-order-loading-skeleton.tsx # NEW - Loading state
│   │   ├── context/
│   │   │   ├── new-order-context.tsx  # State management
│   │   │   └── new-order-reducer.ts   # Reducer logic
│   │   └── components/               # Feature-specific components
│   │       ├── category-tabs.tsx
│   │       ├── product-grid.tsx
│   │       ├── order-summary-panel.tsx
│   │       ├── item-cart-list.tsx
│   │       ├── item-cart-item.tsx
│   │       ├── customer-picker-modal.tsx
│   │       ├── customer-edit-modal.tsx
│   │       ├── payment-modal-enhanced.tsx
│   │       ├── custom-item-modal.tsx         # NEW
│   │       ├── photo-capture-modal.tsx       # NEW
│   │       └── loading-skeletons.tsx
│   │
│   ├── hooks/
│   │   ├── use-new-order-state.ts
│   │   ├── use-order-form.ts
│   │   ├── use-order-submission.ts
│   │   ├── use-category-products.ts
│   │   ├── use-ready-by-estimation.ts
│   │   ├── use-order-totals.ts
│   │   ├── use-tenant-currency.ts
│   │   └── use-order-validation.ts
│   │
│   ├── api/
│   │   ├── orders-api.ts              # Feature API client functions
│   │   └── categories-api.ts           # Category API functions
│   │
│   ├── model/
│   │   ├── new-order-types.ts          # TypeScript types
│   │   ├── new-order-schemas.ts        # Zod schemas
│   │   └── order-mappers.ts            # DB to UI mappers
│   │
│   └── __tests__/
│       ├── reducer.test.ts
│       ├── schemas.test.ts
│       ├── validation-helpers.test.ts
│       ├── order-item-helpers.test.ts
│       ├── piece-helpers.test.ts
│       ├── integration.test.tsx
│       └── hooks/
│           ├── use-order-totals.test.ts
│           └── use-order-submission.test.ts
│
├── lib/
│   ├── services/
│   │   └── order-creation.service.ts   # Shared business logic (if needed)
│   ├── utils/
│   │   ├── validation-helpers.ts       # Shared validation utilities
│   │   ├── order-item-helpers.ts       # Shared order item utilities
│   │   ├── piece-helpers.ts            # Shared piece utilities
│   │   └── currency-helpers.ts         # Shared currency utilities
│   ├── constants/
│   │   └── order-defaults.ts          # Shared constants
│   └── types/
│       └── order.ts                    # Shared type definitions
│
└── docs/
    └── user-guide/
        └── new-order-page.md           # User documentation
```

**Key Structure Rules:**

- `app/` - Only routing, composes from `@features/orders/ui/new-order-screen`
- `src/features/orders/` - All feature-specific code
- `ui/` - Feature screens and components
- `hooks/` - Feature-specific React hooks
- `api/` - Feature API client functions
- `model/` - Types, schemas, mappers
- `lib/` - Shared infrastructure (utilities, services, constants)
- `src/ui/` - Global Cmx Design System (already exists, use existing components)

**Import Path Aliases:**

- `@features/orders/ui/...` - Feature UI components
- `@features/orders/hooks/...` - Feature hooks
- `@features/orders/api/...` - Feature API functions
- `@features/orders/model/...` - Feature types/schemas
- `@ui/...` - Global Cmx components
- `@lib/...` - Shared utilities/services

---

## Implementation Phases Summary

1. **Phase 1**: Foundation (Context, Constants, Utils, Schemas) - Week 1
2. **Phase 2**: Component Extraction & Hooks - Week 1-2
3. **Phase 3**: Form Integration & Validation - Week 2
4. **Phase 4**: Feature Completion - Week 2-3
5. **Phase 5**: Accessibility & i18n - Week 3
6. **Phase 6**: Cleanup & Code Quality - Week 3-4
7. **Phase 7**: Testing - Week 4
8. **Phase 8**: Security & Production - Week 4-5

---

## Verification Steps

### Build Check

```bash
cd web-admin && npm run build
```



- Must pass with no errors
- No TypeScript errors
- No linting errors
- Bundle size within limits

### Functionality Test

1. Create order with customer selection
2. Add/remove items, change quantities
3. Toggle express service
4. Enable piece tracking, add piece details
5. Complete payment flow
6. Verify order created successfully
7. Test custom item creation
8. Test photo capture (if implemented)

### Accessibility Test

1. Keyboard navigation (Tab, Enter, Escape)
2. Screen reader compatibility
3. Color contrast verification
4. Focus indicators visible
5. ARIA labels present

### RTL Test

1. Switch to Arabic locale
2. Verify layout mirrors correctly
3. Verify text alignment
4. Verify icon positioning

### Error Handling Test

1. Network failure scenarios
2. Permission denied scenarios
3. Validation error scenarios
4. API timeout scenarios

### Performance Test

1. Verify no unnecessary re-renders (React DevTools)
2. Check bundle size
3. Measure page load time (<2s target)
4. Test with 100+ products

---

## Success Criteria

- ✅ All code follows TypeScript strict mode
- ✅ Zero `any` types in order-related code
- ✅ Main page component <150 lines
- ✅ 100% keyboard navigation support
- ✅ WCAG 2.1 AA compliance
- ✅ All user-facing text translated (EN/AR)
- ✅ Unit test coverage >80%
- ✅ Integration test coverage >70%
- ✅ Production build succeeds
- ✅ Page load time <2s
- ✅ All accessibility tests pass
- ✅ No console errors/warnings
- ✅ No debug markers in code
- ✅ All hardcoded values extracted
- ✅ All features functional

---

## Risk Mitigation

- **Backward Compatibility**: Keep API contract unchanged
- **Incremental Migration**: Each phase is independently deployable
- **Feature Flags**: New features behind tenant settings if needed
- **Rollback Plan**: Git branches per phase for easy revert
- **Testing**: Comprehensive test coverage before production
- **Code Review**: Review each phase before merging

---

## Dependencies

### New Dependencies

- `react-hook-form` - Form management
- `@hookform/resolvers` - Zod resolver
- `zod` - Schema validation
- `@tanstack/react-query` - Data fetching/caching (if not already)

### Existing Dependencies (Verify)

- `next-intl` - i18n
- `@ui/*` - UI components
- React hooks (useState, useEffect, useMemo, useCallback)

---

## Notes

- Follow CleanMateX coding standards from `.cursor/rules/`