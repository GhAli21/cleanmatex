# Staff App Specification for CleanMateX

This is the right place to start.

The **Staff App** is the operational spine of the business. If this app is weak, the whole system collapses even if the customer app looks polished. Your workflow documents already point in this direction: role-based operational handling, quick intake, preparation, processing, issue handling, and ready/handover flows are core requirements.  

---

# 1) Staff App purpose

## Main objective

Enable branch staff to run daily laundry operations fast, accurately, and with full auditability.

## What it must achieve

* create and manage orders quickly
* support guest and stub customers
* move orders through workflow stages
* reduce paper dependency
* support barcode/QR-driven operations
* handle exceptions without chaos
* keep order state always accurate for customer tracking and reporting

This aligns with the project vision of replacing manual laundry operations with digital workflows and supporting staff roles in order operations and inventory-related processes. 

---

# 2) Target users

The Staff App is not for everyone. It is for branch-side operational roles.

## Primary users

* Reception / Counter Staff
* Preparation Staff
* Processing Staff
* Ready / Handover Staff
* Branch Supervisor
* Admin fallback user

## Secondary users later

* QA staff
* Packing staff
* Assembly staff

Your workflow plan explicitly defines roles like reception, preparation, processing, QA, delivery, and admin, and maps them to screens. 

---

# 3) Staff App guiding principles

## Operational principles

* mobile-first
* fast interaction
* minimal typing
* scan-first where possible
* role-aware
* branch-aware
* bilingual EN/AR
* tablet-friendly
* auditable actions
* offline-tolerant later

## UX principles

* big touch targets
* short forms
* few taps for repetitive tasks
* strong status visibility
* clear alerts and exceptions
* avoid cluttered ERP-style screens

If you build this like a desktop ERP squeezed into Flutter, it will fail on the shop floor.

---

# 4) Staff App MVP scope

For the first real release, the Staff App should cover these operational areas:

## Included in MVP

* staff login
* branch selection
* task dashboard
* customer lookup
* stub customer creation
* guest order intake
* quick order creation
* preparation queue
* preparation itemization
* processing queue
* stage update / scan update
* ready orders list
* handover / collected flow
* issue creation and issue list
* alerts / urgent queue

## Explicitly out of MVP

* advanced assembly module
* full QA module
* deep packing workflows
* complex per-piece lifecycle everywhere
* delivery management
* payroll and attendance
* machine maintenance
* advanced analytics inside app

Those broader features exist in the backlog, but they are not the first operational slice.

---

# 5) Staff App main modules

## A. Authentication & Session

Purpose: secure access to the operational environment.

### Features

* staff login
* session restore
* logout
* branch selection
* role-aware landing page
* optional device binding later

### Key rules

* only authorized staff can enter
* user must operate inside allowed branch context
* role controls screen access

This matches the project’s authentication and RBAC requirements. 

---

## B. Tasks Dashboard

Purpose: show the staff member what needs action now.

### Features

* my tasks
* orders needing preparation
* orders in processing
* ready orders awaiting handover
* urgent orders
* problematic orders
* quick counts by status

### Why it matters

The app should open into action, not into menus.

---

## C. Reception / Counter Module

Purpose: handle fast intake and customer selection.

### Features

* lookup customer by phone
* create stub customer
* create guest order
* create new order
* choose service category
* mark express/priority
* capture notes/stains/damage
* quick-drop support
* estimate ready-by preview later

This is directly supported by your workflow and new order plan, including customer picker, quick drop toggle, express, notes, and submit flow. 

---

## D. Preparation Module

Purpose: convert quick drop or incomplete intake into detailed order items.

### Features

* preparation queue
* view preparing order
* add item lines
* assign services
* assign quantities
* add stain/damage notes
* recalculate ready-by when needed
* submit to processing

This aligns with the documented preparation flow where quick-drop orders go to preparing and are later itemized and transitioned to processing. 

---

## E. Processing Module

Purpose: move work through active operational stages.

### Features

* processing queue
* order-level update
* item-level update
* scan order/item
* update status/stage
* basic split handling later
* mark done
* move toward ready

Your workflow notes explicitly call out processing lists, per-item handling, scan update, and transition logic. 

---

## F. Ready / Handover Module

Purpose: finalize customer collection at branch.

### Features

* ready orders list
* view payment status
* verify order before handover
* mark collected
* send back for issue if needed
* show receipt/summary reference

The ready screen and actions are part of your defined operational workflow. 

---

## G. Issues / Exceptions Module

Purpose: stop operational problems from becoming hidden chaos.

### Features

* create issue
* select issue type/code
* attach note
* attach photo later
* link to order / item
* mark as solved / reprocess later
* issue list and issue details

The design already defines order item issues and issue-to-solve behavior as first-class features.  

