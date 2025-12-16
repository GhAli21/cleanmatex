
Customer Data Management: Global and Tenant:

1. **Why** we need a Global Customer Registry (sys level).
2. **Data model**: `sys_customers_mst` (global) vs `org_customers_mst` (tenant-scoped).
3. **Create/Update flows**: what happens when a tenant creates a customer.
4. **Matching / de-duplication rules** (phone, email, national ID).
5. **RLS & permissions** (who can see the global record).
6. **Projection/sync**: how to update tenant copy when global is updated.
7. **APIs** to support this.
8. **Edge cases** (same person in two tenants with different phones).

Then we’ll plug it into the v1.8 outline as a new section (let’s call it **Section 24 – Global Customers & Shared Identity**).

---

## 24. Global Customers & Shared Identity

### 24.1 Problem Statement

* CleanMateX is **multi-tenant**: each laundry (tenant) has its own customers.
* But *you* (HQ) want to see **one single identity** for “this real person” across all laundries — for analytics, anti-fraud, marketing, even possible marketplace/federated future.
* Tenants will still **create customers locally** (reception, mobile app, POS) — we can’t force them to pick from a global list every time.
* So we need a **two-layer customer model**:

> **Layer 1 (Global):** “This is Ahmed Ali, phone +9689…, he exists in the platform.”
> **Layer 2 (Tenant):** “This is Ahmed as a customer of Al-Noor Laundry Muscat; he has customer code CUST-00034 there, 10 orders, 2 invoices, a discount, and different address.”

So we separate **identity** (global) from **relationship** (tenant).

---

### 24.2 Data Model

We add/confirm **two tables**:

1. **Global (system) table**

   ```sql
   create table sys_customers_mst (
     sys_customer_id      uuid primary key default gen_random_uuid(),
     primary_phone        text,         -- E.164 normalized
     email                text,
     full_name            text,
     full_name2           text,         -- Arabic
     national_id          text,
     country_code         text,
     meta                 jsonb,        -- extra attributes
     is_blocked           boolean default false,
     created_at           timestamptz default now(),
     updated_at           timestamptz default now()
   );

   create unique index ux_sys_customers_phone
     on sys_customers_mst (primary_phone)
     where primary_phone is not null;
   ```

2. **Tenant-scoped (organization) table**
   (you already have the pattern, we just make it explicit)

   ```sql
   create table org_customers_mst (
     tenant_org_id        uuid not null,
     org_customer_id      uuid not null default gen_random_uuid(),
     sys_customer_id      uuid,  -- FK to global, OPTIONAL
     customer_code        text,  -- per-tenant code CUST-0001
     full_name            text,
     full_name2           text,
     phone                text,
     email                text,
     address              text,
     customer_type_cd     text,
     is_active            boolean default true,
     created_at           timestamptz default now(),
     updated_at           timestamptz default now(),
     primary key (tenant_org_id, org_customer_id)
   );
   ```

3. **(Optional) Link / Bridge table** for many-to-many, if later we support **one tenant having many branches → same customer**:

   ```sql
   create table org_customer_links (
     tenant_org_id   uuid not null,
     org_customer_id uuid not null,
     sys_customer_id uuid not null,
     link_source     text,          -- 'AUTO_MATCH','MANUAL_LINK','IMPORT'
     created_at      timestamptz default now(),
     primary key (tenant_org_id, org_customer_id, sys_customer_id)
   );
   ```

---

### 24.3 Core Principles

1. **Tenants own their customers** → they always write to `org_customers_mst`.
2. **HQ owns identities** → it maintains `sys_customers_mst`.
3. **org → sys is optional but recommended** → we try to match and link automatically.
4. **Matching must be tolerant** (different formats of phone, missing email).
5. **No tenant can see other tenant’s org data** (RLS) **but HQ can**.
6. **Global customer never deleted** — only marked blocked/merged.
7. **Tenant customer never deleted** — only marked is_active=false, rec_status=0.

---

### 24.4 Create Customer Flow (Tenant Creates)

**Scenario:** Receptionist in Tenant A creates a new customer with phone `+96891234567`.

**Flow:**

1. **Tenant app / admin UI →** POST `/v1/customers` (this is tenant API, not HQ)

   ```json
   {
     "full_name": "Ahmed Ali",
     "phone": "+96891234567",
     "email": null,
     "address": "Muscat Qurum"
   }
   ```

2. **Service logic (in NestJS tenant service) does:**

   **Step 1: normalize phone**

   * Strip spaces, dashes, make E.164
   * If country is known from tenant org, prepend code

   **Step 2: try to find global**

   ```sql
   select sys_customer_id
   from sys_customers_mst
   where primary_phone = $normalized_phone
      or email = $email
   limit 1;
   ```

   * If found → we have **global identity**

   **Step 3A: if found**

   * Insert into `org_customers_mst` with `sys_customer_id = found_id`

   **Step 3B: if not found**

   * Insert into `sys_customers_mst` first
   * Then insert into `org_customers_mst` with the new `sys_customer_id`

   **Step 4: audit**

   * Insert into `sys_audit_log`:

     * action: `TENANT_CUSTOMER_CREATED`
     * tenant_org_id
     * org_customer_id
     * sys_customer_id (if any)
     * payload (old=null, new=customer json)

