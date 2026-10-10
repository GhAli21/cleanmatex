# Laundry roles, jobs, and production access plan

**Status:** Guide for future role work. Not an implementation.
**Source of truth checked:** remote database on 9 Oct 2026 (`sys_auth_roles`, `sys_auth_role_default_permissions`, `sys_components_cd`).
**Menu rule already in production:** a sidebar row is visible when `main_permission_code` is null or the user holds that code. Feature flags still apply. Role lists on menu rows are not a gate.

Use this file when deciding which person gets which access, and when fixing the gaps listed at the end. Do not treat the older three-role write-up in `docs/features/RBAC/user_roles_guide.md` as current. The live catalog has 19 roles.

---

## 1. How access actually works

Three layers must agree before a person can do a job. Today they do not.

| Layer | What it controls | Where it lives |
|---|---|---|
| RBAC role | Permission codes the person holds | `sys_auth_roles` + `sys_auth_role_default_permissions`, assigned through `org_auth_user_roles` |
| Menu and page | Which screen opens | `sys_components_cd.main_permission_code`, then the page access contract |
| Workflow stage | Which order status that person may advance | Workflow stage owners / workflow roles. Separate from the RBAC role |

A permission code is `resource:action`, for example `orders:create`. Holding `orders:read` opens every orders screen that uses that code. It does not mean the person is only a washer or only a presser.

One person should have one job. A job is a bundle of task roles. The product stores one RBAC role on the user profile (`org_users_mst.role`) and the effective permissions come from the RBAC assignment. Until multi-role assignment is the supported path, a job must be one role whose defaults are the union of the tasks that job performs. Do not tell a shop to "give the receptionist role A and role B" and expect both to apply.

`super_admin` is the platform operator, not a laundry employee. A shop owner is `tenant_admin`.

### One verb, one code

`orders:read` means open and look at an order. It does not mean create, edit, pay, refund, or move the order to the next station. The same rule applies to every resource: `customers:read` is not `customers:create`, `payments:read` is not `payments:refund`, `delivery:track` is not `delivery:assign`.

A person who may do the action also needs the view code, because the screen has to load the record. A person who may only look does not receive the action code.

| Code | Owns | Does not own |
|---|---|---|
| `orders:read` | Order list, order detail, print a ticket already created | New Order, edit, pay, refund, status change |
| `orders:create` | New Order | The list, by itself |
| `orders:update` / `orders:edit` | Change pieces, notes, service on an open order | Create, pay, status change |
| `orders:transition` | Move an order along the workflow (prepare, process, press, check, pack, ready) | Create, pay, price change |
| `orders:collect_payment` | Take money on the order | Open the drawer admin, approve a variance |
| `orders:process_refund` / `orders:approve_refund` | Refund screens and refund actions | Ordinary order view |
| `orders:cancel` | Cancel | Delete |
| `delivery:track` / `delivery:pod` | Delivery and home-collection work | Building routes |
| `delivery:assign` / `delivery:routes` | Dispatch | The driver's own stop |

Existing codes are reused. A new code is added only when no current verb matches the action.

Menu rows that still use `orders:read` for a different verb:

| Menu row | Path | Now | Becomes |
|---|---|---|---|
| Orders, All Orders | `/dashboard/orders` | `orders:read` | stays |
| New Order | `/dashboard/orders/new` | `orders:create` | stays |
| Preparation, Processing, Assembly, Packing, Quality Check, Ready | those station paths | `orders:read` | `orders:transition` |
| Orders Delivery, Home Collection, Delivery | `/dashboard/delivery`, `/dashboard/home-collection` | `orders:read` | `delivery:track` |
| Issues | `/dashboard/issues` | `orders:read` | stays, because the queue is a view; a refund from an issue stays `orders:process_refund` |
| Workboard | `/dashboard/workboard` | `workboard:read` | stays |

The list API (`GET /api/v1/orders`) may accept `orders:read` or the station verb that needs the list. A write route must require its own verb. Checking `orders:read` on a create, payment, or transition route is the bug this rule removes.

