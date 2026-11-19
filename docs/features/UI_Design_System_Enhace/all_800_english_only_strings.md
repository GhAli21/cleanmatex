# English-only strings in web-admin (inventory 2026-11-19)

Every piece of text an Arabic user would see in English. Source: ESLint `react/jsx-no-literals` (text between tags; punctuation-only skipped), a scan of string props (`title`, `label`, `placeholder`, `description`, `message`, `aria-label`, `alt`, …), and literal `cmxMessage(…)` / `setError(…)` calls. Stories and tests excluded.

**Total: 822 strings in 121 files** (plus 125 in the developer-only JWT Test page, listed at the end and not planned for translation).

By kind: text 680, placeholder 47, title 34, aria-label 20, description 12, cmxMessage 12, label 10, setError 4, message 3.

Some rows are not text to translate: short codes (e.g. `CR`, `IN`, `B2B`, `VIP`), option values such as time zone names, and code-format placeholders. The plan keeps code formats as they are (ruling 2). Line numbers are from 2026-11-19 and move as files change.

## Files (alphabetical)

### `app/(auth)/forgot-password/page.tsx` (20)

| Line | Kind | Text |
|---|---|---|
| 71 | text | Check your email |
| 74 | text | We've sent a password reset link to |
| 95 | text | Next Steps |
| 98 | text | Check your email inbox (and spam folder) |
| 99 | text | Click the password reset link in the email |
| 100 | text | Enter your new password |
| 101 | text | Sign in with your new password |
| 124 | text | The reset link will expire in |
| 125 | text | . If you don't see the email, check your spam folder or |
| 125 | text | 1 hour |
| 130 | text | try again |
| 143 | text | Back to Login |
| 157 | text | Reset your password |
| 160 | text | Enter your email address and we'll send you a link to reset your password |
| 199 | text | Email address |
| 213 | placeholder | you@example.com |
| 248 | text | Sending... |
| 262 | text | ← Back to Login |
| 285 | text | Don't have an account? |
| 287 | text | Sign up |

### `app/(auth)/login/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 78 | text | EN |

### `app/(auth)/register/page.tsx` (25)

| Line | Kind | Text |
|---|---|---|
| 77 | text | Registration Successful! |
| 80 | text | We've sent a verification email to |
| 101 | text | Next Steps |
| 104 | text | Check your email inbox |
| 105 | text | Click the verification link in the email |
| 106 | text | Return here and sign in with your credentials |
| 117 | text | Go to Login |
| 131 | text | Create your account |
| 134 | text | Join CleanMateX and start managing your laundry business |
| 168 | text | Full Name * |
| 181 | placeholder | John Doe |
| 190 | text | Email address * |
| 204 | placeholder | you@example.com |
| 213 | text | Password * |
| 228 | placeholder | At least 8 characters |
| 250 | text | Must be at least 8 characters with uppercase, lowercase, and number |
| 257 | text | Confirm Password * |
| 272 | placeholder | Re-enter your password |
| 309 | text | I agree to the |
| 311 | text | Terms of Service |
| 313 | text | and |
| 315 | text | Privacy Policy |
| 350 | text | Creating account... |
| 361 | text | Already have an account? |
| 366 | text | Sign in |

### `app/(auth)/verify-email/page.tsx` (20)

| Line | Kind | Text |
|---|---|---|
| 130 | text | Verifying your email... |
| 133 | text | Please wait while we verify your email address |
| 163 | text | Email Verified! |
| 166 | text | Your email has been successfully verified |
| 187 | text | You can now sign in with your credentials. Redirecting to login page... |
| 198 | text | Go to Login Now |
| 228 | text | Verification Failed |
| 231 | text | We couldn't verify your email address |
| 261 | text | Resend Verification Email |
| 267 | text | Back to Login |
| 297 | text | Verify your email |
| 301 | text | We sent a verification email to |
| 325 | text | Verification email sent successfully! Check your inbox. |
| 374 | text | What's next? |
| 377 | text | Check your email inbox (and spam folder) |
| 378 | text | Click the verification link in the email |
| 379 | text | Return here to sign in |
| 401 | text | Didn't receive the email? |
| 406 | text | Resend |
| 417 | text | ← Back to Login |

### `app/api-docs/page.tsx` (8)

| Line | Kind | Text |
|---|---|---|
| 43 | setError | Request timeout - The API documentation is taking too long to generate. This might be due to file scanning. Please try again. |
| 56 | text | Loading API documentation... |
| 66 | text | Failed to load API documentation |
| 71 | text | Retry |
| 83 | text | No API documentation available |
| 84 | text | The API spec could not be loaded |
| 100 | text | API route scanning may have failed. This is common on Vercel due to file system limitations. The documentation structure is available, but individual endpoint details may be missing. |
| 100 | text | Note: |

### `app/dashboard/b2b/customers/[id]/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 189 | text | Customer #: |

### `app/dashboard/b2b/customers/new/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 202 | placeholder | customer@example.com |

### `app/dashboard/b2b/statements/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 148 | text | No statements yet. Generate a statement from a B2B customer detail page. |

### `app/dashboard/catalog/customer-categories/page.tsx` (14)

| Line | Kind | Text |
|---|---|---|
| 237 | text | Loading... |
| 243 | text | Code |
| 244 | text | Name |
| 245 | text | Type |
| 247 | text | Status |
| 252 | text | Actions |
| 280 | text | System |
| 325 | text | Name (English) * |
| 329 | placeholder | Walk-in |
| 335 | text | Code * |
| 352 | text | Name (Arabic) |
| 362 | text | System Type |
| 384 | text | Display Order |
| 415 | text | Active |

### `app/dashboard/catalog/preferences/page.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 1827 | text | You do not have permission to view the preferences catalog. |
| 1833 | aria-label | Breadcrumb |
| 2003 | placeholder | e.g. DELICATE_STARCH |
| 2014 | placeholder | e.g. Delicate + Light Starch |

### `app/dashboard/catalog/pricing/[id]/page.tsx` (44)

