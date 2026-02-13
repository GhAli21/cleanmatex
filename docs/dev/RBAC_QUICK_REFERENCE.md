# RBAC Quick Reference Guide

**Quick guide for using Role-Based Access Control in CleanMateX**

**Note:** `RequireFeature` now fetches real feature flags from `/api/feature-flags` (tenant plan + overrides) instead of mock data.

---

## 🎯 Role Hierarchy

```
admin (level 3) - Full access
  ↓
staff (level 2) - Operational access
  ↓
driver (level 1) - Limited access
```

---

## 🔧 Common Use Cases

### 1. Hide/Show UI Based on Role

#### Using Hook
```tsx
import { useRole, useHasRole } from '@/lib/auth/role-context'

function MyComponent() {
  const { role, isAdmin, isStaff } = useRole()
  const canEdit = useHasRole(['admin', 'staff'])

  return (
    <div>
      <p>Your role: {role}</p>
      {canEdit && <button>Edit</button>}
      {isAdmin && <button>Delete</button>}
    </div>
  )
}
```

#### Using Component
```tsx
import { RequireRole, AdminOnly, StaffOnly } from '@/components/auth/RequireRole'

function MyComponent() {
  return (
    <div>
      <RequireRole roles="admin">
        <button>Admin Only Button</button>
      </RequireRole>

      <RequireRole roles={['admin', 'staff']}>
        <button>Staff & Admin Button</button>
      </RequireRole>

      <AdminOnly>
        <DeleteButton />
      </AdminOnly>

      <StaffOnly>
        <EditButton />
      </StaffOnly>
    </div>
  )
}
```

### 2. Hide/Show Based on Feature Flag

```tsx
import { RequireFeature, UpgradePrompt } from '@/components/auth/RequireFeature'

function InvoiceActions() {
  return (
    <div>
      <RequireFeature feature="pdf_invoices">
        <button>Download PDF</button>
      </RequireFeature>

      <RequireFeature
        feature="whatsapp_receipts"
        fallback={<UpgradePrompt feature="whatsapp_receipts" />}
      >
        <button>Send via WhatsApp</button>
      </RequireFeature>
    </div>
  )
}
```

### 3. Conditional Logic in Component

```tsx
import { useHasRole, useHasMinimumRole } from '@/lib/auth/role-context'
import { useFeature } from '@/components/auth/RequireFeature'

function OrderPage() {
  const canDelete = useHasRole('admin')
  const canEdit = useHasMinimumRole('staff')
  const canExportPDF = useFeature('pdf_invoices')

  const handleDelete = () => {
    if (!canDelete) {
      alert('Admin access required')
      return
    }
    // Delete logic...
  }

  return (
    <div>
      {canEdit && <button onClick={handleEdit}>Edit</button>}
      {canDelete && <button onClick={handleDelete}>Delete</button>}
      {canExportPDF && <button>Export PDF</button>}
    </div>
  )
}
```

### 4. Protecting Entire Pages

#### Using Layout
```tsx
// app/(dashboard)/admin-only/layout.tsx
import { redirect } from 'next/navigation'
import { useRole } from '@/lib/auth/role-context'

export default function AdminLayout({ children }) {
  const { isAdmin } = useRole()

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
```

#### Proxy Already Handles This
Routes in `proxy.ts` ADMIN_ROUTES are automatically protected.

---

## 📋 Available Hooks

### `useRole()`
```tsx
const {
  role,              // Current role: 'admin' | 'staff' | 'driver' | null
  isAdmin,           // Boolean: true if admin
  isStaff,           // Boolean: true if staff
  isDriver,          // Boolean: true if driver
  hasRole,           // Function: hasRole('admin') or hasRole(['admin', 'staff'])
  hasMinimumRole,    // Function: hasMinimumRole('staff') returns true for staff & admin
  canAccessPath,     // Function: canAccessPath('/dashboard/reports', ['admin'])
} = useRole()
```

### `useHasRole(role)`
```tsx
const canEdit = useHasRole(['admin', 'staff']) // true if user is admin OR staff
const isAdmin = useHasRole('admin')             // true if user is admin only
```

### `useHasMinimumRole(role)`
```tsx
const canManage = useHasMinimumRole('staff')    // true for staff AND admin
const isAtLeastDriver = useHasMinimumRole('driver') // true for everyone
```

### `useCanAccessPath(path, roles)`
```tsx
const canViewReports = useCanAccessPath('/dashboard/reports', ['admin'])
const canViewOrders = useCanAccessPath('/dashboard/orders', ['admin', 'staff'])
```

### `useFeature(feature)`
```tsx
const hasPDFExport = useFeature('pdf_invoices')
const hasWhatsApp = useFeature('whatsapp_receipts')
```

---

## 🎨 Available Components

### `<RequireRole>`
```tsx
<RequireRole roles="admin">
  {/* Content for admin only */}
</RequireRole>

<RequireRole roles={['admin', 'staff']} fallback={<p>Access Denied</p>}>
  {/* Content for admin or staff */}
</RequireRole>
```

### `<RequireMinimumRole>`
```tsx
<RequireMinimumRole role="staff">
  {/* Content for staff and admin (not driver) */}
</RequireMinimumRole>
```

### `<AdminOnly>`
```tsx
<AdminOnly fallback={<p>Admin only</p>}>
  {/* Admin content */}
</AdminOnly>
```