---

## 2. How a laundry actually runs

Industry practice (counter shops, hotel valet, and linen plants) splits the garment flow into named stations. A small shop combines stations. A larger shop names a person at each station so custody, rework, and cash have an owner.

Typical flow:

1. **Book / receive.** Customer, pieces, service, price, promise time, tag.
2. **Take money or put on account.** Cash, card, wallet, gift card, or B2B statement.
3. **Mark and prepare.** Sort by care label, stain note, mend flag, machine load.
4. **Wash or dry-clean.** Machine operator. Faults stop here and go to a supervisor.
5. **Finish.** Press, hand-iron, fold.
6. **Check.** Stain left, damage, missing piece, smell. Fail goes back to wash or press.
7. **Assemble and pack.** Match the tag to the order, bag or hang.
8. **Hold as ready.** Rack, locker, or hanging area.
9. **Hand over or deliver.** Counter pickup, or driver with proof of delivery.
10. **Exception.** Rework, claim, refund, price change, lost piece.

Staff titles seen in real GCC and hotel laundries: receptionist, cashier, sorter/marker, washer, dry-cleaner/spotter, presser, folder/packer, quality checker, valet/driver, route supervisor, linen attendant, storekeeper, branch supervisor, accountant, owner.

Separation that matters once the shop is bigger than one room:

- The person who takes cash does not approve their own drawer difference.
- The person who changes a price or gives a discount does not approve that same exception when a second person exists.
- The driver records delivery. The driver does not void a payment or change the service price.
- The person who washes a piece is not the only quality check once the shop has a checker.
- Stock receiving and stock write-off split when there is a storekeeper and a manager.

A one-person or two-person shop cannot split all of that. The size tables below say when combining is acceptable.

---

## 3. Business sizes

| Size | People | How they work | Roles to assign |
|---|---|---|---|
| Micro | 1–3 | Owner is on the counter and the floor. One helper. | Owner `tenant_admin`. Helper `cashier` if they take money, otherwise `operator` only if they must run the whole floor. Avoid `operator` for a helper who should not refund or post vouchers. |
| Small branch | 4–12 | Counter, wash, press, sometimes one driver. | `cashier` or `receptionist` + `cashier`. `laundry_worker`, `presser`, optional `qa_inspector`, `driver`. Owner `tenant_admin`. Floor lead `supervisor`. |
| Multi-branch | several branches, shared accounts | Branch lead, HQ money, shared drivers. | Each branch: `branch_manager` + the small-branch set. HQ: `accountant` and/or `finance_manager`. Routes: `route_supervisor`. Stock: `store_keeper`. |
| B2B / hotel / linen | contracts, statements, volume | Account work is not the same as the counter. | Owner or a dedicated admin keeps B2B pages. Today only `tenant_admin` and `super_admin` hold `b2b_*`. Do not give those to a cashier. |
| Finance-mature | books, tax documents, period close | ERP-Lite turned on. | `finance_manager` for operations money. `tenant_admin` for chart of accounts, posting, and period close. ERP-Lite permissions are owner-only today. |

Feature flags still hide Reports (`advanced_analytics`), ERP-Lite (`erp_lite_*`), B2B (`b2b_contracts`), and campaigns (`campaigns_enabled`) even when the permission is held.

---

## 4. Task roles — what each station needs

These are the responsibility slices. The "Current role" column is the closest role that exists today. The "Target" column is what production should enforce. Where current and target differ, section 8 lists the fix.

### 4.1 Create and update an order (counter intake)

**Job content:** find or create the customer, choose service and pieces, note stains and preferences, print the ticket, mark urgent, cancel before production starts.

**Needs:** `customers:create`, `customers:read`, `customers:update`, `customers:history`, `customers:tags`, `orders:create`, `orders:read`, `orders:update`, `orders:notes`, `orders:history`, `orders:print`, `orders:urgent`, `orders:cancel`, `orders:service_prefs_view`, `orders:service_prefs_edit`, `products:read`, `pricing:read`.

