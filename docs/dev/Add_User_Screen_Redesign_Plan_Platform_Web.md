# Add New User Screen Redesign Plan — platform-web

**Target:** Make the Add New User screen in `cleanmatexsaas/platform-web/` match the reference design at `http://localhost:3001/tenants/{id}/users/new`.

**Reference:** CM HQ Console Add New User screen (image) with three-section, two-column layout.

---

## 1. Current State

**Location:** `platform-web/src/features/tenants/ui/create-user-screen.tsx`

**Current structure:**
- Uses `MainLayout` + `TenantManagementLayout`
- Form sections:
  - **Account Information:** email, password, confirm password
  - **Personal Information:** display name, first name, last name, Full Name (EN), Full Name (AR), User Type
  - **Address Information:** address, area, building, floor, main branch
  - **Role & Access:** User Role dropdown, Account is active, Is User Account
- Two-column grid (2/3 left, 1/3 right)
- Actions: Create User + Cancel in a Card on the right
- Uses react-hook-form, zod, Card, Input, CmxSelect, CmxCheckbox

---

## 2. Target Design (Reference)

### 2.1 Page Header

- **Back arrow** (←) on the left, linking to `/tenants/[id]/users`
- **Title:** "Add New User"
- **Subtitle:** "Create a new user account for this tenant"

### 2.2 Layout

- **Two-column layout:** Left column (~2/3), Right column (~1/3)
- **Left column:** Two stacked cards — Account Information, Personal Information
- **Right column:** Role & Access card; Action buttons below

### 2.3 Section 1 — Account Information (left, top)

| Field            | Type        | Required | Helper Text                    |
|------------------|-------------|----------|--------------------------------|
| Email Address    | text/email   | Yes *    | User will use this email to log in. |
| Password         | password     | Yes *    | Must be at least 8 characters. |
| Confirm Password | password     | Yes *    | (with eye toggle)              |

### 2.4 Section 2 — Personal Information (left, bottom)

| Field            | Type  | Required | Helper Text                                      |
|------------------|-------|----------|--------------------------------------------------|
| Display Name     | text  | Yes *    | This name will be displayed throughout the system. |
| First Name       | text  | No       | —                                                |
| Last Name        | text  | No       | —                                                |
| Phone Number     | text  | No       | —                                                |
| Full Name (English) | text | No     | —                                                |

### 2.5 Section 3 — Role & Access (right, top)

| Field           | Type    | Required | Helper Text                                   |
|-----------------|---------|----------|-----------------------------------------------|
| User Role       | dropdown| Yes *    | Placeholder: "Select a role..."               |
| Account is active | checkbox | —     | Inactive users cannot log in to the system.   |
| Is User Account | checkbox | —      | Whether this is a user account (default: true).|

### 2.6 Action Buttons (right, bottom)

- **Create User** — Primary button with user icon (top)
- **Cancel** — Secondary button (below)

---

## 3. Differences vs. Current Implementation

| Aspect                    | Current                              | Target                                      |
|---------------------------|--------------------------------------|---------------------------------------------|
| Page header               | Layout breadcrumb/nav only           | Back arrow + "Add New User" + subtitle      |
| Personal Information      | Display, First, Last, Name, Name2, User Type | Display, First, Last, Phone, Full Name (EN) |
| Address Information       | Full section (address, area, building, floor, main branch) | **Remove** or move to optional expandable section |
| User Type                 | In Personal section                  | **Remove** from Add User form               |
| Full Name (Arabic)        | In Personal section                  | **Remove** (or hide initially)              |
| Main Branch               | In Address section                   | **Remove** or add to Role & Access           |
| Action buttons            | In Card, stacked                     | Same; ensure Create User has user icon      |
| Helper text               | Some present                         | Align with reference texts                  |
| Required asterisk         | On role                              | On email, password, confirm, display name, role |

---

## 4. Implementation Plan

### Phase 1: Page header and layout

1. **Update page header**
   - Add explicit back link with arrow icon
   - Set title: "Add New User"
   - Set subtitle: "Create a new user account for this tenant"

2. **Layout**
   - Keep two-column grid (left 2/3, right 1/3)
   - Ensure TenantManagementLayout exposes tenant context and breadcrumbs

### Phase 2: Account Information

1. **Fields**
   - Email Address, Password, Confirm Password
   - All required, with red asterisk

2. **Helper text**
   - Email: "User will use this email to log in."
   - Password: "Must be at least 8 characters."

3. **Password visibility**
   - Keep eye toggle for password and confirm password

### Phase 3: Personal Information

1. **Fields**
   - Display Name * (required)
   - First Name
   - Last Name
   - Phone Number
   - Full Name (English)

2. **Helper text**
   - Display Name: "This name will be displayed throughout the system."

3. **Removals**
   - Full Name (Arabic) — remove or move to optional expandable
   - User Type — remove from Add User

### Phase 4: Role & Access

1. **Fields**
   - User Role dropdown (required) with placeholder "Select a role..."
   - Account is active checkbox
   - Is User Account checkbox

2. **Helper text**
   - Account is active: "Inactive users cannot log in to the system."
   - Is User Account: "Whether this is a user account (default: true)."

### Phase 5: Address and extra fields

1. **Address Information**
   - **Option A:** Remove from Add User flow
   - **Option B:** Move to collapsible "Additional Information" section

2. **Main Branch**
   - **Option A:** Remove from Add User
   - **Option B:** Add under Role & Access as optional field

3. **CreateUserDto mapping**
   - Ensure API still receives needed fields (e.g. `first_name`, `last_name`, `name`, `phone`)
   - Keep optional fields only when they add value

### Phase 6: Actions and styling

1. **Action buttons**
   - Create User: primary button with user icon (e.g. UserPlus)
   - Cancel: secondary/outline below Create User

2. **Styling**
   - Card borders, padding, spacing to match reference
   - Required field asterisks in red
   - Consistent helper text styling

---

## 5. File Changes

| File | Changes |
|------|---------|
| `platform-web/src/features/tenants/ui/create-user-screen.tsx` | Main changes: header, layout, sections, fields, actions |
| `platform-web/messages/en.json` (or i18n equivalent) | Add/update keys for title, subtitle, helper texts |
| `platform-web/messages/ar.json` | Arabic translations |

---

## 6. API and validation

- Keep `CreateUserDto` and `tenantUsersApi.create` contract
- Ensure zod schema still validates required fields
- Optional fields: `first_name`, `last_name`, `name`, `phone`; omit address fields if removed

---

## 7. Optional enhancements

- Localization (EN/AR) for all new strings
- Loading states for role/branch dropdowns
- Role description preview when a role is selected (keep existing behavior)
- Responsive layout: stack columns on small screens

---

## 8. Acceptance criteria

- [ ] Back arrow navigates to `/tenants/[id]/users`
- [ ] Header shows "Add New User" and "Create a new user account for this tenant"
- [ ] Account Information: Email, Password, Confirm Password with correct helper text
- [ ] Personal Information: Display Name, First Name, Last Name, Phone, Full Name (EN) with helper text
- [ ] Role & Access: User Role dropdown (required), Account is active, Is User Account
- [ ] Create User and Cancel buttons styled and positioned as in reference
- [ ] Form submits and creates user via API
- [ ] Address / User Type / Main Branch handled per chosen options
