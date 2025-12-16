# Admin Dashboard - Basic UI - Implementation Plan

**PRD ID**: 007_admin_dashboard_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 1.5 weeks
**Dependencies**: PRD-001 (Auth), PRD-002 (Tenant), PRD-003 (Customer), PRD-004 (Order Intake), PRD-005 (Workflow)

---

## Overview

Implement a responsive web-based admin dashboard for managing laundry operations. Provides order management, customer management, basic reporting, and settings configuration. Built with Next.js 15, TypeScript, and Tailwind CSS with full EN/AR bilingual support.

---

## Business Value

- **Efficiency**: Centralized interface for all operations
- **Visibility**: Real-time view of orders, customers, and business metrics
- **Accessibility**: Web-based, accessible from any device
- **Usability**: Intuitive UI reduces training time
- **Insights**: Basic analytics inform business decisions

---

## Requirements

### Functional Requirements

#### Dashboard/Home Page
- **FR-DASH-001**: Overview cards (today's orders, pending preparation, ready, delivered)
- **FR-DASH-002**: Recent orders list (last 10)
- **FR-DASH-003**: Overdue orders alert
- **FR-DASH-004**: Quick actions (New Order, New Customer)
- **FR-DASH-005**: Daily revenue summary
- **FR-DASH-006**: Status distribution chart (pie/donut)

#### Order Management
- **FR-DASH-007**: Order list with pagination, search, filters
- **FR-DASH-008**: Order detail view with all information
- **FR-DASH-009**: Create Quick Drop order form
- **FR-DASH-010**: Preparation interface (itemization)
- **FR-DASH-011**: Status update buttons
- **FR-DASH-012**: Print order label
- **FR-DASH-013**: View receipt

#### Customer Management
- **FR-DASH-014**: Customer list with search
- **FR-DASH-015**: Customer detail view (profile, addresses, order history)
- **FR-DASH-016**: Create customer (stub/full)
- **FR-DASH-017**: Edit customer profile
- **FR-DASH-018**: Customer merge (admin only)

#### Settings & Configuration
- **FR-DASH-019**: Tenant profile settings
- **FR-DASH-020**: Business hours configuration
- **FR-DASH-021**: Logo upload and branding
- **FR-DASH-022**: User management (add, edit, deactivate)
- **FR-DASH-023**: Subscription management (view plan, upgrade)

#### Reports (Basic)
- **FR-DASH-024**: Daily orders report
- **FR-DASH-025**: Revenue report (date range)
- **FR-DASH-026**: Customer list export (CSV)
- **FR-DASH-027**: Order list export (CSV)

### Non-Functional Requirements

- **NFR-DASH-001**: Page load time < 2 seconds (p95)
- **NFR-DASH-002**: Responsive design (mobile, tablet, desktop)
- **NFR-DASH-003**: Full bilingual support (EN/AR with RTL)
- **NFR-DASH-004**: Accessible (WCAG 2.1 AA)
- **NFR-DASH-005**: Support 1000+ orders displayed (pagination)
- **NFR-DASH-006**: Offline indicator (show when API unavailable)

---

## UI/UX Design

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ Header: Logo | Tenant Name | [Notifications] [User] │
├───────┬─────────────────────────────────────────────┤
│       │                                             │
│ Side  │                                             │
│ Nav   │          Main Content Area                  │
│       │                                             │
│ - Home│                                             │
│ - Ord │                                             │
│ - Cus │                                             │
│ - Rep │                                             │
│ - Set │                                             │
│       │                                             │
└───────┴─────────────────────────────────────────────┘
```

### Page Routes

```
/dashboard                  → Home/Overview
/orders                     → Order List
/orders/new                 → Create Order
/orders/:id                 → Order Detail
/orders/:id/preparation     → Preparation Screen
/customers                  → Customer List
/customers/:id              → Customer Detail
/reports                    → Reports
/settings                   → Settings (tabs: General, Branding, Users, Subscription)
```

### Color Scheme (Default - Tenant Customizable)

```css
/* Primary Colors */
--primary-500: #3B82F6;      /* Blue */
--primary-600: #2563EB;
--primary-700: #1D4ED8;

/* Secondary Colors */
--secondary-500: #10B981;    /* Green */

/* Status Colors */
--status-intake: #6B7280;    /* Gray */
--status-processing: #3B82F6; /* Blue */
--status-ready: #10B981;     /* Green */
--status-delivered: #059669; /* Dark Green */
--status-overdue: #EF4444;   /* Red */
```

---

## Key Screens/Components

### 1. Dashboard Home

**Metrics Cards (Row 1)**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Today's     │ Pending     │ Ready for   │ Delivered   │
│ Orders      │ Prep        │ Pickup      │ Today       │
│             │             │             │             │
│    25       │    8        │    12       │    18       │
│  +5 vs yes  │             │             │  +3 vs yes  │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Revenue Card**:
```
┌───────────────────────────────────┐
│ Today's Revenue                   │
│                                   │
│ OMR 450.500                       │
│ +12% vs yesterday                 │
└───────────────────────────────────┘
```

**Recent Orders Table**:
```
Order #          | Customer      | Status      | Total   | Actions
─────────────────────────────────────────────────────────────────
ORD-20251010-001| Ahmed Al-Said | Processing  | 14.175  | [View]
ORD-20251010-002| Fatima        | Ready       | 25.500  | [View]
...
```

**Status Distribution Chart**:
- Pie/Donut chart showing order count by status
- Legend with counts and percentages

### 2. Order List Page

**Filters Bar**:
```
[Search: Order #, Customer...]  [Status: All ▼]  [Date: Today ▼]  [Export CSV]
```

**Table**:
```
[✓] Order #          | Customer      | Status      | Items | Total   | Ready By          | Actions
──────────────────────────────────────────────────────────────────────────────────────────────────
[✓] ORD-20251010-001| Ahmed Al-Said | Processing  | 8     | 14.175  | 11 Oct, 6:00 PM   | [View] [Label]
[ ] ORD-20251010-002| Fatima        | Ready       | 12    | 25.500  | 10 Oct, 5:00 PM   | [View] [Receipt]
...
```

**Bulk Actions** (appears when items selected):
```
[2 selected] → [Change Status ▼] [Print Labels] [Export]
```

**Pagination**:
```
Showing 1-20 of 150   [< Previous] [1] [2] [3] ... [8] [Next >]
```

### 3. Order Detail Page

**Header**:
```
ORD-20251010-0001        [Processing]        [Print Label] [View Receipt] [•••]
```

**Tabs**:
- **Details**: Order info, customer, items
- **Timeline**: Status history
- **Payments**: Payment records (future)

**Details Tab - Order Info Card**:
```
┌─────────────────────────────────────────────────────┐
│ Order Information                                   │
│                                                     │
│ Received:     10 Oct 2025, 10:00 AM                │
│ Ready By:     11 Oct 2025, 6:00 PM                 │
│ Service:      Wash & Fold                          │
│ Priority:     Normal                               │
│ Bags:         2                                    │
│ Status:       [Intake] → [Processing] → [Ready]   │
└─────────────────────────────────────────────────────┘
```

**Customer Info Card**:
```
┌─────────────────────────────────────────────────────┐
│ Customer                                            │
│                                                     │
│ [Avatar] Ahmed Al-Said (CUST-00001)                │
│          +968 9012 3456                            │
│          ahmed@example.com                         │
│                                                     │
│ Preferences: Hang, Lavender fragrance, Eco-friendly│
│                                            [View →] │
└─────────────────────────────────────────────────────┘
```

**Items Table**:
```
Item                    | Qty | Unit Price | Total   | Service    | Notes
─────────────────────────────────────────────────────────────────────────
Shirt (Regular)         | 5   | 1.500      | 7.500   | Wash & Fold|
Pants                   | 3   | 2.000      | 6.000   | Dry Clean  | Coffee stain
                                                       ─────────────────
                                              Subtotal: 13.500 OMR
                                              Tax (5%): 0.675 OMR
                                              Total:    14.175 OMR
```

**Timeline Tab**:
```
┌─────────────────────────────────────────────────────┐
│ 10 Oct, 2:30 PM    [●] Ready                       │
│                     by Jane Operator               │
│                     "All items processed"          │
│                                                     │
│ 10 Oct, 10:15 AM   [●] Processing                  │
│                     by Jane Operator               │
│                     "Preparation completed"        │
│                                                     │
│ 10 Oct, 10:00 AM   [●] Intake                      │
│                     by John Admin                  │
│                     "Order created"                │
└─────────────────────────────────────────────────────┘
```

### 4. Preparation Screen

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│ Preparation: ORD-20251010-0001                    [Save Draft] [Complete] │
├────────────────┬───────────────────────────────────────────┤
│                │ Cart (0 items)                            │
│ Product Catalog│ ─────────────────────────────────────────  │
│ [Search...]    │ Total: 0.000 OMR                          │
│                │ Ready By: Not calculated                   │
│ [Wash & Fold]  │                                           │
│                │ [No items added yet]                      │
│ ┌─────┐        │                                           │
│ │Shirt│ 1.500  │                                           │
│ └─────┘        │                                           │
│ ┌─────┐        │                                           │
│ │Pants│ 2.000  │                                           │
│ └─────┘        │                                           │
│ ...            │                                           │
└────────────────┴───────────────────────────────────────────┘
```

**Quick Add Modal** (click product):
```
┌───────────────────────────────────────┐
│ Add Item: Shirt (Regular)             │
│                                       │
│ Quantity:  [+ 5 -]                    │
│ Service:   [Wash & Fold ▼]            │
│ Color:     [White         ]            │
│ Brand:     [Nike          ]            │
│ Has Stain: [ ]  Has Damage: [ ]       │
│                                       │
│           [Cancel]  [Add to Cart]     │
└───────────────────────────────────────┘
```

### 5. Customer List Page

**Search & Filters**:
```
[Search: Name, Phone, Email...]  [Type: All ▼]  [Status: Active ▼]  [Export CSV]
```

**Table**:
```
Customer #  | Name          | Phone          | Type  | Orders | Points | Last Order  | Actions
────────────────────────────────────────────────────────────────────────────────────────────────
CUST-00001  | Ahmed Al-Said | +968 9012 3456 | Full  | 12     | 150    | 9 Oct 2025  | [View]
CUST-00002  | Fatima        | +968 9012 3457 | Stub  | 3      | 0      | 8 Oct 2025  | [View]
...
```

### 6. Settings Pages (Tabbed)

**General Tab**:
```
Business Information
─────────────────────
Business Name (EN): [Laundry Plus                    ]
Business Name (AR): [لوندري بلس                      ]
Email:             [admin@laundryplus.com           ]
Phone:             [+968 2412 3456                  ]

Preferences
───────────
Currency:          [OMR ▼]
Timezone:          [Asia/Muscat ▼]
Language:          [English ▼]

Business Hours
──────────────
Monday:    [08:00] - [18:00]  [✓ Open]
Tuesday:   [08:00] - [18:00]  [✓ Open]
...

                [Cancel]  [Save Changes]
```

**Branding Tab**:
```
Logo
────
[   Upload Zone   ]  Current Logo: [■ logo.png]
Drag & drop or click to upload
Max 2MB, PNG/JPG/SVG

Colors
──────
Primary Color:   [#3B82F6  ▼]  Preview: ████
Secondary Color: [#10B981  ▼]  Preview: ████

Preview
───────
[Receipt preview with branding applied]

                [Cancel]  [Save Changes]
```

**Users Tab**:
```
Team Members
────────────
[+ Add User]

Name             | Email                | Role      | Status  | Actions
──────────────────────────────────────────────────────────────────────
John Admin       | admin@laundry.com    | Admin     | Active  | [Edit] [Deactivate]
Jane Operator    | jane@laundry.com     | Operator  | Active  | [Edit] [Deactivate]
...
```

**Subscription Tab**:
```
Current Plan
────────────
┌────────────────────────────────────┐
│ Starter Plan                       │
│                                    │
│ OMR 29/month                       │
│ Next billing: 1 Nov 2025           │
│                                    │
│ [Change Plan]  [Cancel Subscription]│
└────────────────────────────────────┘

Usage This Month
────────────────
Orders:   27/100   [███░░░░░░░] 27%
Users:    3/5      [███░░] 60%
Storage:  45/500MB [░] 9%

[Upgrade Plan to unlock more features]
```

---

## Technical Implementation

### Frontend Stack

```json
{
  "framework": "Next.js 15 (App Router)",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "components": "shadcn/ui",
  "forms": "React Hook Form + Zod",
  "state": "React Query (TanStack)",
  "i18n": "next-intl",
  "charts": "Recharts",
  "icons": "Lucide React"
}
```

### Directory Structure

```
web-admin/
├── app/
│   ├── [locale]/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── [id]/preparation/page.tsx
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   └── api/
│       └── ... (API routes if needed)
├── components/
│   ├── ui/ (shadcn components)
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── MainLayout.tsx
│   ├── orders/
│   │   ├── OrderList.tsx
│   │   ├── OrderDetail.tsx
│   │   ├── OrderForm.tsx
│   │   └── PreparationScreen.tsx
│   ├── customers/
│   │   ├── CustomerList.tsx
│   │   └── CustomerDetail.tsx
│   └── dashboard/
│       ├── MetricsCards.tsx
│       └── RecentOrders.tsx
├── lib/
│   ├── api/ (API client)
│   ├── hooks/ (custom hooks)
│   └── utils/
├── messages/ (i18n translations)
│   ├── en.json
│   └── ar.json
└── styles/
    └── globals.css
```

### State Management

```typescript
// React Query for server state
import { useQuery, useMutation } from '@tanstack/react-query';

// Example: Fetch orders
function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => api.orders.list(filters),
  });
}

// Example: Update order status
function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, status }) =>
      api.orders.updateStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
```

### Bilingual Support (i18n)

```typescript
// next-intl configuration
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

// Usage in components
import { useTranslations } from 'next-intl';

export default function OrderList() {
  const t = useTranslations('Orders');

  return <h1>{t('title')}</h1>; // "Orders" in EN, "الطلبات" in AR
}
```

### RTL Support

```css
/* globals.css */
[dir="rtl"] {
  direction: rtl;
}

[dir="rtl"] .sidebar {
  border-left: none;
  border-right: 1px solid var(--border);
}

/* Tailwind with RTL plugin */
/* Install: @tailwindcss/rtl */
```

### API Client

```typescript
// lib/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (redirect to login)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Acceptance Criteria

- [ ] Dashboard loads in < 2 seconds
- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Full bilingual support (EN/AR with RTL)
- [ ] Order list supports 1000+ orders with pagination
- [ ] Search works with debounce (300ms)
- [ ] Status update reflects immediately (optimistic update)
- [ ] Form validation with error messages
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Offline indicator shown when API unavailable
- [ ] Tenant branding (logo, colors) applied throughout

---

## Testing Requirements

### Unit Tests (Jest + React Testing Library)
- MetricsCards component renders correct values
- OrderList filters orders correctly
- Form validation (React Hook Form + Zod)

### Integration Tests
- Order creation flow (form → API → success)
- Search functionality (debounced input → API call)

### E2E Tests (Playwright)
- Login → Dashboard → View metrics
- Orders → Create order → Preparation → Complete
- Customers → Create stub customer → View detail
- Settings → Update tenant name → Save → Verify

---

## Deployment Notes

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STORAGE_URL=http://localhost:9000
```

### Build & Deploy

```bash
# Build
npm run build

# Start production server
npm run start

# Deploy to Vercel (recommended for Next.js)
vercel --prod
```

---

## References

- Requirements: Section 3.5 (Admin / Config)
- All MVP PRDs (001-006) for feature integration
- Related PRDs: PRD-015 (Reporting & Analytics - P1)

---

**Status**: Ready for Implementation
**Estimated Effort**: 60 hours (1.5 weeks with 2 developers)