**Pages:** Dashboard, Customers, All Customers, Orders, All Orders, New Order, Issues (view).

**Must not have by default:** `orders:collect_payment`, `payments:create`, `payments:refund`, `orders:discount_threshold_override`, `pricing:override`, `orders:void_payment`.

**Current:** `receptionist` is the closest (21 permissions) but it can override price (`pricing:override`) and rebill (`orders:rebill_authorize`), and it cannot edit service preferences. `cashier` can create the order and also take money.

### 4.2 Take payment and run the drawer (POS)

**Job content:** open and close own shift, take payment, print invoice, see wallet and points, count the drawer, transfer cash only as the procedure allows.

**Needs:** everything in 4.1 that the same person uses to raise the order, plus `orders:collect_payment`, `orders:view_financial_breakdown`, `payments:create`, `payments:read`, `invoices:create`, `invoices:read`, `invoices:print`, `pos_session:open`, `pos_session:close`, `pos_session:pause_resume`, `pos_session:view`, `pos_session:report_z`, `cash_drawer:view`, `cash_drawer:open_session`, `cash_drawer:close_session`, `cash_drawer:count`, `cash_drawer:record_movement`, `loyalty:view_customer_points`, `promotions:view`, `stored_value:view_balances`, `stored_value:view_ledger`.

**Pages:** POS Sessions, Cash Drawers, plus the intake pages.

**Must not have:** `cash_drawer:approve_variance`, `pos_session:force_close`, `pos_session:close_others`, `orders:approve_refund`, `orders:void_payment`, `payments:refund`, `fin_vouchers:post`.

**Current:** `cashier` (41). It already includes `pricing:override`, `orders:rebill_authorize`, `cash_drawer:transfer`, and `cash_drawer:receive_transfer`. Those four should be a supervisor grant, not the default cashier, once a supervisor exists in that shop.

### 4.3 Prepare / mark / sort

**Job content:** open the preparation queue, confirm piece count, care label, stain, and special request, then move the order into processing.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`, `orders:service_prefs_view`. Workflow stage owner for preparation.

**Pages that should open:** Preparation, and the order detail of orders in that stage. Issues, to log a stain or damage found at intake check.

**Pages that should stay closed:** New Order, payment, ready-for-pickup handover, delivery routes, settings.

**Current:** no dedicated role. `laundry_worker` is the nearest. Preparation menu row exists and is inactive. Every orders child gated by `orders:read` opens for this person, including Delivery and Ready.

### 4.4 Wash and dry-clean (processing)

**Job content:** run the load, record a machine fault by stopping and calling the supervisor, move finished loads toward finishing. Do not reprice.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`. Workflow stage owner for processing.

**Pages:** Processing. Workboard only if this person is a stage owner (`workboard:read` is not on `laundry_worker` today).

**Current:** `laundry_worker` (6 permissions). `orders:urgent` is included, which lets the washer flag priority. That is reasonable. `orders:processing` exists as a permission and is held only by `tenant_admin` and `super_admin`, so it does not scope the floor.

### 4.5 Press and finish

**Job content:** press, iron, fold, move the piece to check or pack.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`. Workflow stage owner for finishing.

**Pages:** the finishing queue. Today there is no separate Press menu row. Assembly is the closest production screen after processing.

**Current:** `presser` (5). Same menu problem as the washer: `orders:read` opens the whole orders tree. Presser cannot flag urgent. That is acceptable.

### 4.6 Quality check

**Job content:** pass or send back. Record the defect. Do not change the price and do not take cash.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`, `customers:read` (to see the care note). Workflow stage owner for QA.

**Pages:** Quality Check, Issues.

**Must not have:** `orders:create`, `orders:collect_payment`, `payments:*`, `orders:discount`.

**Current:** `qa_inspector` (7). Matches the permission slice. The menu still shows every `orders:read` screen.

