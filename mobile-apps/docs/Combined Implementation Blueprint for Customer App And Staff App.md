# Combined Implementation Blueprint for Customer App + Staff App

This is the right next step.

You now have the product definitions. The next move is to turn them into a **buildable engineering blueprint** that is realistic for one developer and does not create architectural debt on day one.

The key rule is simple:

> Build **two apps**, but treat them as **one mobile platform** with shared domain contracts, shared UI foundations, and shared technical patterns.

If you do not do this, you will duplicate logic, models, validation, enums, and design rules everywhere, and the project will rot fast.

---

# 1) Overall implementation strategy

## What you are building now

* **Customer App** in Flutter
* **Staff App** in Flutter

## What they should share

* domain models
* API client
* auth/session logic
* localization contract
* design tokens
* common widgets
* error handling
* app configuration
* feature flag reader
* permissions/session context basics

## What should remain separate

* app navigation
* app-specific screens
* app-specific workflows
* app-specific presentation widgets
* app-specific local state/controllers

---

# 2) Recommended repository structure

For a solo developer, this is the cleanest practical structure:

```text
cleanmatex-mobile/
  apps/
    customer_app/
    staff_app/
  packages/
    shared_core/
    shared_models/
    shared_api/
    shared_design/
    shared_l10n/
    shared_utils/
  docs/
    mobile_architecture/
```

This is better than two fully independent repos.

Why:

* easier reuse
* easier synchronized changes
* easier version control
* easier shared testing
* easier Cursor/Codex/Claude understanding

---

# 3) Purpose of each shared package

## A. `shared_core`

This is the platform backbone.

### Should contain

* app environment config
* API base URL config
* app constants
* secure storage helpers
* session manager
* token refresh helpers
* app startup/bootstrap helpers
* feature flag access contract
* app error model
* logging helpers
* connectivity status helpers

### Do not put here

* screen widgets
* business-specific UI
* order-specific presentation code

---

## B. `shared_models`

This package holds all core DTOs/entities shared by both apps.

### Must contain

* customer models
* address models
* order summary/detail models
* order item models
* workflow status/stage models
* receipt models
* service category models
* issue models
* branch models
* staff session/role context models
* API pagination wrapper models
* response wrapper models

### Key principle

This package is your **single source of truth** for mobile-side data shapes.

Do not let `customer_app` define its own `OrderSummaryModel` while `staff_app` defines another version. That is how bugs multiply.

---

## C. `shared_api`

This is where all API access patterns live.

### Should contain

* Dio client
* interceptors
* auth header injection
* token refresh flow
* endpoint constants
* base repositories/services
* standardized request/response handling
* API exception mapping
* upload helpers later

### Important

This package should expose reusable API services, but app-specific orchestration can still happen inside each app’s feature repository layer.

---

## D. `shared_design`

This is your cross-app design system.

### Should contain

* colors
* typography
* spacing
* border radius
* elevation/shadow standards
* reusable widgets
* input components
* buttons
* cards
* loaders
* empty states
* error states
* list item shells
* status badges
* language-aware design utilities

### Critical point

Customer App and Staff App should feel like they belong to the same brand family, but not necessarily identical in behavior.

* Customer App: softer, cleaner, reassurance-heavy
* Staff App: denser, faster, operational, scan-friendly

That means shared design tokens, not forced identical screens.

---

## E. `shared_l10n`

This package defines localization structure and key contracts.

### Should contain

* localization key naming rules
* shared string groups
* common validation messages
* common button labels
* common order status translations
* common error messages
* EN/AR resources or contracts

### Important

Because EN/AR is mandatory, localization must not be bolted on later. It must be structural from day one. Your technical stack and requirements make that non-negotiable.  

---

## F. `shared_utils`

This is for technical helpers that are not domain-owned.

### Should contain

* validators
* date formatting helpers
* currency formatters
* phone formatters
* debounce helpers
* barcode parsing helpers later
* string helpers
* map/list extension methods

---

# 4) App-level structure

Now the app layer.

---

# 5) Customer App structure

```text
apps/customer_app/lib/
  app/
    bootstrap/
    router/
    app.dart
  core/
    config/
    session/
    guards/
  features/
    auth/
    home/
    booking/
    orders/
    receipts/
    profile/
    support/
    notifications/
  main.dart
```

## Customer App feature breakdown

### `auth`

* login screen
* OTP verify screen
* auth repository
* session bootstrap logic

### `home`

* home dashboard
* active order preview cards
* shortcuts

### `booking`

* service selection
* address selection
* scheduling
* notes/preferences
* review
* confirmation

### `orders`