3. **Result:**

   * Tenant has its own customer
   * HQ now can see this person in **all tenants** where he appears

---

### 24.5 Update Customer Flow (Tenant Updates)

**Problem:** Tenant updates the phone or name. Do we update global too?

We make it **rule-based** (so you can tune it later):

* **Rule 1 (safe updates):** if tenant changes **only local fields** (address, notes, customer_type), update only `org_customers_mst`.
* **Rule 2 (identity fields):** if tenant changes **phone or email**, we need to **re-evaluate the global match**.

  * If new phone matches **existing** `sys_customers_mst` → re-link this org record to that global.
  * If new phone matches **multiple** → keep current link, flag for HQ review.
  * If new phone matches **none** → OPTION A: create new global; OPTION B: keep old global and write a “possible identity change” in audit.

So the **service** becomes:

```pseudo
update_org_customer(tenant_org_id, org_customer_id, payload):
  old = select * from org_customers_mst ...
  update org_customers_mst set ... ;
  if phone or email changed:
      call re_evaluate_global_link(tenant_org_id, org_customer_id)
  insert audit(...)
```

And `re_evaluate_global_link(...)` is the place where you can later plug **AI-based** or **rules-based** matching.

---

### 24.6 Matching / De-duplication Strategy

We define **matching tiers**:

1. **Tier 1 (Strong):** phone (E.164) **AND** country match
2. **Tier 2 (Medium):** email match
3. **Tier 3 (Weak):** name + phone last 6 digits
4. **Tier 4 (Manual):** HQ user picks the match in HQ console

So the logic at create-time:

```text
if (Tier1 match) → link
else if (Tier2 match) → link
else → create new global
```

Later, an **HQ job** (`global_customers_dedupe_worker`) can scan `sys_customers_mst` and suggest merges:

* same phone, different name
* same email, different phone
* many org customers pointing to different globals but look similar

**Merging**: we never hard-delete; we set `merged_into = other_sys_customer_id` and update all org references.

---

### 24.7 RLS & Visibility

* `org_customers_mst` → **RLS ON** → tenant can see **only** its own customer records.
* `sys_customers_mst` → **RLS OFF (or HQ-only)** → only HQ roles can see full list.
* To show a tenant if “this customer exists in other tenants” → **NO** by default (privacy). That stays HQ-only.
* HQ console page: **“Global Customers”** → table of `sys_customers_mst` with:

  * linked tenants count
  * first_seen_at
  * last_seen_at
  * dedupe_status

---

### 24.8 Propagating Global → Tenant Changes

Sometimes **HQ** will fix a global record: e.g. they unify the phone format, or they add national_id.
When that happens, we may want to **push** some of this down to tenant-level customers.

We do it **selectively**:

* Fields considered **identity canonical**: phone, email, full_name
* Fields considered **local**: address, branch, pricing group

**Mechanism:**

1. HQ updates `sys_customers_mst`
2. Trigger or worker emits event: `global.customer.updated`
3. Worker finds all `org_customers_mst` linked to this `sys_customer_id`
4. For each, apply **propagation policy**:

   * overwrite phone/email if tenant didn’t lock it
   * don’t overwrite address
5. Write audit entry per tenant

This is best done by **BullMQ worker** to avoid slowing down HQ update.

---

### 24.9 APIs

**HQ APIs**

* `GET /v1/hq/customers/global` → list global customers
* `GET /v1/hq/customers/global/{sys_customer_id}` → show linked tenants
* `POST /v1/hq/customers/global/{sys_customer_id}/merge` → merge duplicates
* `POST /v1/hq/customers/global/{sys_customer_id}/propagate` → push down identity to all linked org customers

**Tenant APIs**

* `POST /v1/customers` → create tenant customer (with auto-link to global)
* `PATCH /v1/customers/{id}` → update tenant customer (with re-evaluate)
* `GET /v1/customers/{id}` → show tenant customer (with optional global_id field)
* `GET /v1/customers/search?phone=...` → also checks global and suggests “maybe existing”

---

### 24.10 Edge Cases

1. **Same person uses 2 numbers in 2 laundries**

   * Two org customers, two global customers → HQ can later merge global → both org rows now point to the merged global.

2. **Tenant entered wrong phone**

   * Tenant can fix; re-evaluation happens; old global might become “orphan” → HQ dedupe job can delete/merge.

3. **Two tenants create same customer at same second**

   * Unique index on `sys_customers_mst.primary_phone` (partial) will protect you; one insert wins, the other must reselect.

4. **Privacy / business separation**

   * Tenants never see “oh this customer is also with your competitor”. That is HQ-only view.

---

### 24.11 Why This Belongs in SaaS Platform Management

Because:

* It is **cross-tenant**,
* It is **governed by HQ**,
* It benefits **analytics, billing, and AI**,
* And it matches your earlier schema pattern (sys_* global, org_* tenant, RLS).

So we add this to the v1.8 outline as:

> **24. Global Customers & Shared Identity**
>
> * Global customer registry: `sys_customers_mst`
> * Tenant-scoped customers: `org_customers_mst`
> * Auto-link & matching rules
> * Dedupe worker
> * Propagation worker
> * HQ console for customer identity

---

