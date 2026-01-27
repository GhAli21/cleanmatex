# New Order Page - Complete Documentation

**Version**: 1.0.0  
**Last Updated**: 2026-01-24  
**Status**: ✅ Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Component Structure](#component-structure)
5. [State Management](#state-management)
6. [Hooks](#hooks)
7. [Security](#security)
8. [Accessibility](#accessibility)
9. [Internationalization](#internationalization)
10. [Testing](#testing)
11. [Performance](#performance)
12. [Usage Guide](#usage-guide)
13. [API Reference](#api-reference)

---

## Overview

The New Order Page is a comprehensive, production-ready order creation interface for CleanMateX. It provides a modern, accessible, and performant experience for creating laundry orders with support for:

- Multi-tenant isolation
- Piece-level tracking
- Express orders
- Quick drop orders
- Custom items
- Photo capture
- Payment processing
- Bilingual support (EN/AR + RTL)

### Key Highlights

- ✅ **Fully Refactored**: Clean architecture with separation of concerns
- ✅ **Type-Safe**: 100% TypeScript with strict mode
- ✅ **Accessible**: WCAG 2.1 AA compliant
- ✅ **Internationalized**: Full EN/AR support with RTL
- ✅ **Secure**: Input sanitization, XSS prevention, permission checks
- ✅ **Performant**: Memoization, React Query, code splitting
- ✅ **Well-Tested**: Unit, integration, and E2E tests

---

## Architecture

### File Structure

```
web-admin/
├── app/dashboard/orders/new/
│   ├── page.tsx                    # Main page (thin shell)
│   └── components/                 # Legacy components (to be migrated)
│       ├── category-tabs.tsx
│       ├── product-grid.tsx
│       ├── order-summary-panel.tsx
│       └── ...
│
└── src/features/orders/
    ├── model/                      # Type definitions & schemas
    │   ├── new-order-types.ts
    │   ├── new-order-form-schema.ts
    │   └── payment-form-schema.ts
    │
    ├── ui/                         # UI components
    │   ├── context/
    │   │   ├── new-order-context.tsx
    │   │   └── new-order-reducer.ts
    │   ├── components/
    │   │   ├── custom-item-modal.tsx
    │   │   └── photo-capture-modal.tsx
    │   ├── new-order-layout.tsx
    │   ├── new-order-content.tsx
    │   ├── new-order-modals.tsx
    │   └── new-order-loading-skeleton.tsx
    │
    └── hooks/                      # Custom hooks
        ├── use-new-order-state.ts
        ├── use-order-form.ts
        ├── use-order-totals.ts
        ├── use-order-validation.ts
        ├── use-order-submission.ts
        ├── use-category-products.ts
        ├── use-ready-by-estimation.ts
        ├── use-notes-persistence.ts
        ├── use-order-warnings.ts
        └── use-unsaved-changes.ts

lib/
├── constants/
│   ├── order-defaults.ts          # Centralized constants
│   └── order-types.ts
│
└── utils/
    ├── validation-helpers.ts      # Validation utilities
    ├── order-item-helpers.ts       # Item manipulation
    ├── piece-helpers.ts            # Piece tracking
    ├── currency-helpers.ts         # Currency formatting
    └── security-helpers.ts         # Input sanitization
```

### Design Patterns

1. **Context + Reducer Pattern**: Global state management via React Context
2. **Custom Hooks**: Business logic extracted into reusable hooks
3. **Component Composition**: Small, focused components
4. **Memoization**: Performance optimization with `React.memo`, `useMemo`, `useCallback`
5. **React Query**: Data fetching and caching
6. **Zod Validation**: Type-safe schema validation

---

## Features

### Core Features

1. **Customer Selection**
   - Progressive search (current tenant → global → other tenants)
   - Customer creation modal
   - Customer editing
   - Customer linking

2. **Product Selection**
   - Category-based browsing
   - Product grid with quantity controls
   - Express pricing toggle
   - Custom item creation
   - Photo capture

3. **Order Configuration**
   - Quick drop mode
   - Express service
   - Ready-by date estimation
   - Order notes (with auto-save)
   - Piece-level tracking (when enabled)

4. **Payment Processing**
   - Multiple payment methods
   - Discounts (percent/amount)
   - Promo codes
   - Gift cards
   - Payment summary

5. **Validation & Warnings**
   - Real-time validation
   - Duplicate product detection
   - High quantity warnings
   - Unsaved changes protection

### Advanced Features

- **Notes Persistence**: Auto-saves notes to localStorage
- **Keyboard Navigation**: Full keyboard support with shortcuts
- **Screen Reader Support**: ARIA labels and live regions
- **Focus Management**: Proper focus traps in modals
- **Error Handling**: Comprehensive error boundaries
- **Loading States**: Skeleton loaders and loading indicators

---

## Component Structure

### Main Components

#### `NewOrderPage` (page.tsx)
Thin shell component that provides context and layout.

```tsx
<NewOrderProvider>
  <NewOrderLayout>
    <Suspense fallback={<NewOrderLoadingSkeleton />}>
      <NewOrderContent />
    </Suspense>
  </NewOrderLayout>
  <NewOrderModals />
</NewOrderProvider>
```

#### `NewOrderContent`
Main content area with:
- Category tabs
- Product grid
- Order summary panel

#### `NewOrderModals`
Container for all modals:
- CustomerPickerModal
- CustomerEditModal
- PaymentModalEnhanced
- CustomItemModal
- PhotoCaptureModal

---

## State Management

### State Structure

```typescript
interface NewOrderState {
  // Customer
  customer: MinimalCustomer | null;
  customerName: string;
  
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
  modals: ModalStates;
  
  // Data
  categories: ServiceCategory[];
  products: Product[];
  selectedCategory: string;
  
  // Loading States
  isInitialLoading: boolean;
  categoriesLoading: boolean;
  productsLoading: boolean;
}
```

### Actions

All state mutations go through the reducer with typed actions:

- `SET_CUSTOMER`
- `ADD_ITEM` / `REMOVE_ITEM`
- `UPDATE_ITEM_QUANTITY` / `UPDATE_ITEM_PIECES`
- `SET_EXPRESS` / `SET_QUICK_DROP`
- `SET_NOTES` / `SET_READY_BY_AT`
- `OPEN_MODAL` / `CLOSE_MODAL`
- `RESET_ORDER`

---

## Hooks

### State Hooks

- **`useNewOrderStateWithDispatch`**: Access state and dispatch
- **`useNewOrderState`**: Read-only state access
- **`useNewOrderDispatch`**: Dispatch-only access

### Business Logic Hooks

- **`useOrderForm`**: React Hook Form integration
- **`useOrderTotals`**: Memoized total calculations
- **`useOrderValidation`**: Comprehensive validation
- **`useOrderWarnings`**: Warning/error detection
- **`useOrderSubmission`**: Order submission with error handling

### Data Hooks

- **`useCategoryProducts`**: React Query for categories/products
- **`useReadyByEstimation`**: Debounced ready-by calculation
- **`useTenantCurrency`**: Currency from tenant settings

### Utility Hooks

- **`useNotesPersistence`**: Auto-save notes to localStorage
- **`useUnsavedChanges`**: Navigation warning for unsaved changes

---

## Security

### Input Sanitization

All user inputs are sanitized using `security-helpers.ts`:

```typescript
import { sanitizeInput, sanitizeOrderNotes } from '@/lib/utils/security-helpers';

// Sanitize text inputs
const safeName = sanitizeInput(userInput);

// Sanitize notes (allows some formatting)
const safeNotes = sanitizeOrderNotes(orderNotes);
```

### XSS Prevention

- HTML tags removed from text inputs
- Event handlers stripped
- JavaScript protocol blocked
- DOMPurify for HTML content (when needed)

### Permission Checks

- API route checks `orders:create` permission
- CSRF token validation
- Rate limiting per tenant

### Validation

- Zod schemas for all forms
- UUID validation for IDs
- Quantity/price range validation
- Product ID validation before submission

---

## Accessibility

### Keyboard Navigation

- **Tab**: Navigate between elements
- **Enter**: Submit forms / activate buttons
- **Escape**: Close modals
- **Arrow Keys**: Navigate lists/tabs
- **Ctrl/Cmd + S**: Submit order

### ARIA Labels

All interactive elements have proper ARIA labels:

```tsx
<button
  aria-label={t('addCustomer')}
  aria-selected={isSelected}
  role="tab"
>
```

### Screen Reader Support

- Live regions for dynamic content
- Proper heading hierarchy
- Descriptive button labels
- Form field associations

### Visual Accessibility

- Focus indicators on all interactive elements
- Color contrast (WCAG AA)
- Responsive design
- Touch-friendly targets (min 44px)

---

## Internationalization

### Translation Keys

All text is externalized to translation files:

- `messages/en.json`
- `messages/ar.json`

### RTL Support

Full RTL support via `useRTL` hook:

```tsx
const isRTL = useRTL();

<div className={isRTL ? 'text-right' : 'text-left'}>
```

### Translation Structure

```json
{
  "newOrder": {
    "title": "New Order",
    "customer": { ... },
    "itemsGrid": { ... },
    "orderSummary": { ... },
    "payment": { ... },
    "customItem": { ... },
    "photoCapture": { ... }
  }
}
```

---

## Testing

### Unit Tests

Located in `__tests__/features/orders/`:

- `new-order-reducer.test.ts` - Reducer logic
- `validation-helpers.test.ts` - Validation utilities
- `order-item-helpers.test.ts` - Item manipulation
- `piece-helpers.test.ts` - Piece tracking
- `security-helpers.test.ts` - Input sanitization

### Integration Tests

- API endpoint tests
- Full order flow tests
- Payment processing tests

### E2E Tests

- Complete user journey
- Tenant settings variations
- Accessibility testing

### Running Tests

```bash
# Unit tests
npm test

# With coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## Performance

### Optimizations

1. **Memoization**
   - `React.memo` for components
   - `useMemo` for expensive calculations
   - `useCallback` for stable function references

2. **React Query**
   - Automatic caching
   - Background refetching
   - Optimistic updates

3. **Code Splitting**
   - Lazy-loaded modals
   - Route-based splitting

4. **Debouncing**
   - Ready-by estimation (400ms)
   - Search inputs (300ms)
   - Notes auto-save

### Performance Targets

- Initial load: < 2s
- Category switch: < 500ms
- Order submission: < 3s
- Smooth 60fps interactions

---

## Usage Guide

### Basic Usage

1. **Select Customer**
   - Click "Select Customer" button
   - Search or create new customer
   - Customer appears in summary panel

2. **Add Items**
   - Select category from tabs
   - Click product cards to add
   - Adjust quantities with +/- buttons
   - Or add custom item

3. **Configure Order**
   - Toggle Express if needed
   - Add notes
   - Set ready-by date (auto-estimated)

4. **Submit Order**
   - Click "Submit Order"
   - Complete payment modal
   - Order created successfully

### Keyboard Shortcuts

- `Ctrl/Cmd + S`: Submit order
- `Escape`: Close modal
- `Tab`: Navigate elements
- `Enter`: Activate button/submit

---

## API Reference

### Hooks API

#### `useNewOrderStateWithDispatch()`

Returns state and dispatch function.

```typescript
const { state, dispatch } = useNewOrderStateWithDispatch();
```

#### `useOrderTotals()`

Returns memoized totals.

```typescript
const { subtotal, itemCount, itemsCount } = useOrderTotals();
```

#### `useOrderValidation()`

Returns validation results.

```typescript
const { isValid, errors, warnings } = useOrderValidation();
```

### Utilities API

#### `sanitizeInput(input: string): string`

Sanitizes user input for safe storage.

#### `validateProductId(id: string): boolean`

Validates product ID format.

#### `calculateOrderTotal(items: OrderItem[]): number`

Calculates total price for order items.

---

## Constants

### Order Defaults

```typescript
ORDER_DEFAULTS = {
  CURRENCY: 'OMR',
  DEBOUNCE_MS: {
    ESTIMATION: 400,
    SEARCH: 300,
  },
  LIMITS: {
    QUANTITY_MIN: 1,
    QUANTITY_MAX: 999,
    ITEMS_HIGH_THRESHOLD: 10,
    MAX_PHOTOS: 10,
  },
  PRICE: {
    MIN: 0.001,
    STEP: 0.001,
    DECIMAL_PLACES: 3,
  },
}
```

---

## Troubleshooting

### Common Issues

1. **Order not submitting**
   - Check browser console for errors
   - Verify CSRF token
   - Check permissions

2. **Products not loading**
   - Check network tab
   - Verify category selection
   - Check React Query cache

3. **Validation errors**
   - Ensure customer selected
   - Verify items added
   - Check product IDs are valid UUIDs

---

## Future Enhancements

- [ ] Bulk item import
- [ ] Order templates
- [ ] Recent items quick-add
- [ ] Advanced filtering
- [ ] Order preview/print
- [ ] Mobile app integration

---

## Contributing

When adding new features:

1. Follow the established architecture
2. Add TypeScript types
3. Write unit tests
4. Update documentation
5. Ensure accessibility
6. Add translations (EN/AR)

---

## License

Copyright © 2025 CleanMateX. All rights reserved.