* active orders
* history
* order detail
* tracking timeline

### `receipts`

* receipt list
* receipt detail
* invoice viewer

### `profile`

* profile
* edit profile
* addresses
* preferences
* language settings
* notification settings

### `support`

* help center
* FAQ
* report issue
* contact support

### `notifications`

* notifications list
* route-on-open behavior
* push handling entry points

---

# 6) Staff App structure

```text
apps/staff_app/lib/
  app/
    bootstrap/
    router/
    app.dart
  core/
    config/
    session/
    guards/
  features/
    auth/
    tasks/
    reception/
    preparation/
    processing/
    ready_handover/
    issues/
    search_scan/
    profile/
  main.dart
```

## Staff App feature breakdown

### `auth`

* login
* branch selection
* role-aware landing

### `tasks`

* dashboard
* urgent orders
* alerts

### `reception`

* customer lookup
* new stub customer
* guest intake
* new order intake

### `preparation`

* preparation queue
* itemization
* notes/stain/damage
* submit to processing

### `processing`

* processing queue
* processing detail
* scan/update status

### `ready_handover`

* ready queue
* ready details
* collected/handover action

### `issues`

* issue list
* create issue
* issue detail

### `search_scan`

* scan/search utility
* barcode entry
* fast lookup redirect

### `profile`

* staff profile/session
* logout
* branch/session info

---

# 7) Feature internal structure

Inside each feature, keep the same pattern.

```text
feature_name/
  data/
    datasources/
    models/
    repositories/
  domain/
    entities/
    usecases/
  presentation/
    controllers/
    screens/
    widgets/
```

This structure is clean enough to scale, but not so overengineered that it slows you down.

## Practical rule

If a feature is still tiny, you can collapse some layers temporarily. But keep the folders ready so you do not end up with chaos.

---

# 8) Shared domain model list

These should be defined early.

## Identity / session

* `AppSession`
* `AuthenticatedUser`
* `StaffSessionContext`
* `CustomerSessionContext`
* `BranchSummary`
* `UserRole`

## Customer domain

* `CustomerProfile`
* `CustomerAddress`
* `CustomerPreferences`

## Order domain

* `OrderSummary`
* `OrderDetail`
* `OrderItem`
* `OrderTimelineEvent`
* `OrderStatus`
* `OrderStage`
* `OrderPriority`

## Booking domain

* `ServiceCategory`
* `ServiceOption`
* `BookingRequest`
* `BookingScheduleSlot`
* `BookingReviewSummary`

## Receipt / finance domain

* `ReceiptSummary`
* `ReceiptDetail`
* `PaymentSummary`
* `InvoiceDocument`

## Issues domain

* `IssueSummary`
* `IssueDetail`
* `IssueType`

## Staff operations domain

* `PreparationQueueItem`
* `ProcessingQueueItem`
* `ReadyQueueItem`
* `ScanResolveResult`

## System domain

* `FeatureFlagsSnapshot`
* `AppLanguage`
* `ApiError`
* `PagedResult<T>`

---

# 9) Shared enum strategy

You need strict enum governance.

## Define centrally

* order status
* order stage
* customer type
* user role
* issue type
* payment status
* language code
* notification type

## Why this matters

If one app uses `readyForPickup` and another uses `ready_for_pickup`, you will waste days on garbage bugs.

---

# 10) API architecture strategy

## Recommended pattern

Use one base Dio client in `shared_api`, then app/domain-specific repositories in each feature.

### Example split

### In `shared_api`

* `ApiClient`
* `AuthApiService`
* `OrdersApiService`
* `CustomersApiService`
* `ReceiptsApiService`
* `IssuesApiService`
* `ProfileApiService`

### In app features

* `CustomerOrdersRepository`
* `StaffProcessingRepository`
* `StaffReceptionRepository`

This keeps low-level HTTP reusable, while preserving app-specific workflow orchestration.

---

# 11) Auth/session design across both apps

This is critical.

## Customer App session

Must support:

* phone + OTP login
* persistent session restore
* profile fetch after login
* customer-scoped routing

## Staff App session

Must support:

* staff auth
* branch selection
* role context
* permission-aware navigation

## Shared auth rules

* tokens stored securely
* refresh token flow centralized
* unauthorized handling standardized
* logout should clear everything cleanly

---

# 12) Navigation strategy

## Customer App

Use simple user-facing navigation.
Recommended:

* Home
* Orders
* Book
* Receipts
* Profile

## Staff App

Use action-driven navigation.
Recommended:

* Tasks
* Reception
* Processing
* Ready
* More

### Important