| Line | Kind | Text |
|---|---|---|
| 221 | text | Loading... |
| 234 | text | Back to Price Lists |
| 279 | text | Export |
| 474 | text | Add Item |
| 480 | title | Import all active products with their default prices |
| 482 | text | Import All Products |
| 486 | text | Import CSV |
| 490 | text | Export CSV |
| 503 | text | Import All Products with Default Prices |
| 508 | text | This will import all active products from your catalog into this price list using their default |
| 510 | text | prices. |
| 522 | text | Overwrite existing price list items (if unchecked, only new products will be added) |
| 529 | text | Note: |
| 531 | text | Only products with default prices will be imported |
| 532 | text | Products without default prices will be skipped |
| 533 | text | You can edit prices after import |
| 539 | text | Cancel |
| 552 | text | No items in this price list |
| 553 | text | Add First Item |
| 562 | text | Product |
| 563 | text | Price ( |
| 564 | text | Discount % |
| 565 | text | Quantity Range |
| 566 | text | Status |
| 567 | text | Actions |
| 648 | text | Price List Settings |
| 651 | text | Edit |
| 661 | text | Cancel |
| 670 | text | Name (EN) * |
| 679 | text | Name (AR) |
| 687 | text | Description (EN) |
| 697 | text | Description (AR) |
| 707 | text | Type |
| 714 | text | Standard |
| 715 | text | Express |
| 716 | text | VIP |
| 717 | text | Seasonal |
| 719 | text | Promotional |
| 722 | text | Type cannot be changed when items exist |
| 726 | text | Priority |
| 735 | text | Effective From |
| 744 | text | Effective To |
| 760 | text | Default price list for this type |
| 771 | text | Active |

### `app/dashboard/catalog/pricing/page.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 120 | placeholder | Priority |
| 146 | text | Items |
| 159 | text | Edit |

### `app/dashboard/components/overdue-orders-widget.tsx` (15)

| Line | Kind | Text |
|---|---|---|
| 87 | text | Overdue Orders |
| 92 | text | Loading... |
| 108 | text | Overdue Orders |
| 113 | text | order |
| 113 | text | past due date |
| 122 | aria-label | Refresh |
| 141 | text | All Caught Up! |
| 144 | text | No overdue orders at the moment |
| 154 | text | Order |
| 157 | text | Customer |
| 160 | text | Due Date |
| 163 | text | Overdue |
| 166 | text | Action |
| 218 | aria-label | View order |
| 234 | text | View all overdue orders → |

### `app/dashboard/components/workflow-stats-widget.tsx` (15)

| Line | Kind | Text |
|---|---|---|
| 77 | text | Workflow Statistics |
| 84 | text | Loading... |
| 95 | text | Workflow Statistics |
| 152 | text | Workflow Statistics |
| 159 | aria-label | Refresh |
| 174 | text | Total |
| 186 | text | In Progress |
| 198 | text | Ready |
| 210 | text | Overdue |
| 235 | text | Orders |
| 268 | text | SLA Compliance |
| 285 | text | Excellent |
| 290 | text | Good |
| 295 | text | Needs Attention |
| 303 | text | Avg Completion Time |

### `app/dashboard/customers/[id]/page.tsx` (30)

| Line | Kind | Text |
|---|---|---|
| 187 | text | Customer Not Found |
| 194 | text | Back to Customers |
| 213 | text | Customers |
| 262 | text | Customer #: |
| 270 | text | Phone: |
| 275 | title | Verified |
| 283 | text | Email: |
| 299 | text | Upgrade to Full |
| 306 | text | Edit |
| 477 | text | Personal Information |
| 482 | text | First Name |
| 486 | text | Last Name |
| 492 | text | Phone |
| 498 | text | Email |
| 509 | text | Company Information |
| 514 | text | Company Name |
| 520 | text | Tax ID |
| 526 | text | Credit Limit |
| 534 | text | Payment Terms (Days) |
| 546 | text | Preferences |
| 551 | text | Language |
| 552 | text | English |
| 557 | text | Folding |
| 563 | text | Fragrance |
| 569 | text | Starch Level |
| 580 | text | Account Information |
| 585 | text | Customer Type |
| 591 | text | Status |
| 597 | text | Phone Verified |
| 603 | text | Member Since |

### `app/dashboard/erp-lite/gl/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 112 | text | ERP-Lite |

### `app/dashboard/layout.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 123 | text | Redirecting to login... |

### `app/dashboard/orders/[id]/full/order-details-full-client.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 942 | text | line(s) |

### `app/dashboard/orders/[id]/order-detail-error.tsx` (9)

| Line | Kind | Text |
|---|---|---|
| 74 | text | Order ID: |
| 88 | text | Hide debug info |
| 93 | text | Show debug info (to trace error) |
| 104 | text | Condition: |
| 110 | text | Server error: |
| 116 | text | Tenant ID (used for query): |
| 122 | text | User ID: |
| 127 | text | Order ID (queried): |
| 132 | text | Possible causes: order deleted, tenant mismatch (order belongs to different tenant), database connection issue, or RLS policy blocking access. |

### `app/dashboard/qa/[id]/page.tsx` (5)

| Line | Kind | Text |
|---|---|---|
| 127 | setError | Order not found |
| 215 | text | Order not found |
| 257 | text | Quantity: |
| 262 | text | Quality Decision: |
| 349 | text | QA Actions |

### `app/dashboard/ready/[id]/page.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 137 | text | &laquo; |
| 145 | text | &nbsp;&bull;&nbsp; |
| 447 | text | &times; |
| 452 | title | print-preview |

### `app/dashboard/receipts/[orderId]/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 51 | text | Back |

### `app/dashboard/reports/layout.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 268 | aria-label | Report tabs |

### `app/dashboard/reports/print/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 139 | text | Generated: |

### `app/dashboard/settings/allsettings/page.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 78 | text | Loading settings... |
| 145 | text | 7-Layer Settings Resolution |
| 148 | text | Settings are resolved through 7 layers: System Default → Profile → Plan → Feature Flags → Tenant → Branch → User. Look for source badges next to each setting to see where the value comes from. |
| 158 | text | Learn more about settings resolution |

### `app/dashboard/settings/branches/[id]/page.tsx` (6)

| Line | Kind | Text |
|---|---|---|
| 88 | text | Loading branch settings... |
| 97 | title | Error |
| 164 | text | Back to Settings |
| 174 | text | Branch Settings |
| 181 | text | Reset All Overrides |
| 189 | text | Branch-level overrides apply to all users in this branch and take precedence over tenant-level settings. |

### `app/dashboard/settings/general/page.tsx` (24)

| Line | Kind | Text |
|---|---|---|
| 207 | placeholder | My Laundry Business |
| 236 | placeholder | info@business.com |
| 273 | placeholder | 123 Main Street |
| 283 | placeholder | Muscat |
| 303 | text | Oman |
| 304 | text | Saudi Arabia |
| 305 | text | United Arab Emirates |
| 306 | text | Kuwait |
| 307 | text | Bahrain |
| 308 | text | Qatar |
| 336 | text | Asia/Muscat (GMT+4) |
| 337 | text | Asia/Riyadh (GMT+3) |
| 338 | text | Asia/Dubai (GMT+4) |
| 339 | text | Asia/Kuwait (GMT+3) |
| 340 | text | Asia/Bahrain (GMT+3) |
| 341 | text | Asia/Qatar (GMT+3) |
| 362 | text | SAR - Saudi Riyal |
| 363 | text | OMR - Omani Rial |
| 364 | text | AED - UAE Dirham |
| 365 | text | KWD - Kuwaiti Dinar |
| 366 | text | BHD - Bahraini Dinar |
| 367 | text | QAR - Qatari Riyal |
| 377 | text | English |
| 378 | text | العربية (Arabic) |

### `app/dashboard/settings/permissions/page.tsx` (48)

| Line | Kind | Text |
|---|---|---|
| 208 | text | Access Denied |
| 209 | text | You don&apos;t have permission to view permissions management. |
| 210 | text | Admin access required. |
| 248 | text | Permissions Management |
| 249 | text | View and manage permissions for your organization |
| 262 | text | Create Permission |
| 272 | text | Total Permissions |
| 276 | text | System Permissions |
| 280 | text | Custom Permissions |
| 312 | placeholder | Search permissions by code, name, or category... |
| 327 | text | All ( |
| 351 | text | Code |
| 354 | text | Name (EN / AR) |
| 357 | text | Category |
| 360 | text | Used By |
| 363 | text | Type |
| 366 | text | Actions |
| 403 | text | role |
| 407 | text | System |
| 411 | text | Custom |
| 459 | text | Create New Permission |
| 471 | text | Code * |
| 472 | text | (format: resource:action) |
| 480 | placeholder | e.g. orders:read |
| 483 | text | Only lowercase letters and underscores allowed, separated by colon |
| 488 | text | Name (English) * |
| 493 | placeholder | e.g. Read Orders |
| 498 | text | Name (Arabic) |
| 508 | text | Category * |
| 513 | placeholder | e.g. Orders |
| 518 | text | Description |
| 532 | text | Cancel |
| 540 | text | Create |
| 553 | text | Edit Permission |
| 565 | text | Code |
| 572 | text | Permission code cannot be changed |
| 575 | text | Name (English) * |
| 584 | text | Name (Arabic) |
| 594 | text | Category |
| 603 | text | Description |
| 617 | text | Cancel |
| 625 | text | Update |
| 641 | text | Delete Permission |
| 643 | text | Are you sure you want to delete the permission |
| 645 | text | &quot; |
| 645 | text | ? This action cannot be undone. |
| 652 | text | Cancel |
| 660 | text | Delete |

### `app/dashboard/settings/preferences/page.tsx` (31)

| Line | Kind | Text |
|---|---|---|
| 75 | text | Loading preferences... |
| 87 | text | Error Loading Preferences |
| 91 | text | Try Again |
| 110 | text | User Preferences |
| 113 | text | Customize your personal settings and preferences |
| 124 | text | Language & Localization |
| 132 | label | Language |
| 133 | description | Preferred language for the interface |
| 138 | text | English |
| 139 | text | Arabic |
| 145 | label | Timezone |
| 146 | description | Your local timezone |
| 151 | text | Asia/Muscat (Oman) |
| 152 | text | Asia/Riyadh (Saudi Arabia) |
| 153 | text | Asia/Dubai (UAE) |
| 159 | label | Date Format |
| 160 | description | Preferred date display format |
| 165 | text | DD/MM/YYYY |
| 166 | text | MM/DD/YYYY |
| 167 | text | YYYY-MM-DD |
| 191 | text | Notifications |
| 199 | label | Email Notifications |
| 200 | description | Receive notifications via email |
| 210 | label | SMS Notifications |
| 211 | description | Receive notifications via SMS |
| 221 | label | Browser Notifications |
| 222 | description | Show browser push notifications |
| 236 | text | Workspace |
| 243 | label | Default Branch |
| 244 | description | Branch selected by default when logging in |
| 249 | text | Select branch... |

### `app/dashboard/settings/roles/page.tsx` (37)

| Line | Kind | Text |
|---|---|---|
| 201 | text | Access Denied |
| 202 | text | You don&apos;t have permission to view roles and permissions. |
| 203 | text | Admin access required. |
| 243 | text | Total Roles |
| 247 | text | System Roles |
| 251 | text | Custom Roles |
| 279 | text | Role |
| 282 | text | Code |
| 285 | text | Type |
| 288 | text | Permissions |
| 291 | text | Users |
| 294 | text | Actions |
| 302 | text | No roles found. |
| 332 | text | System |
| 336 | text | Custom |
| 353 | title | Manage Permissions |
| 408 | text | Code * |
| 413 | placeholder | e.g. warehouse_manager |
| 418 | text | Name (English) * |
| 423 | placeholder | e.g. Warehouse Manager |
| 428 | text | Name (Arabic) |
| 438 | text | Description |
| 452 | text | Cancel |
| 460 | text | Create |
| 487 | text | Code |
| 494 | text | Role code cannot be changed |
| 497 | text | Name (English) * |
| 506 | text | Name (Arabic) |
| 516 | text | Description |
| 530 | text | Cancel |
| 538 | text | Update |
| 554 | text | Delete Role |
| 556 | text | Are you sure you want to delete the role |
| 558 | text | &quot; |
| 558 | text | ? This action cannot be undone. |
| 565 | text | Cancel |
| 573 | text | Delete |

### `app/page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 35 | text | Loading... |

### `app/register/tenant/page.tsx` (35)

| Line | Kind | Text |
|---|---|---|
| 212 | text | Create Your Account |
| 213 | text | Start your 14-day free trial. No credit card required. |
| 243 | text | Business Info |
| 244 | text | Preferences |
| 245 | text | Admin Account |
| 279 | text | Business Name |
| 283 | placeholder | e.g., Fresh Clean Laundry |
| 291 | text | Business Name (Arabic) |
| 300 | text | Optional: Arabic name for bilingual support |
| 304 | text | Slug (URL Identifier) |
| 313 | placeholder | e.g., fresh-clean |
| 319 | text | Checking... |
| 328 | text | Will be used in your URL: app.cleanmatex.com/fresh-clean |
| 332 | text | Business Email |
| 339 | placeholder | admin@freshclean.com |
| 347 | text | Phone Number |
| 367 | text | Country |
| 379 | text | Currency |
| 388 | text | Used for invoices and pricing |
| 392 | text | Timezone |
| 401 | text | For scheduling and timestamps |
| 405 | text | Default Language |
| 422 | text | Admin Email |
| 432 | placeholder | admin@freshclean.com |
| 437 | text | You'll use this email to log in |
| 441 | text | Password |
| 455 | text | Min 8 characters with uppercase, number, and special character |
| 459 | text | Display Name |
| 468 | placeholder | John Admin |
| 477 | message | Your 14-day free trial starts immediately. No credit card required. |
| 488 | text | Back |
| 493 | text | Next |
| 495 | text | Create Account |
| 504 | text | Already have an account? |
| 506 | text | Sign in |

### `app/register/tenant/success/page.tsx` (12)

| Line | Kind | Text |
|---|---|---|
| 42 | text | Welcome to CleanMateX! |
| 46 | text | Your account has been created successfully |
| 54 | title | 14-Day Free Trial Started |
| 55 | message | You now have full access to all features. No credit card required. |
| 61 | text | Next Steps: |
| 65 | text | Complete your tenant profile and upload your logo |
| 69 | text | Configure your service categories and pricing |
| 73 | text | Add your first customer and create an order |
| 77 | text | Invite team members to collaborate |
| 86 | text | Go to Dashboard |
| 91 | text | Need help getting started? |
| 93 | text | View documentation |

### `src/features/access/ui/permissions-inspector/cmx-permissions-inspector-panel.tsx` (12)

| Line | Kind | Text |
|---|---|---|
| 83 | text | No explicit page permissions. |
| 115 | text | No explicit API permission requirement recorded. |
| 259 | title | Refresh permissions & feature flags |
| 345 | text | Page: |
| 348 | text | Path: |
| 351 | text | Route Pattern: |
| 366 | title | Page access |
| 375 | text | Actions |
| 410 | text | No explicit action requirements. |
| 560 | text | Missing route access contract for this page. |
| 563 | text | Registered contracts: |
| 577 | text | Close |

### `src/features/auth/ui/PermissionAssignmentModal.tsx` (11)

| Line | Kind | Text |
|---|---|---|
| 201 | text | Assign Permissions to |
| 204 | text | Select permissions to assign to this role. Users with this role will have access to the selected permissions. |
| 208 | text | ⚠ System role — changes will affect all users with this role |
| 216 | aria-label | Close |
| 228 | placeholder | Search permissions... |
| 280 | text | permission |
| 320 | text | system |
| 352 | text | permission |
| 352 | text | selected |
| 359 | text | Cancel |
| 369 | text | Save Permissions |

### `src/features/auth/ui/RequireFeature.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 128 | text | Upgrade Required |
| 144 | text | Upgrade Plan |

### `src/features/b2b/ui/b2b-statements-print-rprt.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 62 | text | CleanMateX |

### `src/features/catalog/ui/bulk-import-modal.tsx` (15)

| Line | Kind | Text |
|---|---|---|
| 124 | text | Bulk Import Price List Items |
| 130 | text | Import Instructions |
| 132 | text | Download the CSV template |
| 133 | text | Fill in product codes/IDs, prices, discounts, and quantity ranges |
| 134 | text | Upload the completed CSV file |
| 135 | text | Review validation results before confirming |
| 142 | text | CSV Template |
| 143 | text | Download template with required columns |
| 146 | text | Download Template |
| 153 | text | Select CSV File |
| 161 | text | Selected: |
| 162 | text | KB) |
| 170 | text | Preview ( |
| 170 | text | rows) |
| 201 | text | Cancel |

### `src/features/catalog/ui/import-modal.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 84 | text | CSV |
| 111 | text | Row |
| 113 | text | more... |

### `src/features/catalog/ui/price-history-timeline.tsx` (16)

| Line | Kind | Text |
|---|---|---|
| 142 | text | Loading price history... |
| 153 | text | Filters |
| 157 | text | From Date |
| 161 | text | To Date |
| 165 | text | Entity Type |
| 167 | text | All Types |
| 168 | text | Price List Item |
| 169 | text | Product Default |
| 174 | text | Export CSV |
| 184 | text | No price history available |
| 185 | text | Price changes will be tracked here automatically |
| 215 | text | Old Price |
| 216 | text | New Price |
| 219 | text | Old Discount |
| 220 | text | New Discount |
| 226 | text | Reason |

### `src/features/catalog/ui/price-list-item-modal.tsx` (11)

| Line | Kind | Text |
|---|---|---|
| 202 | text | Product * |
| 212 | placeholder | Search products by name or code... |
| 234 | text | Code: |
| 245 | text | Selected: |
| 253 | text | Price ( |
| 271 | text | Discount (%) |
| 290 | text | Min Quantity * |
| 305 | text | Max Quantity (leave empty for unlimited) |
| 313 | placeholder | Unlimited |
| 329 | text | Active |
| 334 | text | Cancel |

### `src/features/customers/ui/customer-b2b-tabs.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 43 | text | for billing and statements. |
| 48 | text | Add contacts via API or B2B contacts management. |

### `src/features/customers/ui/customer-create-modal.tsx` (7)

| Line | Kind | Text |
|---|---|---|
| 104 | setError | Please select a B2B category |
| 346 | placeholder | customer@example.com |
| 357 | text | B2B Category |
| 367 | text | Select category |
| 383 | text | Customer Category |
| 392 | text | Select category (optional) |
| 428 | text | (AR) |

### `src/features/customers/ui/customer-table.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 286 | aria-label | Pagination |
| 293 | text | Previous |
| 341 | text | Next |

### `src/features/customers/ui/upgrade-profile-modal.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 243 | placeholder | customer@example.com |

### `src/features/dashboard/ui/UsageWidget.tsx` (10)

| Line | Kind | Text |
|---|---|---|
| 107 | text | Retry |
| 120 | text | Usage & Limits |
| 140 | text | Orders |
| 172 | text | Users |
| 204 | text | Branches |
| 262 | text | more warnings |
| 276 | text | View Details |
| 286 | text | Upgrade Plan |
| 298 | title | Refresh usage data |
| 299 | text | 🔄 Refresh |

### `src/features/dashboard/ui/Widget.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 108 | aria-label | Refresh widget |

### `src/features/dashboard/ui/dashboard-home-page.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 17 | text | Loading... |

### `src/features/drivers/ui/driver-form-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 84 | placeholder | +968 9xxxxxxx |

### `src/features/erp-lite/ui/erp-lite-finance-actions-audit-screen.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 63 | text | ERP-Lite |

### `src/features/erp-lite/ui/erp-lite-home-screen.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 196 | text | ERP-Lite |

### `src/features/erp-lite/ui/erp-lite-journals-screen.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 67 | text | ERP-Lite |

### `src/features/erp-lite/ui/erp-lite-readiness-screen.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 20 | text | READY |
| 28 | text | WARNING |
| 35 | text | NOT READY |

### `src/features/erp-lite/ui/erp-lite-setup-wizard-screen.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 50 | text | ERP-Lite |

### `src/features/erp-lite/ui/gl-inquiry-table.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 124 | text | DR |
| 129 | text | CR |

### `src/features/erp-lite/ui/gl-journal-detail-panel.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 245 | text | DR |
| 252 | text | CR |

### `src/features/finance/vouchers/ui/add-line-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 488 | placeholder | e.g. RENT, UTILITIES |

### `src/features/finance/vouchers/ui/voucher-direction-badge.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 21 | text | IN |
| 29 | text | OUT |
| 36 | text | NEUTRAL |

### `src/features/finance/vouchers/ui/voucher-post-preview-dialog.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 104 | text | No draft lines to post. |
| 112 | text | Amount |

### `src/features/inventory/ui/add-item-modal.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 156 | text | RETAIL_ITEMS |

### `src/features/inventory/ui/edit-item-modal.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 168 | text | (EN) |
| 178 | text | (AR) |

### `src/features/marketing/ui/discount-rule-form-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 260 | text | Fixed |

### `src/features/marketing/ui/gift-card-issue-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 326 | placeholder | Birthday Gift |

### `src/features/marketing/ui/gift-card-sell-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 332 | placeholder | Birthday Gift |

### `src/features/marketing/ui/loyalty-config-client.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 147 | cmxMessage | Tier name is required |
| 148 | cmxMessage | Load config first |
| 396 | label | Sort Order |

### `src/features/notifications/ui/whatsapp-template-settings.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 116 | placeholder | HX… |

### `src/features/orders/orderdtlworkspace/ui/order-workspace-loading.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 6 | aria-label | Loading order workspace |

### `src/features/orders/orderdtlworkspace/ui/order-workspace-section-nav.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 35 | aria-label | Order workspace sections |

### `src/features/orders/ui/OrderPiecesManager.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 290 | text | Missing required parameters: orderId, itemId, or tenantId |

### `src/features/orders/ui/PiecesErrorBoundary.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 69 | text | Failed to load pieces |
| 80 | text | Try Again |

### `src/features/orders/ui/customer-create-modal.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 400 | placeholder | customer@example.com |

### `src/features/orders/ui/customer-edit-modal.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 429 | placeholder | customer@example.com |

### `src/features/orders/ui/order-details-print.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 48 | text | CleanMateX |

### `src/features/orders/ui/order-financial/tax-document-lifecycle-timeline.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 127 | label | Cancelled at |
| 130 | label | Cancellation reason |

### `src/features/orders/ui/order-history-print-rprt.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 68 | text | CleanMateX |

### `src/features/orders/ui/order-invoices-payments-print-rprt.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 75 | text | CleanMateX |

### `src/features/orders/ui/order-items-list.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 223 | text | Loading pieces... |

### `src/features/orders/ui/order-payments-print-rprt.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 65 | text | CleanMateX |

### `src/features/orders/ui/order-receipt-print.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 111 | text | CleanMateX |

### `src/features/orders/ui/orders-edit-history-tab-rprt.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 855 | text | field |
| 856 | text | added |
| 857 | text | removed |
| 858 | text | modified |

### `src/features/orders/ui/orders-invoices-tab-rprt.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 80 | text | Total |
| 83 | text | Status |
| 86 | text | Created |
| 89 | text | Actions |

### `src/features/orders/ui/orders-receipts-tab-rprt.tsx` (7)

| Line | Kind | Text |
|---|---|---|
| 50 | text | ID |
| 53 | text | Type |
| 56 | text | Channel |
| 59 | text | Status |
| 62 | text | Sent At |
| 65 | text | Delivered At |
| 68 | text | Retries |

### `src/features/orders/ui/orders-stock-tab-rprt.tsx` (8)

| Line | Kind | Text |
|---|---|---|
| 60 | text | ID |
| 63 | text | Product |
| 66 | text | Product ID |
| 69 | text | Type |
| 72 | text | Quantity |
| 75 | text | Branch |
| 78 | text | Date |
| 81 | text | Reference |

### `src/features/orders/ui/preferences/RepeatLastOrderPanel.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 136 | cmxMessage | Failed to load last order preferences |

### `src/features/orders/ui/summary-cart-item.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 374 | title | Override price |
| 385 | title | Remove item |

### `src/features/pos-sessions/ui/pos-shift-report-rprt.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 202 | text | SHA-256: |

### `src/features/receipts/ui/receipt-preview.tsx` (9)

| Line | Kind | Text |
|---|---|---|
| 106 | text | Send Receipt |
| 112 | text | Receipt Type |
| 127 | text | Delivery Channels |
| 154 | text | Language |
| 160 | text | English |
| 161 | text | Arabic |
| 166 | text | Send Receipt |
| 175 | text | Receipt History |
| 188 | text | via |

### `src/features/reports/ui/financial-reports-client.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 102 | cmxMessage | Failed to load orders summary |
| 119 | cmxMessage | Failed to load payments breakdown |
| 138 | cmxMessage | Failed to load tax report |

### `src/features/reports/ui/orders-report-table-rprt.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 210 | aria-label | Previous page |
| 222 | aria-label | Next page |

### `src/features/settings/ui/BranchSettings.tsx` (8)

| Line | Kind | Text |
|---|---|---|
| 115 | cmxMessage | Branch setting updated successfully |
| 135 | cmxMessage | Branch setting override removed |
| 156 | text | Branch Settings |
| 157 | text | Select a branch to view and override settings at the branch level. |
| 182 | text | Reload |
| 191 | text | Loading branches... |
| 195 | text | No branch selected. |
| 201 | description | View all effective settings for this branch and manage branch-level overrides. |

### `src/features/settings/ui/FeatureFlagsSettings.tsx` (10)

| Line | Kind | Text |
|---|---|---|
| 81 | text | Feature Flags |
| 82 | text | View all active feature flags defined in Platform HQ that may affect this tenant. |
| 88 | placeholder | Search flags... |
| 101 | text | Key |
| 102 | text | Name |
| 103 | text | Category |
| 104 | text | Binding |
| 105 | text | Status |
| 111 | text | Loading feature flags... |
| 117 | text | No feature flags found. |

### `src/features/settings/ui/PlanLimitsSettings.tsx` (7)

| Line | Kind | Text |
|---|---|---|
| 52 | text | Loading plan limits... |
| 72 | text | Plan Limits & Usage |
| 73 | text | View your current plan constraints and how much you have used. |
| 81 | title | Orders |
| 89 | title | Users |
| 97 | title | Branches |
| 105 | title | Storage (MB) |

### `src/features/settings/ui/SettingsTable.tsx` (16)

| Line | Kind | Text |
|---|---|---|
| 143 | text | Scope: |
| 151 | placeholder | Search by code, name, or value... |
| 164 | text | Code |
| 165 | text | Name |
| 166 | text | Scope |
| 167 | text | Effective Value |
| 168 | text | Source |
| 169 | text | Actions |
| 175 | text | Loading settings... |
| 181 | text | No settings found. |
| 244 | text | Save |
| 252 | text | Cancel |
| 262 | text | Edit |
| 274 | text | Reset |
| 279 | text | Locked |
| 279 | title | This setting can only be set once and is now locked |

### `src/features/settings/ui/TenantSettings.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 56 | cmxMessage | Tenant setting updated successfully |
| 73 | cmxMessage | Tenant setting override removed |
| 89 | title | Tenant Settings |
| 90 | description | View all effective settings for this tenant and manage tenant-level overrides. |

### `src/features/settings/ui/UserSettings.tsx` (8)

| Line | Kind | Text |
|---|---|---|
| 99 | cmxMessage | User setting updated successfully |
| 119 | cmxMessage | User setting override removed |
| 139 | text | User Settings |
| 140 | text | Select a user to view and override user-scoped settings for that user. |
| 165 | text | Reload |
| 173 | text | Loading users... |
| 177 | text | No user selected. |
| 187 | description | View all effective settings for this user and manage user-level overrides. |

### `src/features/settings/ui/enhanced-setting-field.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 116 | title | Explain how this value is resolved |
| 128 | title | Reset to default value |
| 147 | text | Locked by profile |
| 155 | text | This setting cannot be overridden |

### `src/features/settings/ui/explain-drawer.tsx` (10)

| Line | Kind | Text |
|---|---|---|
| 87 | text | Setting Resolution Trace |
| 124 | text | Final Effective Value |
| 143 | text | Profile Inheritance Chain |
| 158 | text | Resolution flows from left (child) to right (root) |
| 167 | text | Resolution Layers (7-Layer Algorithm) |
| 185 | text | Computed at: |
| 193 | text | Close |
| 238 | text | Source: |
| 254 | text | Value: |
| 262 | text | Reason: |

### `src/features/settings/ui/profile-info-card.tsx` (8)

| Line | Kind | Text |
|---|---|---|
| 85 | text | System Profile |
| 88 | title | Profile Locked |
| 101 | text | Locked |
| 108 | text | No profile assigned |
| 123 | text | Recomputing... |
| 128 | text | Recompute |
| 138 | text | This profile is locked by the platform administrator. You can view settings but cannot override them. |
| 147 | text | No system profile is assigned. All settings use system defaults. Contact your administrator to assign a profile. |

### `src/features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx` (77)

| Line | Kind | Text |
|---|---|---|
| 144 | setError | Please select a cancellation reason |
| 202 | text | Loading subscription data... |
| 213 | title | Error Loading Subscription |
| 229 | text | Subscription & Billing |
| 232 | text | Manage your plan and view usage |
| 254 | title | Success |
| 262 | title | Error |
| 272 | title | Trial Period Active |
| 284 | text | Upgrade Now |
| 293 | text | Current Plan |
| 296 | text | Plan |
| 302 | text | Price |
| 304 | text | /month |
| 324 | text | Usage & Limits |
| 325 | text | Period: |
| 334 | text | Orders |
| 347 | text | % used |
| 354 | text | Users |
| 367 | text | % used |
| 374 | text | Branches |
| 387 | text | % used |
| 394 | text | Storage |
| 398 | text | MB |
| 398 | text | MB / |
| 407 | text | % used |
| 415 | text | ⚠️ Warnings ( |
| 438 | text | Available Plans |
| 447 | text | Monthly |
| 457 | text | Yearly |
| 459 | text | (Save 20%) |
| 468 | text | Plan |
| 471 | text | Price |
| 474 | text | Orders |
| 477 | text | Users |
| 480 | text | Branches |
| 483 | text | Key Features |
| 486 | text | Action |
| 508 | text | Current |
| 513 | text | Recommended |
| 523 | text | /mo |
| 537 | text | PDF |
| 540 | text | WhatsApp |
| 543 | text | Driver App |
| 546 | text | Multi-Branch |
| 549 | text | API |
| 555 | text | Current Plan |
| 565 | text | Upgrade |
| 569 | text | Downgrade |
| 590 | text | Cancel Subscription |
| 602 | text | Upgrade to |
| 619 | title | Error |
| 626 | text | Select Billing Cycle |
| 639 | text | Monthly - |
| 640 | text | /mo |
| 652 | text | Yearly - |
| 657 | text | /mo |
| 659 | text | Save 20%! |
| 669 | text | New Features You&apos;ll Get: |
| 673 | text | ✓ PDF Invoices |
| 674 | text | ✓ WhatsApp Receipts |
| 675 | text | ✓ Driver App |
| 676 | text | ✓ Multi-Branch Support |
| 677 | text | ✓ Advanced Analytics |
| 678 | text | ✓ API Access |
| 683 | text | Payment Integration |
| 686 | text | Payment gateway integration coming soon. For now, your plan will be upgraded immediately and you&apos;ll receive an invoice via email. |
| 699 | text | Cancel |
| 722 | text | Cancel Subscription |
| 729 | title | Error |
| 737 | title | Warning |
| 738 | message | Your subscription will remain active until the end of the current billing period. You will lose access to premium features after cancellation. |
| 743 | text | Reason for Cancellation * |
| 759 | placeholder | Select a reason |
| 764 | text | Additional Feedback (Optional) |
| 773 | placeholder | Help us improve by sharing your feedback... |
| 779 | text | Effective Date: |
| 793 | text | Keep Subscription |

### `src/features/users/ui/create-user-screen.tsx` (6)

| Line | Kind | Text |
|---|---|---|
| 287 | placeholder | user@example.com |
| 401 | placeholder | John |
| 414 | placeholder | Doe |
| 449 | placeholder | John Doe |
| 555 | text | Loading branches... |
| 592 | text | Loading roles... |

### `src/features/users/ui/rbac/assign-roles-dialog.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 219 | text | System |
| 225 | text | perms |

### `src/features/users/ui/rbac/permission-override-dialog.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 299 | text | Pending ( |

### `src/features/users/ui/rbac/user-roles-tab.tsx` (6)

| Line | Kind | Text |
|---|---|---|
| 144 | text | Type |
| 147 | text | Perms |
| 176 | text | System |
| 180 | text | Custom |
| 223 | text | Resource |
| 226 | text | Resource ID |

### `src/features/users/ui/user-filters-bar.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 300 | text | &quot; |
| 300 | text | : &quot; |

### `src/features/users/ui/user-modal.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 217 | placeholder | user@example.com |
| 338 | placeholder | John Doe |

### `src/features/workflow/ui/processing-item-row.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 227 | text | Item-level tracking active |
| 229 | text | Status: |
| 239 | text | Notes: |

### `src/features/workflow/ui/processing-modal-filters.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 111 | aria-label | Filter items and pieces |

### `src/features/workflow/ui/processing-modal.tsx` (3)

| Line | Kind | Text |
|---|---|---|
| 952 | text | Order ID: |
| 1037 | text | Loading pieces... |
| 1082 | text | (Ctrl+S) |

### `src/features/workflow/ui/processing-table.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 460 | text | 1st |
| 783 | text | 1st |

### `src/features/workflow/ui/split-confirmation-dialog.tsx` (6)

| Line | Kind | Text |
|---|---|---|
| 114 | text | What will happen: |
| 116 | text | • A new sub-order will be created |
| 117 | text | piece |
| 117 | text | will be moved to the new order |
| 118 | text | • Original order will keep remaining pieces |
| 119 | text | • Both orders will reference each other |

### `src/ui/data-display/cmx-data-grid.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 875 | aria-label | Data grid |

### `src/ui/data-display/cmx-datatable.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 872 | text | Showing |
| 874 | text | of |

### `src/ui/data-display/cmx-editable-datatable.tsx` (14)

| Line | Kind | Text |
|---|---|---|
| 529 | text | Deleted |
| 544 | title | Save |
| 553 | title | Cancel |
| 564 | title | Edit |
| 570 | title | Delete Row |
| 571 | description | Are you sure you want to delete this row? This action cannot be undone. |
| 574 | title | Delete |
| 582 | title | Remove Row |
| 583 | description | This will soft-delete the row. It can be restored later. |
| 586 | title | Soft Remove |
| 662 | text | Add Row |
| 673 | text | Save All ( |
| 746 | text | No data to display. |
| 762 | text | Row |

### `src/ui/data-display/cmx-processing-step-timeline.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 198 | aria-label | Processing steps |

### `src/ui/forms/cmx-form-section.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 102 | aria-label | Toggle section |

### `src/ui/navigation/cmx-language-switcher.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 42 | aria-label | Switch language |
| 62 | text | English |

### `src/ui/navigation/cmx-progress-steps.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 34 | aria-label | Progress |

### `src/ui/navigation/cmx-sidebar.tsx` (2)

| Line | Kind | Text |
|---|---|---|
| 326 | aria-label | Toggle menu |
| 585 | text | CleanMateX v1.0 |

### `src/ui/patterns/cmx-wizard.tsx` (4)

| Line | Kind | Text |
|---|---|---|
| 93 | text | Back |
| 105 | text | Skip |
| 145 | text | Step |
| 146 | text | of |

### `src/ui/primitives/cmx-spinner.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 37 | text | Loading... |

### `src/ui/primitives/data-table.tsx` (1)

| Line | Kind | Text |
|---|---|---|
| 378 | aria-label | Data table |

## Developer-only: JWT Test page (not translated, ruling 1)

### `app/dashboard/jhtestui/components/AuthContextViewer.tsx` (58)

| Line | Kind | Text |
|---|---|---|
| 52 | text | Auth Context (useAuth Hook) |
| 53 | text | Live data from the application&apos;s auth context provider |
| 61 | text | Reload Page |
| 72 | text | Loading Auth Context |
| 73 | text | Auth context is initializing... |
| 82 | text | Authentication Status |
| 87 | text | Is Authenticated |
| 91 | text | Yes |
| 96 | text | No |
| 103 | text | Is Loading |
| 107 | text | Loading... |
| 112 | text | Ready |
| 124 | text | User State |
| 131 | text | Email |
| 135 | text | Phone |
| 139 | text | User ID |
| 143 | text | Created At |
| 149 | text | Last Sign In |
| 156 | text | Show Full User Object |
| 167 | text | No user logged in |
| 175 | text | Session State |
| 182 | text | Access Token |
| 188 | text | Refresh Token |
| 194 | text | Expires At |
| 200 | text | Time Remaining |
| 204 | text | Expires In (seconds) |
| 209 | text | Show Full Session Object |
| 220 | text | No active session |
| 228 | text | Current Tenant State |
| 235 | text | Tenant Name |
| 239 | text | Tenant Slug |
| 243 | text | User Role |
| 251 | text | Is Active |
| 255 | text | Active |
| 260 | text | Inactive |
| 267 | text | Tenant ID |
| 271 | text | Last Login At |
| 278 | text | Show Full Tenant Object |
| 289 | text | No tenant context set |
| 297 | text | Available Tenants ( |
| 312 | text | Current |
| 323 | text | Slug: |
| 330 | text | Last: |
| 342 | text | No tenants available |
| 351 | text | Available Methods |
| 385 | text | Usage in Components |
| 390 | text | Import and use the hook: |
| 425 | text | Auth Context Provider Info |
| 427 | text | Location: |
| 427 | text | lib/auth/auth-context.tsx |
| 428 | text | Manages authentication state and operations across the application |
| 428 | text | Purpose: |
| 429 | text | Features: |
| 429 | text | Multi-tenant support, tenant switching, auto token refresh |
| 430 | text | Account locking, login attempt tracking, session management |
| 430 | text | Security: |
| 431 | text | Events: |
| 431 | text | Listens to Supabase auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) |

### `app/dashboard/jhtestui/components/JwtViewerJhTest.tsx` (31)

| Line | Kind | Text |
|---|---|---|
| 60 | setError | No active session found. Please log in. |
| 67 | setError | Failed to decode JWT token |
| 131 | text | Error Loading Token |
| 145 | text | No Token Available |
| 146 | text | Please log in to view JWT token. |
| 161 | text | JWT Token Viewer |
| 162 | text | Decode and inspect your Supabase authentication token |
| 168 | text | Refresh |
| 176 | text | Token Overview |
| 181 | text | Issuer |
| 185 | text | Subject (User ID) |
| 189 | text | Issued At |
| 193 | text | Expires At |
| 200 | text | Time Remaining |
| 211 | text | User Claims |
| 216 | text | Email |
| 220 | text | Role |
| 228 | text | Email Confirmed |
| 232 | text | Yes |
| 236 | text | No |
| 241 | text | Phone |
| 250 | text | Tenant Context |
| 255 | text | Tenant Org ID |
| 262 | text | App Metadata |
| 270 | text | User Metadata |
| 281 | text | Full Token Payload |
| 284 | text | Header |
| 290 | text | Payload |
| 296 | text | Signature |
| 307 | text | Raw Token |
| 329 | text | Click &quot;Show&quot; to reveal the full raw token |

### `app/dashboard/jhtestui/components/UserContextViewer.tsx` (30)

| Line | Kind | Text |
|---|---|---|
| 91 | text | Error Loading User Context |
| 105 | text | No Context Available |
| 106 | text | User context could not be loaded. |
| 120 | text | User & Tenant Context |
| 121 | text | Current authenticated user and tenant information |
| 127 | text | Refresh |
| 135 | text | User Information |
| 141 | text | Email |
| 148 | text | Phone |
| 154 | text | User ID |
| 159 | text | Email Confirmed |
| 165 | text | Yes ( |
| 170 | text | No |
| 178 | text | Created At |
| 187 | text | Last Sign In |
| 199 | text | User Metadata |
| 209 | text | App Metadata |
| 221 | text | Current Tenant |
| 226 | text | Tenant Name |
| 231 | text | User Role |
| 241 | text | Tenant ID |
| 252 | text | All Accessible Tenants ( |
| 266 | text | Current |
| 287 | text | Session Information |
| 292 | text | Access Token Type |
| 296 | text | Expires At |
| 302 | text | Refresh Token |
| 311 | text | Show Full Session Object |
| 323 | text | Usage in API Routes |
| 326 | text | Standard Pattern: |

### `app/dashboard/jhtestui/page.tsx` (6)

| Line | Kind | Text |
|---|---|---|
| 71 | text | Test & Debug Dashboard |
| 72 | text | Development tools for testing and debugging various components |
| 80 | text | Select Test Module |
| 121 | text | Test 4 Component |
| 122 | text | This test module is not yet implemented. |
| 123 | text | Add your test component here. |
