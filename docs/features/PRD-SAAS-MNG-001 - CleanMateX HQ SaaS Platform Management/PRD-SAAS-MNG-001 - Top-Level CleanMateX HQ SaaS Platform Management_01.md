
Since the **SaaS Platform Management module** will be **used internally by you and your HQ team** (not exposed to customers or tenants), we’ll refine the PRD to reflect an **“Internal SaaS HQ Console”** model rather than a public self-serve system.

Here’s how that changes the design, governance, and responsibilities:

---

# **PRD-SAAS-MNG-001 — CleanMateX HQ SaaS Platform Management (Internal Edition v1.6-Draft)**

**Owner:** Jehad Ali (Jh Apps HQ)
**Users:** Jh Apps Core Team (Founders, DevOps, Admins, Auditors)
**Type:** Internal Management Module
**Scope:** Full administrative and governance layer for CleanMateX tenants, plans, workflows, catalogs, and metrics.

---

## **1. Purpose**

Enable the HQ team to centrally:

* Create, configure, and monitor all **tenant organizations**.
* Manage **plans, feature sets, and limits**.
* Control **catalogs, workflows, and system data**.
* Audit and observe all operations across the platform.
* Automate enforcement, billing, and data hygiene.

It is **not customer-facing**; access restricted to authorized Jh Apps staff.

---

## **2. Role Model (Internal Users)**

| Role                         | Access Scope                                     | Key Tasks                                           |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| **Super Admin (Jehad)**      | Full access                                      | Architecture, plans, feature flags, workflow models |
| **Technical Admin / DevOps** | Infrastructure, logs, schema control             | Run migrations, monitor clusters, backup restore    |
| **Business Admin**           | Tenant setup, plan assignment, billing oversight | Manage plans, invoices, renewals                    |
| **QA & Compliance**          | Audit logs, data export, review changes          | Verify traceability and security                    |
| **Support/Analyst**          | Read-only dashboards                             | Monitor usage, detect issues                        |

RBAC is enforced at API level and in UI via role claims.

---

## **3. Internal Design Adjustments**

| Area                        | Internal Behavior                                                                |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Authentication**          | Internal users authenticated via Jh Apps SSO / Supabase Auth (role-based JWT)    |
| **Multi-Environment Setup** | `dev`, `stage`, `prod-hq` — internal console runs on protected VPC or VPN        |
| **Data Visibility**         | HQ can view all tenants’ operational stats, not limited by RLS                   |
| **Audit Logging**           | Full history of every change made by any HQ member                               |
| **Change Approval**         | Optional two-step review for destructive operations (tenant deletion, downgrade) |
| **Error Handling**          | Centralized Sentry + Slack alert to devops channel                               |

---

## **4. Internal-Use Feature Focus**

### **4.1 Tenant Administration Console**

* Create and edit tenant metadata.
* Assign or change plans manually.
* Trigger seed jobs (catalog, workflow, settings).
* Suspend/reactivate tenants.
* Impersonate tenant admin (for support debugging).

### **4.2 Plan and Feature Governance**

* Manage plan templates and pricing tiers (no public checkout).
* Toggle feature flags globally or per tenant.
* Override feature set temporarily for testing or pilot customers.
* Maintain JSON diff history for each override.

### **4.3 Workflow Library**

* Create global workflow templates.
* Clone templates to tenants.
* Visual editor to add/remove stages and transitions.
* Versioning with rollback.

### **4.4 System Catalog Registry**

* Edit sys_* codes through admin UI (secured endpoints).
* Maintain translations (EN/AR).
* Lock critical codes against accidental edits.
* Push catalog updates to tenants.

### **4.5 Observability & Metrics Dashboard**

* Global KPI view: active tenants, orders processed, system latency.
* Real-time usage counters.
* Alert center (expired plans, storage overuse, missing payments).
* Integrates Grafana charts via API embed.

### **4.6 Audit & Compliance**

