# Technical Specification
# Database Design

# 1. Naming Standards

| Prefix | Meaning |
|---|---|
| sys_* | global reference/config |
| org_* | tenant-owned |
| *_mst | master/header |
| *_dtl | detail rows |
| *_cf | configurable |
| *_cd | code/reference |

---

# 2. Money Standards

Use:

```sql
numeric(19,4)
```

Never use:
- float
- double

---

# 3. Tenant Standards

Every org table must contain:

```sql
tenant_org_id uuid not null
```

---

# 4. Mandatory Audit Columns

```sql
created_at timestamptz
created_by uuid
updated_at timestamptz
updated_by uuid
metadata jsonb default '{}'
```

---

# 5. Financial Tables

```text
org_order_charges_dtl
org_order_discounts_dtl
org_order_taxes_dtl
org_order_credit_apps_dtl
org_order_payments_dtl
org_order_refunds_dtl
org_order_adjustments_dtl
```

---

# 6. Required Indexes

```sql
(tenant_org_id, order_id)
(tenant_org_id, customer_id)
(tenant_org_id, created_at desc)
```

---

# 7. Required Constraints

```sql
amount >= 0
quantity > 0
```