---

## H. Search / Scan Utility

Purpose: fast lookup from anywhere.

### Features

* scan barcode / QR
* search by order number
* search by customer phone
* search by tag/barcode
* jump directly to correct screen

Barcode and scan-driven tracking are core system features in the requirements. 

---

# 6) Staff App navigation structure

For MVP, keep navigation brutally simple.

## Recommended bottom navigation

* Tasks
* Reception
* Processing
* Ready
* More

## More section

* Issues
* Search/Scan
* Profile/Session
* Settings light
* Help

## Role-based visibility

Not every role sees every tab.

### Example

* Reception role: Tasks, Reception, Ready, More
* Preparation role: Tasks, Reception, Processing, More
* Processing role: Tasks, Processing, Ready, More
* Admin role: all

This is the only sane way to avoid clutter.

---

# 7) Staff App MVP screen list

## Launch / Auth

* Splash Screen
* Login Screen
* Branch Selection Screen
* Role Landing Loader

## Tasks

* Tasks Dashboard Screen
* Urgent Orders Screen
* Alerts Screen

## Reception

* Customer Lookup Screen
* Customer Search Result Screen
* New Stub Customer Screen
* Guest Order Intake Screen
* New Order Intake Screen
* Intake Summary Screen

## Preparation

* Preparation Queue Screen
* Preparation Detail Screen
* Itemization Screen
* Notes / Damage / Stain Screen

## Processing

* Processing Queue Screen
* Processing Detail Screen
* Scan / Update Status Screen

## Ready / Handover

* Ready Orders Screen
* Ready Order Detail Screen
* Handover / Collection Screen

## Issues

* Issues List Screen
* Create Issue Screen
* Issue Detail Screen

## Utilities

* Search / Scan Screen
* Profile / Session Screen

---

# 8) Screen-by-screen purpose

## 8.1 Login Screen

### Purpose

Authenticate staff member.

### Fields

* phone / email / username based on backend design
* password or OTP
* login button

### Actions

* login
* forgot password later

---

## 8.2 Branch Selection Screen

### Purpose

Set operational branch context.

### Fields

* branch list
* confirm selection

### Rules

* shown only if user has access to multiple branches

---

## 8.3 Tasks Dashboard

### Purpose

Immediate action center.

### Widgets

* count cards by queue
* urgent orders section
* delayed orders section
* quick action shortcuts

### Actions

* go to preparation queue
* go to processing queue
* go to ready queue

---

## 8.4 Customer Lookup Screen

### Purpose

Find or create customer before intake.

### Fields

* phone number
* name optional search later

### Results

* existing customer
* stub customer
* no result → create stub or guest

This supports the progressive engagement model where staff can create stub profiles with minimal info. 

---

## 8.5 New Stub Customer Screen

### Purpose

Create minimal customer record quickly.

### Fields

* first name
* phone
* optional notes

### Output

* stub profile linked to tenant

This is consistent with the customer details spec. 

---

## 8.6 Guest Order Intake Screen

### Purpose

Allow no-profile/no-phone order intake.

### Fields

* service category
* quick notes
* quantity estimate if quick drop
* express toggle

### Output

* guest order with temporary reference

Guest customer flow is explicitly supported in your customer model. 

---

## 8.7 New Order Intake Screen

### Purpose

Create order quickly from reception.

### Fields

* customer
* service category
* item presets or quick lines
* quick-drop toggle
* express toggle
* notes
* submit

### Output

* order created
* either goes to preparing or processing depending on quick-drop completeness

This comes directly from your new order logic. 

---

## 8.8 Preparation Queue Screen

### Purpose

Show orders awaiting itemization.

### Data

* order number
* customer
* age
* priority
* quick-drop indicator

### Action

* open preparation detail

---

## 8.9 Preparation Detail Screen

### Purpose

Complete order itemization.

### Fields

* item lines
* service assignment
* quantity
* notes
* stain/damage flags
* recalculate ready-by later

### Action

* submit to processing

---

## 8.10 Processing Queue Screen

### Purpose

Show active operational workload.

### Data

* order number
* customer
* current stage
* priority
* aging

### Actions

* open details
* scan and update
* mark progressed

---

## 8.11 Scan / Update Status Screen

### Purpose

Fast transition by scan or manual entry.

### Fields

* scanned code / order id
* current stage
* next action

### Actions

* confirm transition
* add note if exception

---

## 8.12 Ready Orders Screen

### Purpose

Show orders ready for release.

### Data

* order number
* customer
* payment state
* ready time

### Actions

* open ready detail
* mark collected
* flag issue

---

## 8.13 Handover / Collection Screen

### Purpose

Complete customer collection at branch.

### Fields

* order summary
* outstanding payment indicator
* confirmation button

### Action