### 4.7 Assemble and pack

**Job content:** match tags to the order, bag or hang, move to ready.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`, `orders:print`.

**Pages:** Orders Packing, Assembly.

**Current:** no packer role. `supervisor` or `operator` can do it, and both can do much more.

### 4.8 Ready for pickup (counter release)

**Job content:** find the ready order, confirm the customer, hand over, print. Taking the balance is task 4.2, not this task.

**Needs:** `orders:read`, `orders:history`, `orders:print`, `customers:read`. Payment codes only if this same person is also the cashier.

**Pages:** Ready.

**Current:** any role with `orders:read`.

### 4.9 Deliver and collect from home

**Job content:** see assigned stops, navigate, capture proof of delivery, add a note. Not allowed to change price, cancel the order, or refund.

**Needs:** `orders:read`, `orders:history`, `orders:notes`, `customers:read`, `delivery:track`, `delivery:pod`.

**Pages:** Orders Delivery, Home Collection.

**Must not have:** `delivery:assign` (dispatch is the supervisor), `orders:update`, `orders:cancel`, `payments:*`.

**Current:** `driver` (8). It includes `delivery:assign`, so a driver can assign deliveries, not only run them. `help:platform_inventories` is also on this role and should not be.

### 4.10 Dispatch and routes

**Job content:** build routes, assign drivers, follow late stops, read operational delivery numbers.

**Needs:** driver view permissions plus `delivery:assign`, `delivery:routes`, `drivers:read`, `drivers:update`, `reports:view_operational`.

**Pages:** Drivers, Routes, Orders Delivery, Home Collection.

**Current:** `route_supervisor` (12). Fits. Creating a driver record is `drivers:create`, held by `branch_manager` and the owner, not by the route supervisor. That split is right.

### 4.11 Issues, rework, and claims

**Job content:** open an issue, comment, send the piece back to prep or process. Approving a refund or a write-off is finance, not the floor.

**Needs:** `orders:read`, `orders:notes`, `orders:history`, `orders:transition`.

**Pages:** Issues.

**Current:** Issues uses `orders:read`, so every order reader sees it. There is no separate issues permission.

### 4.12 Store and chemicals

**Job content:** receive detergent and packaging, adjust stock, see retail items. Not the garment workflow.

**Needs:** `products:read`, `products:stock`, `products:update`, `orders:read` only if they must see which retail line was sold.

**Pages:** Inventory and Stock should open. They do not, because the menu code `inventory:read` is not a real permission.

**Current:** `store_keeper` (5). The permission `products:stock` exists. The screen gate does not match it.

### 4.13 Read the numbers (accountant)

**Job content:** read invoices, payments, drawers, tax, and reconciliation. Export. Do not move money and do not post the ledger.

**Needs:** `invoices:read`, `invoices:print`, `invoices:export`, `payments:read`, `payments:export`, `finance_reports:view`, `finance_reports:export`, `reconciliation:view`, `tax:view_config`, `tax:view_reports`, `pos_session:view`, `pos_session:view_all`, `pos_session:report_z`, `cash_drawer:view`, `cash_drawer:view_reports`, `cash_drawer:view_all_branches`, `reports:view_financial`.

**Pages:** Invoices, AR read screens, Reconciliation, Financial Reports, Cash Variance, POS Sessions (view).

**Current:** `accountant` (31) is described as read-only and is not. It can `stored_value:issue_wallet_credit`, `cash_drawer:approve_variance`, `cash_drawer:post_close_update`, `currencies:manage`, `fx_rates:manage`, and `payments:reconcile`. Those belong to `finance_manager` or the owner.

### 4.14 Move money (finance manager)

**Job content:** refunds, voids, rate overrides, wallet issue, variance approval, reconciliation run, voucher post, cash control settings.

**Needs:** the accountant read set, plus `payments:refund`, `orders:approve_refund`, `orders:process_refund`, `orders:void_payment`, `orders:post_settlement_edit`, `cash_drawer:approve_variance`, `reconciliation:run`, `reconciliation:acknowledge_issues`, `fin_vouchers:create`, `fin_vouchers:post`, `fin_vouchers:reverse`, `cash_control:manage`, `stored_value:issue_wallet_credit`, `stored_value:issue_advance`, `stored_value:top_up_wallet`.

**Pages:** Refunds, Pending Payments, Variance Approvals, Vouchers, Outbox, Cash Control Settings.

**Current:** `finance_manager` (75) is the right seat. It can also open and close other people's POS sessions and operate any drawer. That is a branch-recovery power. Keep it, and do not copy it onto `cashier`.

### 4.15 Run one branch

**Job content:** the floor plus the counter exceptions: split an order, discount inside policy, force-close a forgotten shift, see staff reports, manage drivers of that branch. Not chart of accounts, not subscription, not role design.

**Needs:** `supervisor` powers plus branch settings, driver create, voucher create/post for the branch, AR view, tax document issue.

**Pages:** Workboard, branch settings, drivers, internal finance pages whose permission this role holds.

**Current:** `branch_manager` (147) and `supervisor` (37). Use `supervisor` as the floor lead who must not post finance. Use `branch_manager` when that person also runs the branch cash and AR. `branch_manager` can `orders:discount_threshold_override` and `pos_session:force_close`. That is correct for a branch lead and wrong for a cashier.

### 4.16 Own the company

**Job content:** users, roles, subscription, workflow design, catalog, B2B contracts, ERP-Lite, security sessions.

**Current:** `tenant_admin` (347). This is the only laundry role that should receive new owner-only permissions by default. `admin` (148) is a delegated office manager: users, roles, branding, pricing, refunds, but not ERP-Lite and not B2B. `it_support` (11) resets passwords and reads logs. It must not get `auth_config:update` unless the owner explicitly adds it. Today it does not have that code. Good.

### 4.17 Look only

**Current:** `viewer` (31). Intended as read-only. It includes `notifications:manage`, which can change notification setup. Remove that before using `viewer` for an auditor or a silent partner.

### 4.18 B2B customer login

**Current:** `b2b_customer` (9): read and print own orders, invoices, and payments. This is a portal seat, not a staff seat. Staff who manage those accounts need `b2b_customers:view` and the matching create codes, which today sit only on the owner.

---

## 5. Jobs — which task roles a position holds

Assign the job, not a pile of overlapping roles. Until one user can hold several RBAC roles safely, implement each job as one role.

| Position | Tasks from section 4 | Role to assign now | Do not also assign |
|---|---|---|---|
| Owner | 4.16, and any task nobody else covers | `tenant_admin` | `super_admin` |
| Office manager | users, pricing, refunds, settings, not the books of ERP | `admin` | `tenant_admin` unless they own the company |
| Branch manager | 4.15 | `branch_manager` | `tenant_admin` |
| Floor supervisor | intake oversight, assign, cancel, workboard, no ledger post | `supervisor` | `finance_manager` |
| Receptionist who also cashes | 4.1 + 4.2 + 4.8 | `cashier` | `operator`, `admin` |
| Receptionist who only books | 4.1 + 4.8 | `receptionist` | `cashier` |
| Washer / dry-cleaner | 4.4 | `laundry_worker` | `operator` |
| Presser | 4.5 | `presser` | `operator` |
| Checker | 4.6 | `qa_inspector` | `cashier` |
| Packer | 4.7 | no safe role yet; temporary `presser` or `supervisor` | `operator` |
| Driver | 4.9 | `driver` | `route_supervisor` unless they also dispatch |
| Dispatcher | 4.10 | `route_supervisor` | `tenant_admin` |
| Storekeeper | 4.12 | `store_keeper` | `cashier` |
| Accountant | 4.13 | `accountant` after the write powers are removed | `finance_manager` |
| Finance manager | 4.14 | `finance_manager` | `cashier` |
| IT | password reset, read logs | `it_support` | `admin` |
| Auditor / silent partner | read | `viewer` after `notifications:manage` is removed | any write role |
| Corporate customer | portal | `b2b_customer` | any staff role |

### Combined jobs by shop size

**Micro.** Owner `tenant_admin`. The second person is `cashier` if they face customers, or `laundry_worker` if they only wash. Do not use `operator` for that second person. `operator` can refund, sell and redeem gift cards, post vouchers, cancel payments, and open other people's shifts (88 permissions).

**Small branch.** Owner `tenant_admin`. Counter `cashier`. If the counter is split, one `receptionist` and one `cashier`. Floor: `laundry_worker` and `presser`. Add `qa_inspector` when a third production person exists. One driver: `driver`. The person who stays late and fixes the queue: `supervisor`, not `operator`.

**Multi-branch.** Each site: `branch_manager`, `cashier`, production roles, `driver`. HQ: `accountant` plus `finance_manager` if someone other than the owner moves money. Shared vans: `route_supervisor`. Central chemical store: `store_keeper`.

**Hotel or contract laundry.** Same production roles, plus an owner-held B2B seat until a `b2b_coordinator` role exists. Statements and dunning stay with `finance_manager` or `branch_manager`, not the driver who picks up the linen.

---

## 6. What each current role can open

Menu visibility follows the permission, not the job name. Parent rows appear when a child is visible.

| Role | Count | Opens today | Stays closed |
|---|---|---|---|
| `cashier` | 41 | Orders tree (`orders:read` / `orders:create`), Customers, POS Sessions, Cash Drawers, Cash In Transit, Stored Value, Dashboard, Help | Settings, users, catalog, refunds approval, variance approval, ERP, B2B, inventory |
| `receptionist` | 21 | Orders tree except payment-only actions, Customers, Dashboard, Help. Reports children with no permission if `advanced_analytics` is on | POS, cash drawer, settings |
| `laundry_worker` | 6 | Whole orders tree, Issues, Delivery, Ready, Home Collection, Dashboard, Help | New Order (`orders:create`), customers, money |
| `presser` | 5 | Same orders tree as the washer | Urgent flag, customers, money |
| `qa_inspector` | 7 | Orders tree plus customer read | Money, settings |
| `driver` | 8 | Orders tree (because `orders:read`), customer name, delivery actions | Dispatch screens that need `delivery:routes`, money, settings |
| `route_supervisor` | 12 | Drivers and routes, orders read, operational reports | Creating drivers, money |
| `store_keeper` | 5 | Orders read screens. Inventory menu stays hidden | Money |
| `supervisor` | 37 | Orders, customers, workboard, drivers read, POS view of all sessions, operational reports | User admin, ERP, catalog setup |
| `accountant` | 31 | Finance read pages, and also variance approval and wallet issue | Order create, catalog |
| `finance_manager` | 75 | Finance operations, drawers, refunds, FX, vouchers-related order powers. Order list stays closed because `orders:read` is missing | Full order screen, ERP-Lite |
| `branch_manager` | 147 | Branch operations, AR, vouchers, tax documents, drivers, workboard | ERP-Lite, B2B setup, subscription |
| `admin` | 148 | Office: users, roles, pricing, refunds, settings read/update, branding | ERP-Lite, B2B, subscription |
| `operator` | 88 | Almost the whole counter and a large part of finance | Settings admin, ERP, B2B |
| `tenant_admin` | 347 | All tenant permissions, subject to feature flags | Other tenants |
| `it_support` | 11 | Settings read, users read, activate, reset password, logs | Auth policy update, orders |
| `viewer` | 31 | Read screens across orders, finance, reports | Writes, except notification manage |
| `b2b_customer` | 9 | Read and print orders, invoices, payments | Staff screens |

`help:platform_inventories` is on cashier, driver, washer, presser, checker, storekeeper, receptionist, and accountant. That page is an internal platform inventory, not a shop task. Take it off every operational default.

---

## 7. Pages, permissions, and APIs

The sidebar is `sys_components_cd`. The page and its API must require the same permission as the menu row. Contracts live under `web-admin/src/features/*/access/*-access.ts`. When a contract is empty, the page is open to any signed-in user even if the menu is stricter, or the reverse.

Station pages and the permission that actually opens them:

| Station | Page | Permission on the menu now | Target permission |
|---|---|---|---|
| Home | `/dashboard` | none (every signed-in user) | keep |
| New order | `/dashboard/orders/new` | `orders:create` | keep |
| All orders | `/dashboard/orders` | `orders:read` | stays the view |
| New order | `/dashboard/orders/new` | `orders:create` | stays the create |
| Workboard | `/dashboard/workboard` | `workboard:read` | stage owners and supervisors only |
| Preparation | `/dashboard/preparation` | `orders:read`, row inactive | `orders:transition` |
| Processing | `/dashboard/processing` | `orders:read` | `orders:transition` |
| Assembly | `/dashboard/assembly` | `orders:read` | `orders:transition` |
| Packing | `/dashboard/packing` | `orders:read` | `orders:transition` |
| Quality check | `/dashboard/qa` | `orders:read` | `orders:transition` |
| Ready | `/dashboard/ready` | `orders:read` | `orders:transition` |
| Delivery | `/dashboard/delivery` | `orders:read` | `delivery:track` |
| Home collection | `/dashboard/home-collection` | `orders:read` | `delivery:track` |
| Issues | `/dashboard/issues` | `orders:read` | stays a view; a refund stays `orders:process_refund` |
| POS sessions | `/dashboard/internal_fin/pos-sessions` | `pos_session:view` | keep |
| Cash drawers | `/dashboard/internal_fin/cash-drawers` | `cash_drawer:view` | keep |
| Variance approval | `.../variance-approvals` | `cash_drawer:approve_variance` | finance manager or branch manager, never the cashier who counted |
| Refunds | `.../refunds` | `orders:process_refund` | finance manager; branch manager where the shop allows |
| Customers | `/dashboard/customers` | `customers:read` | keep |
| Account receipt | `.../account-receipt` | `customers:receipt_allocate` | branch manager / finance, not cashier, unless the shop takes account payments at the counter |
| Catalog | `/dashboard/catalog` | `admin:manage` | owner or `admin` |
| Service preferences catalog | `.../catalog/preferences` | `config:preferences_manage` | owner or office manager |
| Inventory | `/dashboard/inventory` | `inventory:read` (code does not exist) | `products:stock` for the storekeeper |
| B2B | `/dashboard/b2b/*` | `b2b_*:view` plus flag `b2b_contracts` | owner until a coordinator role exists |
| ERP-Lite | `/dashboard/erp-lite/*` | `erp_lite*:view` plus the matching flag | owner, then a finance role when books are live |
| Settings | `/dashboard/settings` | `settings:read` | `admin`, `it_support`, owner |
| Workflows | `.../workflows` | `settings:workflow` | owner or `admin` |
| Workflow roles screen | `.../workflow-roles` | `settings:workflow_roles:view` (illegal code, two colons) | a real `settings:workflow` or a new legal code |
| Security | `.../security` | `auth_config:read` | owner; update stays `auth_config:update` |
| Subscription | `.../tenant-admin/subscription` | `settings:subscription` | owner |
| Reports hub and the five general reports | `/dashboard/reports` and orders, payments, invoices, revenue, customers | no permission, flag `advanced_analytics` | `reports:view_operational` or `reports:view_financial` per report |
| Financial report | `.../reports/financial` | `finance_reports:view` plus the flag | accountant and above |
| Cash variance report | `.../reports/cash-variance` | `cash_drawer:view_reports` | accountant, finance manager, branch manager |
| Help | `/dashboard/help` | none | keep |
| JWT test | `/dashboard/jhtestui` | `admin:manage` | not a shop page |

Internal Finance itself is gated by `billing:read`, which is not a permission row. The section still appears when a child such as POS Sessions matches. Do not invent `billing:read`. Point the parent at a real code or leave it to be pulled in by children.

APIs follow the same codes. A screen is not done until the route in `app/api` checks the same permission the page contract lists. Money writes (`payments`, `refunds`, `void`, `drawer approve`, `voucher post`) stay on the server even if the button is hidden.

---

## 8. Gaps to close before this is production-safe

These are gaps in the current defaults and menu, not a request to change them inside this document.

1. **`orders:read` is used as a stand-in for other verbs.** Station menus (preparation through ready) open on `orders:read` instead of `orders:transition`. Delivery and home collection open on `orders:read` instead of `delivery:track`. Anyone who can view an order sees those work screens. View stays `orders:read`. Each action uses its own code. Washer versus presser is still the workflow stage owner after that split, because both stations share `orders:transition`.
2. **`operator` is too wide for a named job.** 88 permissions include refunds, payment cancel, gift cards, vouchers, and other people's shifts. Do not assign it as "the worker."
3. **`accountant` can move money** (`stored_value:issue_wallet_credit`, `cash_drawer:approve_variance`, `currencies:manage`, `fx_rates:manage`) while its description says read-only.
4. **`viewer` can `notifications:manage`.**
5. **`cashier` can override price and rebill, and can transfer cash.** Move those to `supervisor` or `branch_manager` when the shop has one.
6. **`driver` can `delivery:assign`.** Dispatch belongs to `route_supervisor`.
7. **`help:platform_inventories` is on shop-floor roles.**
8. **Reports with a null permission** open for every signed-in user when `advanced_analytics` is on, including washers.
9. **`inventory:read` and `billing:read` are not permissions.** Inventory stays hidden. Internal Finance appears only as a parent of a permitted child.
10. **`settings:workflow_roles:view` is not a legal permission code** (two colons). The workflow-roles screen cannot match a real grant.
11. **Preparation is inactive** in the menu, so the marking station has no page.
12. **No packer, spotter, or B2B coordinator role.** Packing falls to a supervisor. B2B falls to the owner.
13. **`finance_manager` has no `orders:read`.** Refund work is granted, the order list is not. They will not see the order they are refunding unless another path loads it.
14. **Profile role and RBAC role can disagree.** The sidebar label and some admin checks still read `org_users_mst.role`. Effective permissions read `org_auth_user_roles`. A cashier label with an operator grant is the bug already seen. One assignment path must write both, or the label must read the RBAC role.
15. **One role per person is the practical rule.** Job design in section 5 assumes that. If a later change allows several roles, re-check deny rules and resource-scoped grants before combining cashier with finance manager.

---

## 9. Order of work when we implement

1. Apply the one-verb rule in section 1. Move station menus from `orders:read` to `orders:transition`, and delivery menus from `orders:read` to `delivery:track`. Keep New Order on `orders:create` and the order list on `orders:read`. Point each write API at its own verb.
2. Stop assigning `operator` to new shop staff. Map each living user to a job in section 5.
3. Remove `help:platform_inventories` from every role except the owner and `it_support`.
4. Remove write and approve codes from `accountant`. Remove `notifications:manage` from `viewer`. Remove `delivery:assign` from `driver`.
5. Decide cashier policy: keep or remove `pricing:override`, `orders:rebill_authorize`, and drawer transfer.
6. Give `finance_manager` `orders:read` so refund screens have an order to open.
7. Point inventory menu rows at `products:stock`. Leave `billing:read` unused; keep children as the gate.
8. Replace `settings:workflow_roles:view` with a legal code before that screen is used.
9. Set a real report permission on the five general report rows so floor staff do not inherit them from a null code.
10. Activate Preparation only after its stage owner is configured.
11. Add a packer role only if packing is a different person from the presser. Add a B2B coordinator only when someone other than the owner manages contracts.
12. After each permission change, rebuild the access inventories and check the page contract against the API.

Do not add a new permission when an existing verb already names the action. `orders:read` is only the view.