### `<StaffOnly>`
```tsx
<StaffOnly>
  {/* Staff and Admin content */}
</StaffOnly>
```

### `<RequireFeature>`
```tsx
<RequireFeature feature="pdf_invoices">
  {/* Shows only if feature enabled */}
</RequireFeature>

<RequireFeature
  feature={['pdf_invoices', 'printing']}
  requireAll={true}  // Both must be enabled
>
  {/* Content */}
</RequireFeature>

<RequireFeature
  feature={['pdf_invoices', 'whatsapp_receipts']}
  requireAll={false}  // Either can be enabled
  fallback={<UpgradePrompt feature="pdf_invoices" />}
>
  {/* Content */}
</RequireFeature>
```

### `<UpgradePrompt>`
```tsx
<UpgradePrompt feature="advanced_analytics" />

<UpgradePrompt
  feature="api_access"
  message="Custom upgrade message here"
/>
```

---

## 🔒 Feature Flags

### Available Features
```typescript
type FeatureFlagKey =
  | 'pdf_invoices'
  | 'whatsapp_receipts'
  | 'in_app_receipts'
  | 'printing'
  | 'b2b_contracts'
  | 'white_label'
  | 'marketplace_listings'
  | 'loyalty_programs'
  | 'driver_app'
  | 'multi_branch'
  | 'advanced_analytics'
  | 'api_access'
```

### Default Mock Values (Development)
```typescript
{
  pdf_invoices: true,
  whatsapp_receipts: true,
  in_app_receipts: true,
  printing: true,
  b2b_contracts: false,          // Upgrade needed
  white_label: false,             // Upgrade needed
  marketplace_listings: false,    // Upgrade needed
  loyalty_programs: true,
  driver_app: true,
  multi_branch: true,
  advanced_analytics: true,
  api_access: false,              // Upgrade needed
}
```

---

## 🛣️ Protected Routes (Automatic)

These routes are automatically protected by middleware:

### Admin Only
- `/dashboard/drivers`
- `/dashboard/reports`
- `/dashboard/settings`
- `/dashboard/catalog`
- `/dashboard/subscription`
- `/dashboard/users`

### All Authenticated Users
- `/dashboard` (home)
- `/dashboard/orders`
- `/dashboard/assembly`
- `/dashboard/customers`
- `/dashboard/billing`
- `/dashboard/inventory`
- `/dashboard/help`

---

## 📝 Examples

### Example 1: Order Actions Based on Role
```tsx
function OrderActions({ order }) {
  const { isAdmin, hasRole } = useRole()
  const canExportPDF = useFeature('pdf_invoices')

  return (
    <div className="flex gap-2">
      {/* Everyone can view */}
      <button>View</button>

      {/* Staff and Admin can edit */}
      <RequireRole roles={['admin', 'staff']}>
        <button>Edit</button>
      </RequireRole>

      {/* Only admin can delete */}
      {isAdmin && <button>Delete</button>}

      {/* Feature flag: PDF export */}
      {canExportPDF && <button>Export PDF</button>}
    </div>
  )
}
```

### Example 2: Dashboard Widget Visibility
```tsx
function DashboardWidgets() {
  const { hasRole } = useRole()
  const hasAnalytics = useFeature('advanced_analytics')

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Everyone sees these */}
      <OrdersWidget />
      <RevenueWidget />

      {/* Admin only */}
      <RequireRole roles="admin">
        <UserManagementWidget />
      </RequireRole>

      {/* Feature flag required */}
      <RequireFeature
        feature="advanced_analytics"
        fallback={<UpgradePrompt feature="advanced_analytics" />}
      >
        <AnalyticsWidget />
      </RequireFeature>
    </div>
  )
}
```

### Example 3: Conditional Form Fields
```tsx
function OrderForm() {
  const canAssignDriver = useHasRole('admin')
  const hasMultiBranch = useFeature('multi_branch')

  return (
    <form>
      {/* Basic fields */}
      <input name="customer" />
      <input name="service" />

      {/* Admin can assign driver */}
      {canAssignDriver && (
        <select name="driver">
          <option>Select Driver</option>
        </select>
      )}

      {/* Multi-branch tenants can select branch */}
      {hasMultiBranch && (
        <select name="branch">
          <option>Select Branch</option>
        </select>
      )}
    </form>
  )
}
```

---

## 🚨 Best Practices

### DO ✅
- Use hooks for conditional logic
- Use components for conditional rendering
- Check roles client-side for UX
- Rely on middleware for security
- Provide fallback content for better UX

### DON'T ❌
- Don't rely only on client-side checks for security
- Don't expose sensitive data to client then hide with CSS
- Don't check roles on every render (hooks are memoized)
- Don't forget fallback content for denied access

---

## 🔧 Troubleshooting

### "Role is always null"
- Check that RoleProvider wraps your component
- Ensure user is authenticated
- Verify currentTenant has user_role set

### "Feature flag not working"
- Feature flags are currently mocked
- Check Sidebar.tsx line 34-50 for mock values
- TODO: Connect to real feature-flags.service

### "Middleware not redirecting"
- Check route is in ADMIN_ROUTES
- Verify user role in database (org_users_mst)
- Check proxy.ts config.matcher includes your route

---

**Quick Tip**: Use the React DevTools to inspect the RoleContext and see current role + permissions in real-time!

---

**Last Updated**: 2025-10-24