* Audit every field change: who, when, what.
* Periodic report generator (weekly digest of all HQ actions).
* Exportable JSON/CSV for audits.
* Encrypted PII masking for compliance logs.

---

## **5. Access Control & Security**

* **Zero public endpoints**: all behind authenticated Next.js + NestJS routes.
* **Internal VPN / IP whitelist**.
* **Action confirmation dialogs** for high-impact tasks.
* **Environment variable isolation** for production credentials.
* **Encrypted backups** auto-rotated daily.
* **Audit trails** immutable (append-only).

---

## **6. Automation & Maintenance**

| Job                      | Frequency | Responsibility                                |
| ------------------------ | --------- | --------------------------------------------- |
| `plan_enforcer_worker`   | hourly    | Verify feature limits for all tenants         |
| `catalog_sync_worker`    | daily     | Sync global sys_* changes                     |
| `billing_renewal_worker` | daily     | Process plan renewals (manual review allowed) |
| `usage_aggregator`       | hourly    | Aggregate tenant metrics                      |
| `alert_dispatcher`       | on-event  | Notify admins via email/Slack                 |

All jobs visible in **HQ Console → Automation → Jobs Monitor**.

---

## **7. Technical Governance**

* **Schema Evolution:** Managed via versioned SQL migrations, reviewed by technical admin.
* **Data Isolation:** RLS on tenant data, but HQ roles bypass via elevated context.
* **Audit Immutability:** Hash-chained `sys_audit_log` rows.
* **Monitoring:** Prometheus metrics, Grafana panels shared privately.
* **Testing:** HQ APIs covered by Jest integration tests; dummy tenants used for QA.

---

## **8. Developer Experience**

* Internal **API keys** for automation scripts (`saas_admin_key`).
* Local Docker stack mirrors production services.
* Automated environment seeding for dev/stage.
* Change logs auto-generated to `/docs/changelog/hq_saas_mng.md`.

---

## **9. Future Internal Enhancements**

1. **Admin AI Assistant:**

   * Natural-language queries like “show suspended tenants this week.”
   * “Suggest which tenants to upgrade based on usage.”

2. **Cross-Tenant Analytics:**

   * Identify regional usage patterns or high-load customers.

3. **Predictive Maintenance:**

   * Alert on tenants likely to exceed storage or processing limits.

4. **Internal Billing Integration:**

   * Sync HQ invoices with internal ERP (Ultimate Solutions).

5. **Ops Workflow Automation:**

   * Approvals, incident escalation, SLA tracking within HQ console.

---

## **10. Acceptance Criteria**

1. Only HQ users (Jehad/team) can access module via SSO.
2. Tenant management and plan assignment fully functional.
3. Workflows editable and deployable per tenant.
4. Catalog edits propagate successfully within 60s.
5. All changes visible in audit trail.
6. Metrics dashboard updates in real time.
7. Automation jobs run successfully and alert properly.
8. No sensitive data exposed to non-HQ users.

---

## **11. KPIs (Internal)**

| Metric                      | Target   |
| --------------------------- | -------- |
| Tenant setup time           | < 2 min  |
| Catalog sync latency        | < 1 min  |
| Workflow version deployment | < 30 sec |
| Alert response time         | < 5 min  |
| System uptime               | ≥ 99.9%  |
| Mean audit delay            | ≤ 5 sec  |

---

## **12. Deliverables**

| Artifact                         | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `hq_saas_mng_controller.ts`      | NestJS API for internal management |
| `hq_saas_admin_ui`               | Next.js console (admin dashboard)  |
| `sys_catalogs_editor.tsx`        | Catalog editing page               |
| `audit_viewer.tsx`               | Audit timeline component           |
| `metrics_dashboard.json`         | Grafana panel export               |
| `prd-saas-mng-001-internal.docx` | Final PRD Document                 |

---

Would you like me to now merge this **v1.6 Internal Edition** with the previous v1.5 (external SaaS-oriented) version — keeping internal governance focus but preserving all technical and architectural depth — and then produce the **final Word (.docx) version** for your documentation set?
