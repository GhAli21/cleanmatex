---
version: v1.0.0
last_updated: 2025-10-31
author: CleanMateX Development Team
---

# Testing Scenarios - PRD-007 Admin Dashboard

## Overview

This document contains comprehensive test scenarios for the CleanMateX Admin Dashboard. It covers functional testing, integration testing, user acceptance testing, and edge cases.

---

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Dashboard & Analytics Tests](#dashboard--analytics-tests)
3. [Navigation & Quick Actions Tests](#navigation--quick-actions-tests)
4. [Filtering & Search Tests](#filtering--search-tests)
5. [Settings Management Tests](#settings-management-tests)
6. [Reports Tests](#reports-tests)
7. [Internationalization Tests](#internationalization-tests)
8. [Multi-Tenancy Tests](#multi-tenancy-tests)
9. [Performance Tests](#performance-tests)
10. [Accessibility Tests](#accessibility-tests)
11. [Edge Cases & Error Handling](#edge-cases--error-handling)

---

## Test Environment Setup

### Prerequisites
- Test database with seed data
- Two test tenants (tenant1, tenant2)
- Test users with different roles (owner, manager, staff)
- Clean browser cache
- Stable internet connection

### Test Data Requirements
- 100+ orders (various statuses)
- 50+ customers
- Multiple branches
- Sample service catalog
- Payment transactions

### Test Accounts

| Role | Email | Tenant | Password |
|------|-------|--------|----------|
| Owner | owner@test1.com | Tenant 1 | Test@123 |
| Manager | manager@test1.com | Tenant 1 | Test@123 |
| Staff | staff@test1.com | Tenant 1 | Test@123 |
| Owner | owner@test2.com | Tenant 2 | Test@123 |

---

## Dashboard & Analytics Tests

### TC-D001: Dashboard Load Test
**Objective**: Verify dashboard loads correctly

**Steps**:
1. Log in with valid credentials
2. Navigate to dashboard home

**Expected Result**:
- ✅ Dashboard loads within 2 seconds
- ✅ All 10 widgets display
- ✅ No JavaScript errors in console
- ✅ Loading states shown during data fetch
- ✅ Data populates correctly

**Status**: ⏳ Pending

---

### TC-D002: Orders Today Widget
**Objective**: Verify orders widget shows correct data

**Steps**:
1. Note current orders count in database
2. View Orders Today widget on dashboard
3. Compare widget value with database count

**Expected Result**:
- ✅ Widget shows correct order count
- ✅ Trend indicator (up/down) displays
- ✅ Click widget navigates to orders page
- ✅ Real-time updates when new order created

**Status**: ⏳ Pending

---

### TC-D003: Revenue Widget
**Objective**: Test revenue calculations

**Steps**:
1. Check revenue in database for:
   - Today
   - Month-to-date
   - Last 30 days
2. Compare with widget values

**Expected Result**:
- ✅ Calculations are accurate
- ✅ Currency formatted correctly (OMR)
- ✅ Trend chart displays properly
- ✅ Updates after new payment

**Status**: ⏳ Pending

---

### TC-D004: All Widgets Load Simultaneously
**Objective**: Test concurrent widget data loading

**Steps**:
1. Clear cache
2. Load dashboard
3. Observe all widgets loading

**Expected Result**:
- ✅ All widgets load in parallel
- ✅ No widget blocks others
- ✅ Loading spinners show during fetch
- ✅ Errors handled gracefully
- ✅ Failed widgets don't break page

**Status**: ⏳ Pending

---

## Navigation & Quick Actions Tests

### TC-N001: Sidebar Navigation
**Objective**: Verify sidebar navigation works correctly

**Steps**:
1. Click each menu item in sidebar
2. Verify page loads correctly
3. Check active menu highlighting

**Expected Result**:
- ✅ All 11 menu sections work
- ✅ Active item highlighted
- ✅ Submenu items expand/collapse
- ✅ Icons display correctly
- ✅ Responsive on mobile (hamburger menu)

**Status**: ⏳ Pending

---

### TC-N002: Quick Actions Strip
**Objective**: Test quick action functionality

**Steps**:
1. Click "New Order" button
2. Click "Orders" button
3. Click "Customers" button
4. Test quick search input

**Expected Result**:
- ✅ New Order navigates to creation page
- ✅ Other buttons navigate correctly
- ✅ Icons display properly
- ✅ Keyboard shortcuts work (Ctrl+N)
- ✅ Mobile view shows condensed version

**Status**: ⏳ Pending

---

### TC-N003: Language Switcher
**Objective**: Verify language switching

**Steps**:
1. Click language selector
2. Select Arabic
3. Verify interface changes
4. Switch back to English

**Expected Result**:
- ✅ Dropdown shows both languages
- ✅ Interface reloads in selected language
- ✅ RTL layout applied for Arabic
- ✅ Preference persists after reload
- ✅ All text translated

**Status**: ⏳ Pending

---

## Filtering & Search Tests

### TC-F001: Global Filters - Date Range
**Objective**: Test date range filtering

**Steps**:
1. Open orders page
2. Click filters button
3. Set "From Date" to 2024-01-01
4. Set "To Date" to 2024-01-31
5. Observe filtered results

**Expected Result**:
- ✅ Only orders in range display
- ✅ Active filter badge shows count
- ✅ URL updates with parameters
- ✅ Results update without page reload
- ✅ Clear filters resets view

**Status**: ⏳ Pending

---

### TC-F002: Global Filters - Multiple Filters
**Objective**: Test combining multiple filters

**Steps**:
1. Select date range
2. Select branch
3. Select multiple statuses
4. Select priority

**Expected Result**:
- ✅ All filters apply correctly (AND logic)
- ✅ Badge shows filter count (4)
- ✅ Results match all criteria
- ✅ URL contains all parameters
- ✅ Filters persist after navigation

**Status**: ⏳ Pending

---

### TC-F003: URL Query Synchronization
**Objective**: Test URL parameter sync

**Steps**:
1. Apply filters
2. Copy page URL
3. Open URL in new tab
4. Verify filters applied

**Expected Result**:
- ✅ URL contains all filter parameters
- ✅ New tab loads with same filters
- ✅ Filters state matches URL
- ✅ Bookmarked URLs work
- ✅ Back/forward buttons maintain filters

**Status**: ⏳ Pending

---

### TC-F004: Quick Search
**Objective**: Test global search functionality

**Steps**:
1. Type order number in search
2. Type customer name
3. Type phone number
4. Press Enter

**Expected Result**:
- ✅ Search finds orders by number
- ✅ Search finds customers by name
- ✅ Search finds by phone
- ✅ Results appear quickly (< 1s)
- ✅ Partial matches work

**Status**: ⏳ Pending

---

## Settings Management Tests

### TC-S001: General Settings - Business Info
**Objective**: Test business information update

**Steps**:
1. Navigate to Settings → General
2. Update business name (EN & AR)
3. Update email, phone, address
4. Click "Save Changes"

**Expected Result**:
- ✅ All fields editable
- ✅ Validation works
- ✅ Save button shows loading state
- ✅ Success message displays
- ✅ Data persists after reload

**Status**: ⏳ Pending

---

### TC-S002: Business Hours Editor
**Objective**: Test hours configuration

**Steps**:
1. Open Settings → General
2. Scroll to Business Hours
3. Set Monday: 09:00 - 18:00
4. Mark Sunday as Closed
5. Click "Copy to All"
6. Save changes

**Expected Result**:
- ✅ Time pickers work correctly
- ✅ Closed checkbox disables times
- ✅ Copy to All applies to all days
- ✅ Hours saved correctly
- ✅ Displayed to customers

**Status**: ⏳ Pending

---

### TC-S003: Logo Upload
**Objective**: Test logo upload functionality

**Steps**:
1. Navigate to Settings → Branding
2. Click "Choose File"
3. Select valid image (PNG, < 2MB)
4. Wait for preview
5. Save changes

**Expected Result**:
- ✅ File picker opens
- ✅ Image preview appears immediately
- ✅ Upload succeeds
- ✅ Logo displays throughout app
- ✅ File size validation works

**Status**: ⏳ Pending

---

### TC-S004: Color Customization
**Objective**: Test brand color picker

**Steps**:
1. Open Settings → Branding
2. Click primary color picker
3. Select new color (#FF5733)
4. Repeat for secondary and accent
5. View live preview
6. Save changes

**Expected Result**:
- ✅ Color pickers open
- ✅ Color selection works
- ✅ Hex value updates
- ✅ Live preview shows changes
- ✅ Colors apply globally

**Status**: ⏳ Pending

---

### TC-S005: User Invitation
**Objective**: Test team member invitation

**Steps**:
1. Navigate to Settings → Users
2. Click "Invite User"
3. Enter email: newuser@test.com
4. Select role: Manager
5. Click "Send Invite"

**Expected Result**:
- ✅ Modal opens
- ✅ Email validation works
- ✅ Role selector displays
- ✅ Invitation sent
- ✅ User appears in list (Pending)
- ✅ Email received by user

**Status**: ⏳ Pending

---

### TC-S006: Subscription Display
**Objective**: Verify subscription info

**Steps**:
1. Navigate to Settings → Subscription
2. View current plan details
3. Check usage statistics
4. View available plans

**Expected Result**:
- ✅ Current plan shows correctly
- ✅ Usage bars accurate
- ✅ Billing date correct
- ✅ Available plans listed
- ✅ Upgrade buttons functional

**Status**: ⏳ Pending

---

## Reports Tests

### TC-R001: Revenue Report
**Objective**: Test revenue analytics

**Steps**:
1. Navigate to Dashboard → Reports
2. View revenue report
3. Change date range
4. Observe chart updates

**Expected Result**:
- ✅ Line chart displays
- ✅ Data points accurate
- ✅ Hover shows values
- ✅ Date range updates chart
- ✅ No console errors

**Status**: ⏳ Pending

---

### TC-R002: Orders Report
**Objective**: Test order analytics

**Steps**:
1. View orders report
2. Check bar chart
3. Verify statistics

**Expected Result**:
- ✅ Bar chart shows status distribution
- ✅ Bars colored correctly
- ✅ Counts match database
- ✅ Interactive tooltips work
- ✅ Statistics accurate

**Status**: ⏳ Pending

---

### TC-R003: Export Functionality
**Objective**: Test report export

**Steps**:
1. Click "Export CSV" button
2. Click "Export PDF" button

**Expected Result**:
- ✅ CSV download initiates
- ✅ PDF download initiates
- ✅ Files contain correct data
- ✅ Formatting preserved
- ✅ Filename includes date

**Status**: ⏳ Pending

---

## Internationalization Tests

### TC-I001: English Interface
**Objective**: Verify English translations complete

**Steps**:
1. Switch to English
2. Navigate all pages
3. Check all text elements

**Expected Result**:
- ✅ No missing translation keys
- ✅ All buttons labeled
- ✅ All messages in English
- ✅ Proper grammar
- ✅ Consistent terminology

**Status**: ⏳ Pending

---

### TC-I002: Arabic Interface
**Objective**: Verify Arabic translations complete

**Steps**:
1. Switch to Arabic
2. Navigate all pages
3. Check all text elements
4. Verify RTL layout

**Expected Result**:
- ✅ All text in Arabic
- ✅ RTL layout applied
- ✅ Text aligns right
- ✅ Navigation on right
- ✅ Forms flow correctly
- ✅ Numbers formatted properly

**Status**: ⏳ Pending

---

### TC-I003: RTL Component Alignment
**Objective**: Test RTL-specific layout

**Steps**:
1. Switch to Arabic
2. Check sidebar position
3. Check icon directions
4. Check form layouts
5. Check tables

**Expected Result**:
- ✅ Sidebar on right
- ✅ Icons mirrored correctly
- ✅ Forms align right
- ✅ Tables read right-to-left
- ✅ Margins/padding correct

**Status**: ⏳ Pending

---

### TC-I004: Language Persistence
**Objective**: Test language preference saving

**Steps**:
1. Select Arabic
2. Close browser
3. Reopen application
4. Check language

**Expected Result**:
- ✅ Arabic still selected
- ✅ Preference in localStorage
- ✅ Works across sessions
- ✅ Works on different devices (if synced)

**Status**: ⏳ Pending

---

## Multi-Tenancy Tests

### TC-M001: Tenant Isolation - Data
**Objective**: Verify tenants can't see each other's data

**Steps**:
1. Log in as Tenant 1 owner
2. Note order count
3. Log out
4. Log in as Tenant 2 owner
5. Check order count

**Expected Result**:
- ✅ Different order counts
- ✅ No Tenant 1 data visible
- ✅ Dashboard shows only Tenant 2 data
- ✅ Search doesn't find Tenant 1 orders
- ✅ Reports show only Tenant 2 data

**Status**: ⏳ Pending

---

### TC-M002: Tenant Isolation - Direct Access
**Objective**: Test security against direct ID access

**Steps**:
1. Log in as Tenant 1
2. Get an order ID from Tenant 2
3. Try accessing via URL
4. Try API call

**Expected Result**:
- ✅ Access denied (403 error)
- ✅ Error message displayed
- ✅ No data leaked
- ✅ Security logged

**Status**: ⏳ Pending

---

### TC-M003: Tenant Switcher
**Objective**: Test tenant switching (for multi-tenant users)

**Steps**:
1. Log in with multi-tenant account
2. Click tenant switcher
3. Select different tenant
4. Verify data changes

**Expected Result**:
- ✅ Dropdown shows all tenants
- ✅ Switch updates immediately
- ✅ Data reloads for new tenant
- ✅ Preference saved
- ✅ All queries filtered correctly

**Status**: ⏳ Pending

---

## Performance Tests

### TC-P001: Page Load Performance
**Objective**: Measure page load times

**Steps**:
1. Clear cache
2. Load dashboard
3. Measure time to interactive

**Expected Result**:
- ✅ Dashboard loads < 2 seconds
- ✅ Orders page < 2 seconds
- ✅ Settings page < 1 second
- ✅ Reports page < 3 seconds

**Tools**: Chrome DevTools Performance tab

**Status**: ⏳ Pending

---

### TC-P002: Large Dataset Handling
**Objective**: Test with 1000+ orders

**Steps**:
1. Create test data (1000 orders)
2. Load orders page
3. Apply filters
4. Paginate through results

**Expected Result**:
- ✅ Page loads within 2 seconds
- ✅ Filtering remains fast (< 1s)
- ✅ Pagination works smoothly
- ✅ No memory leaks
- ✅ UI remains responsive

**Status**: ⏳ Pending

---

### TC-P003: Concurrent Users
**Objective**: Test multiple simultaneous users

**Steps**:
1. Open 10 browser sessions
2. Log in with different users
3. Perform actions simultaneously

**Expected Result**:
- ✅ No conflicts
- ✅ All sessions stable
- ✅ Data consistency maintained
- ✅ No race conditions

**Status**: ⏳ Pending

---

## Accessibility Tests

### TC-A001: Keyboard Navigation
**Objective**: Test keyboard-only navigation

**Steps**:
1. Use Tab to navigate
2. Use Enter to activate
3. Use Esc to close modals
4. Navigate all pages

**Expected Result**:
- ✅ All interactive elements reachable
- ✅ Focus indicators visible
- ✅ Tab order logical
- ✅ Shortcuts work (Ctrl+N, etc.)
- ✅ No keyboard traps

**Status**: ⏳ Pending

---

### TC-A002: Screen Reader Compatibility
**Objective**: Test with screen reader

**Steps**:
1. Enable NVDA/JAWS
2. Navigate dashboard
3. Interact with forms
4. Read error messages

**Expected Result**:
- ✅ All text announced
- ✅ Form labels clear
- ✅ Buttons described
- ✅ Errors communicated
- ✅ Navigation landmarks work

**Status**: ⏳ Pending

---

### TC-A003: Color Contrast
**Objective**: Verify WCAG AA compliance

**Steps**:
1. Use contrast checker tool
2. Check text/background ratios
3. Check button contrast
4. Check disabled states

**Expected Result**:
- ✅ All text meets 4.5:1 ratio
- ✅ Large text meets 3:1
- ✅ Buttons have sufficient contrast
- ✅ Links identifiable

**Tools**: axe DevTools, WAVE

**Status**: ⏳ Pending

---

## Edge Cases & Error Handling

### TC-E001: Network Interruption
**Objective**: Test offline behavior

**Steps**:
1. Load dashboard
2. Disable network
3. Try to save settings
4. Re-enable network

**Expected Result**:
- ✅ Offline indicator shows
- ✅ Error message clear
- ✅ Data not lost
- ✅ Retry mechanism available
- ✅ Recovers when online

**Status**: ⏳ Pending

---

### TC-E002: Session Timeout
**Objective**: Test session expiration

**Steps**:
1. Log in
2. Wait for session timeout
3. Try to perform action

**Expected Result**:
- ✅ Session expires after inactivity
- ✅ Redirect to login
- ✅ Message explains why
- ✅ Can log back in
- ✅ Return to intended page

**Status**: ⏳ Pending

---

### TC-E003: Invalid Data Input
**Objective**: Test form validation

**Steps**:
1. Try invalid email format
2. Try phone with letters
3. Try negative numbers
4. Try XSS attack strings

**Expected Result**:
- ✅ Validation errors display
- ✅ Form doesn't submit
- ✅ Error messages helpful
- ✅ XSS prevented
- ✅ SQL injection blocked

**Status**: ⏳ Pending

---

### TC-E004: Browser Compatibility
**Objective**: Test across browsers

**Browsers to Test**:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

**Expected Result**:
- ✅ All features work
- ✅ UI renders correctly
- ✅ No console errors
- ✅ Performance acceptable

**Status**: ⏳ Pending

---

### TC-E005: Mobile Responsiveness
**Objective**: Test on mobile devices

**Devices**:
- iPhone 12 (390x844)
- Samsung Galaxy S21 (360x800)
- iPad (768x1024)

**Expected Result**:
- ✅ Layout adapts correctly
- ✅ Touch targets adequate
- ✅ Text readable
- ✅ All features accessible
- ✅ Performance good

**Status**: ⏳ Pending

---

## Test Summary Template

### Execution Report

| Category | Total | Passed | Failed | Blocked | Not Run |
|----------|-------|--------|--------|---------|---------|
| Dashboard | 10 | 0 | 0 | 0 | 10 |
| Navigation | 8 | 0 | 0 | 0 | 8 |
| Filtering | 6 | 0 | 0 | 0 | 6 |
| Settings | 12 | 0 | 0 | 0 | 12 |
| Reports | 5 | 0 | 0 | 0 | 5 |
| i18n | 8 | 0 | 0 | 0 | 8 |
| Multi-Tenancy | 6 | 0 | 0 | 0 | 6 |
| Performance | 4 | 0 | 0 | 0 | 4 |
| Accessibility | 5 | 0 | 0 | 0 | 5 |
| Edge Cases | 10 | 0 | 0 | 0 | 10 |
| **TOTAL** | **74** | **0** | **0** | **0** | **74** |

---

## Bug Report Template

```markdown
**Bug ID**: BUG-001
**Title**: Brief description
**Severity**: Critical/High/Medium/Low
**Priority**: P0/P1/P2/P3

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**: What should happen

**Actual Result**: What actually happened

**Environment**:
- Browser: Chrome 120
- OS: Windows 11
- User Role: Manager
- Tenant: Test Tenant 1

**Screenshots**: [Attach if available]

**Console Errors**: [Copy any errors]

**Additional Notes**: Any other relevant information
```

---

**Version**: v1.0.0
**Last Updated**: 2025-10-31
**Test Status**: Ready for execution
**Maintained By**: CleanMateX Development Team