Do not over-generalize the navigation shell between both apps.
Shared routing helpers are fine.
Shared navigation UI is not necessary.

---

# 13) State management recommendation

For your case, use **Riverpod**.

## Why Riverpod fits here

* good for modular apps
* works well with Flutter
* testable
* scalable
* easier dependency injection style
* suitable for both small and large features

## Suggested approach

* feature-level providers
* repository providers
* session/global providers
* async state with clear loading/error/data handling

Avoid mixing too many patterns.

---

# 14) UI system strategy

## Shared UI layer should provide

* app scaffold base
* buttons
* text fields
* dropdown/select
* cards
* tiles
* badges
* loaders
* section headers
* dialog wrappers
* empty state widget
* error state widget
* localized status chips

## Then each app specializes

### Customer App

* softer spacing
* more visual reassurance
* promotional banner areas
* timeline emphasis

### Staff App

* denser layouts
* faster action buttons
* more list efficiency
* scan-first affordances
* large operational chips/status blocks

---

# 15) Localization blueprint

Since Arabic and English are mandatory, enforce these rules now.

## Rules

* all user-facing strings externalized
* no hardcoded strings in widgets
* common keys in shared package
* app-specific keys in app package
* order statuses translated centrally
* date, number, currency formatting localized

## Suggested split

* `shared_l10n/en.json`
* `shared_l10n/ar.json`
* app-specific extension files if needed

---

# 16) Development order across both apps

This is where you win or lose the timeline.

## Phase 0: shared foundations first

Build first:

* shared_core
* shared_models
* shared_api base
* shared_design basics
* shared_l10n basics

Do not skip this.

---

## Phase 1: Staff App first slice

Because operational backbone comes first.

Build in this order:

1. auth
2. branch selection
3. tasks dashboard
4. customer lookup
5. stub customer creation
6. new order intake
7. preparation queue/detail
8. processing queue/update
9. ready queue/handover
10. issue list/create

This aligns with your workflow priorities. 

---

## Phase 2: Customer App visibility slice

Build in this order:

1. auth
2. language selection
3. home
4. active orders
5. order details/tracking
6. receipts
7. profile
8. addresses/preferences

This gives value quickly even before full booking.

---

## Phase 3: Customer booking slice

Build next:

1. service categories
2. service details
3. address selection
4. scheduling
5. notes/preferences
6. review
7. confirmation

---

## Phase 4: hardening

* error handling
* retries
* empty states
* localization completion
* auth/session hardening
* analytics hooks
* notification routing basics

---

# 17) MVP release slicing

## Internal operational MVP

Release when these are done:

* Staff auth
* branch select
* customer lookup
* stub creation
* order intake
* preparation
* processing
* ready handover
* issue logging

## Customer visibility MVP

Release when these are done:

* customer auth
* active order tracking
* receipt access
* profile and address basics

## Customer booking MVP

Release when booking is added after ops are stable.

That is a sane rollout model.

---

# 18) What not to do

## Do not

* build both apps fully in parallel from day one
* invent separate models in each app
* hardcode order status strings everywhere
* postpone localization architecture
* overbuild design system before real screens exist
* add wallet/loyalty/marketplace now
* build admin web at the same time

This is where solo projects die.

---

# 19) Recommended testing approach

## Shared packages

* unit tests for models
* unit tests for formatters/validators
* API parsing tests

## Staff App

* widget tests for key screens
* flow tests for:

  * customer lookup
  * stub creation
  * intake
  * processing update
  * handover

## Customer App

* widget tests for:

  * login
  * active orders
  * tracking timeline
  * booking flow

Do not wait until the end to test.

---

# 20) Definition of done for this stage

You are ready to start implementation when you have:

## Shared foundation

* repo structure approved
* package names approved
* shared model list approved
* API service grouping approved
* state management choice approved

## Staff App

* feature list approved
* screen list approved
* user flow order approved

## Customer App

* feature list approved
* screen list approved
* user flow order approved

At that point, coding can start without strategic confusion.

---

# 21) Hard recommendation

Your immediate implementation sequence should be:

### Step 1

Create monorepo structure for:

* `apps/customer_app`
* `apps/staff_app`
* shared packages

### Step 2

Implement shared packages skeleton

### Step 3

Implement Staff App first vertical slice:

* auth → lookup → intake → preparation → processing → ready

### Step 4

Implement Customer App visibility slice:

* auth → home → active orders → tracking → receipts → profile

### Step 5

Implement Customer booking flow

That is the highest-leverage path.

Next, I should generate the **actual folder tree and starter architecture skeleton for the two Flutter apps and shared packages**.
