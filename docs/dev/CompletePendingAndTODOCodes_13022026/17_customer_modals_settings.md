# 17 - Customer Modals and Help Page

## Summary

Wired Upgrade and Edit modals on the customer detail page. Updated help page documentation and FAQ links.

## Files Affected

- `web-admin/app/dashboard/customers/[id]/page.tsx`
- `web-admin/app/dashboard/help/page.tsx`

## Code Before (customer detail)

```tsx
onClick={() => { /* TODO: Implement upgrade modal */ }}
onClick={() => { /* TODO: Implement edit modal */ }}
```

## Code After

- Added `showUpgradeModal`, `showEditModal` state
- Imported `UpgradeProfileModal` and `CustomerEditModal`
- Upgrade button: `onClick={() => setShowUpgradeModal(true)}`
- Edit button: `onClick={() => setShowEditModal(true)}`
- Rendered modals with onClose/onSuccess handlers that update customer state

## Help Page

- Documentation link: from `#` + alert to `/docs` (or external if no docs route)
- FAQ link: from `#` + alert to `/dashboard/help#faq`

## Effects

- Upgrade flow uses existing UpgradeProfileModal (OTP verification)
- Edit uses CustomerEditModal from new-order flow (reused)
