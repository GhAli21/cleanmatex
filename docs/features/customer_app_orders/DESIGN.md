# Customer App Orders — Architecture and Domain Design

**Status:** Proposed, pending implementation approval

## 1. Product model

The customer application has one global customer identity, with many tenant-specific customer relationships. Authentication must happen before a tenant is selected; customer authorization becomes tenant-scoped only after the authenticated customer selects an eligible tenant.

```text
sys_customers_mst (global identity and credential)
  └─ org_customers_mst (tenant relationship, visibility and local rules)
       └─ org_ord_requests_mst (customer Fast Quick Drop request)
            └─ org_orders_mst (staff-created operational order)
```

Existing repository evidence shows that `sys_customers_mst` is the global identity and `org_customers_mst` is the tenant relationship. The proposed design must be revalidated against the remote database before a migration is authored.

### Current-contract replacement decision

The existing customer password implementation is tenant-first: its public login requires `tenantId` and consults `org_customers_mst.password_hash`. It also does not issue the customer bearer session required by protected mobile order/booking APIs. This feature retires that authority from the mobile sign-in path instead of attempting to merge tenant-level hashes into one global credential. Password hashes cannot establish that different tenant profiles use the same password because each valid hash has an independent salt. Existing password users receive a controlled reset/temporary activation credential under the new global flow; dual credential authorities are prohibited.

## 2. Customer credentials

### Identifier

The customer chooses either:

- country code plus mobile number; or
- verified email address.

Phone input is normalized to E.164. Email is normalized for lookup according to the verified identity policy. Pre-authentication responses remain indistinguishable for unknown, stopped, hidden, and incorrect-password accounts, preventing account enumeration.

### Credential storage

Credentials belong to the global customer identity, not `org_customers_mst`. Never store `password_value`, a temporary password, or an activation PIN in plaintext.

The intended credential state is:

| Field | Purpose |
|---|---|
| `password_hash` | One-way password hash only. |
| `password_changed_at` | Last successful customer password change. |
| `password_must_change` | Blocks all normal customer APIs after temporary-password sign-in. |
| `temporary_password_expires_at` | Limits temporary credential lifetime. |
| failed-attempt/lock fields | Brute-force and credential-stuffing protection. |
| `password_version` | Revokes active access/refresh sessions after reset or compromise. |

A six-digit staff-generated value is an activation PIN, not a durable password. It must be randomly generated with a cryptographic generator, rate limited, short lived, displayed once, stored only as a hash, invalidated on use, and immediately replaced with a customer-selected password.

### Session contract

Successful password sign-in returns customer-scoped opaque access and refresh tokens. The app stores tokens only in platform secure storage. Refresh tokens rotate, sessions are revocable by password version, and an expired/revoked session cannot call tenant, request, order, or booking APIs.

## 3. Tenant relationship and visibility

`org_customers_mst` owns tenant-specific visibility because it represents the global-customer-to-tenant relationship.

Use `is_hidden_by_customer BOOLEAN NOT NULL DEFAULT false`, not `is_stop_customer`:

- only the authenticated customer can hide/unhide their own relationship;
- it only controls mobile-list visibility;
- it never changes tenant customer activity, credit hold, balance, orders, or data retention;
- active orders remain discoverable until they close, even when the customer has hidden the tenant from normal browsing.

The authenticated tenant list includes an active relationship or order history, removes customer-hidden relationships from the normal list, and never exposes arbitrary tenants by phone/email lookup. New tenant discovery requires an invite, QR code, or tenant code.

## 4. Branch eligibility

`org_branches_mst` needs independent capability flags:

- `is_customer_app_enabled` — eligible for customer-app booking/request selection.
- `is_pos_enabled` — eligible for POS intake.

These do not replace `is_active`. A customer branch candidate must be active, customer-app enabled, and capable of the requested fulfillment/service. A POS branch candidate must be active and POS enabled.

Branch selection is optional only if tenant policy permits staff assignment later. If there are multiple eligible branches and assignment is not permitted, the customer must choose one. Address data and a customer confirmation call are validation inputs; service coverage and branch capability remain authoritative server checks.

## 5. Fast Quick Drop request lifecycle

Fast Quick Drop is an unpriced customer request, not an operational order. It must not create final money, inventory, service consumption, or a priced order line.

### Proposed data model

- `org_ord_requests_mst`: request header, tenant/customer scope, DB-generated request code, request type/source/status, preferred branch, fulfillment and return-delivery choices, address reference/snapshot, requested speed, estimated piece count, notes, and eventual order linkage.
- `org_ord_request_lines_dtl`: customer declarations — optional service category, optional catalog product, free-text item name, estimated quantity, and notes.
- `org_orders_mst.source_request_id`: tenant-safe link to the originating request. `source_request_no` is permitted only as an immutable display snapshot; the ID is authoritative.

All new `org_*` tables carry direct `tenant_org_id`, RLS, audit fields, documented objects, composite tenant-safe foreign keys, and indexes derived from request-list/read paths. A request code is generated in the database using the shared document-sequence mechanism.

### Customer request states

```text
SUBMITTED → REVIEWING → CONTACT_REQUIRED → ACCEPTED
          → REJECTED | CANCELLED
ACCEPTED → ORDER_CREATED
```

Customer-visible state labels are localized and plain-language; they never expose internal workflow or staff details.

### Staff conversion invariant

The tenant user opens the request from the new-order workflow, validates branch/contact/address data, creates a normal order through the existing order-authority path, and links it atomically to the request. One request creates at most one order. The conversion writes the actual order and the request status/link in one reviewed transaction/use-case with idempotency protection.

## 6. Customer journeys

### Sign-in and selection

```text
Mobile/email + password
→ force replacement when temporary password is used
→ authenticated tenant list
→ choose tenant
→ choose branch when required
→ choose Fast Quick Drop or Detailed Order
```

### Fast Quick Drop

```text
Tenant → eligible branch or staff assignment → drop-off/collection
→ collection and return address when needed → delivery-back preference
→ eligible speed → estimated pieces → optional declared rows
→ submit unpriced request → request tracking → linked order tracking
```

Every screen provides loading, empty, error, offline, and success states, is EN/AR localized, and is RTL-safe.

### Detailed Order

Detailed Order uses tenant/branch-scoped real catalog data, availability rules, fulfillment selection, address/slot rules, server-side pricing, and idempotent order creation. It never trusts mobile prices or turns free-text declarations into priced product lines.

## 7. Dashboard administration

The customer detail screen receives a credential action protected by a dedicated `customers:manage_credentials` permission. It generates/replaces a temporary activation credential, shows it exactly once, revokes sessions, forces password replacement, and writes an audit event that excludes the secret.

The request conversion surface is staff-only and is protected by orders/request permissions. It must derive tenant scope from the authenticated staff session and must not accept a caller-provided tenant identifier as authority.

## 8. Non-negotiable security and correctness rules

- Every `org_*` read/write includes an explicit `tenant_org_id` filter or value.
- Password/PIN values, refresh tokens, raw mobile numbers, emails, and address contents are never logged.
- Public APIs apply request-size bounds, schema validation, rate limits, generic credential failures, and customer membership checks.
- Mobile uses only typed provider → repository → service boundaries; no direct API calls in widgets.
- Customer request details are not financial authority. Only existing commercial/order services calculate money.
- Migration drafts are new, fully commented, forward-only files; they are never applied by an agent.