* mark collected

---

## 8.14 Issues List Screen

### Purpose

Track visible operational problems.

### Data

* issue code/type
* order reference
* created by
* status
* age

### Actions

* open detail
* create new issue

---

## 8.15 Create Issue Screen

### Purpose

Document a problem in real time.

### Fields

* issue type
* related order/item
* note
* photo later
* priority

### Action

* save issue

---

# 9) Role-to-screen matrix

## Reception

* Tasks
* Customer Lookup
* Stub Customer
* Guest Intake
* New Order Intake
* Ready Orders
* Handover

## Preparation

* Tasks
* Preparation Queue
* Preparation Detail
* Search/Scan

## Processing

* Tasks
* Processing Queue
* Scan/Update
* Issues

## Supervisor / Admin

* All operational screens
* branch-wide visibility

This is consistent with your documented role mapping. 

---

# 10) Key user flows

## Flow 1: Existing customer intake

1. login
2. select branch
3. lookup customer by phone
4. select existing customer
5. create order
6. submit
7. order goes to processing or preparation

## Flow 2: Stub customer quick drop

1. lookup phone
2. not found
3. create stub customer
4. create quick-drop order
5. submit
6. order enters preparing queue
7. preparation staff itemizes later

This directly matches your progressive engagement and quick-drop logic.  

## Flow 3: Preparation to processing

1. open preparation queue
2. select order
3. add items/services/notes
4. submit
5. order transitions to processing

## Flow 4: Processing to ready

1. open processing queue
2. update or scan order/items
3. mark processing completion
4. order moves to ready

## Flow 5: Ready to collected

1. open ready queue
2. verify order
3. confirm payment status
4. hand over order
5. mark collected

## Flow 6: Issue capture

1. open create issue
2. select order/item
3. add issue note
4. save
5. issue becomes visible in issue list

---

# 11) Backend/API needs for Staff App

At MVP level, the Staff App needs these API groups:

## Auth

* login
* logout
* get current session/user
* get allowed branches/roles

## Customers

* search customer by phone
* create stub customer
* get customer summary

## Orders

* create order
* get order by id
* list preparation queue
* list processing queue
* list ready queue
* update order status/stage
* get order detail
* mark collected

## Preparation

* save itemization
* assign services/items
* move from preparing to processing

## Issues

* create issue
* list issues
* get issue detail

## Search / Scan

* resolve barcode to order/item
* search by order number

Your workflow implementation plan already defines several of these patterns and transition expectations. 

---

# 12) Data objects Staff App must understand

These should be shared models, not app-specific inventions.

## Core entities

* StaffUser
* Branch
* CustomerSummary
* OrderSummary
* OrderDetail
* OrderItem
* WorkflowStage
* ReadyQueueItem
* IssueSummary
* IssueDetail
* ScanResult

## Important fields

* tenant_org_id
* branch_id
* customer_type
* current_status
* current_stage
* ready_by_at
* priority
* payment_status
* issue flags

These concepts are repeatedly present in your requirements and workflow docs.  

---

# 13) Non-functional requirements for Staff App

## Performance

* dashboard and queues should load fast
* scan/update action should feel near-instant
* repetitive actions must be low-latency

The broader platform performance targets are p50 under 300ms and p95 under 800ms for APIs. 

## Localization

* full EN/AR
* RTL-safe layouts
* easy switching if required

## Security

* authenticated staff only
* branch-aware access
* role-aware action control
* audit trail for status changes and issues

## Reliability

* clear failure messaging
* safe retry behavior
* offline tolerance later

---

# 14) Recommended Flutter feature structure for Staff App

```text
lib/
  core/
    app/
    config/
    constants/
    errors/
    routing/
    theme/
    widgets/
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
```

## Suggested layer inside each feature

```text
feature/
  data/
    models/
    repositories/
    services/
  domain/
    entities/
    usecases/
  presentation/
    screens/
    widgets/
    controllers/
```

This keeps the app scalable without turning into spaghetti.

---

# 15) Final MVP definition for Staff App

If you force me to define the **true MVP**, it is this:

## Must-have

* login
* branch selection
* customer lookup
* stub customer creation
* guest intake
* order intake
* preparation queue/detail
* processing queue/detail
* ready queue
* handover collected action
* issue creation/list
* search/scan

## Nice-to-have but not MVP

* photos in issues
* split order
* full assembly
* QA module
* offline queue
* analytics widgets
* advanced packing

That is the clean cut.

---

# 16) Hard recommendation

Build the Staff App in this order:

## Build order

1. auth + branch selection
2. customer lookup + stub creation
3. new order intake
4. preparation queue/detail
5. processing queue/update
6. ready queue + collected action
7. issue module
8. scan/search utility

That sequence gives you a usable operational loop very fast.

