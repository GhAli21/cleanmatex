Got it. Since this is **HQ-only** and you want it to be your “master SaaS governance spec,” we can (and should) make v1.8 cover *everything you’ll probably need in the next 12–18 months* — not just tenants/plans/workflows.

Here’s the **expanded v1.8 Deep Specification outline** with the extra areas added. I’ll keep it in a clean, developer-friendly structure so you can drop sections into Cursor or your repo docs.

---

# **PRD-SAAS-MNG-001 – CleanMateX HQ SaaS Platform Management**

### v1.8 – Deep Developer Specification (Outline)

## 0. Document Metadata

* ID: PRD-SAAS-MNG-001
* Name: CleanMateX HQ SaaS Platform Management
* Version: **1.8 (Deep Spec)**
* Status: Initial Draft
* Audience: Platform/HQ team (you + your team only)
* Format: Developer spec, text diagrams
* Source Docs: v1.7 PRD, `CleanMateX_Workflow_NewOrder_ImplementationPlan.docx`, `master_plan_cc_01.md`, `CleanMateX_Architecture_Decision_and_Strategy_01.md`

---

## 1. System Context (Expanded)

1.1 HQ Platform Layer vs Tenant Business Layer
1.2 Public vs Internal APIs
1.3 Tenant Context Propagation (`x-tenant-id`, `app.current_tenant_id`)
1.4 Supabase/NestJS dual access pattern
1.5 “HQ Namespace” (sys_*, admin-only routes, elevated RLS bypass)
1.6 Trust boundaries (HQ → worker, HQ → storage, HQ → gateway)

---

## 2. Tenant Lifecycle (Technical Sequences)

2.1 Create Tenant (HQ)
2.2 Approve & Activate
2.3 Auto-seed: workflows, catalogs, preferences, payment methods
2.4 Attach plan & feature set
2.5 Suspend / Freeze / Grace Period
2.6 Archive & Partial Delete
2.7 Reactivate (with delta re-seed)
2.8 Tenant impersonation (for support)

---

## 3. Subscription & Plan Engine (Deep)

3.1 Data model (sys_plan_subscriptions_types_cf, sys_plan_features_cf, sys_plan_limits_cf, org_subscriptions_mst)
3.2 Effective Feature Set = Plan ∪ TenantOverrides − Revoked
3.3 Limit Types:

* hard limits (block)
* soft limits (warn)
* billable overage (record + notify)
  3.4 Plan change rules (upgrade, downgrade, lateral)
  3.5 Grace periods, trial periods
  3.6 Dunning scenarios (failed payment → warned → suspended)
  3.7 Plan audit log structure

---

## 4. Workflow Engine – Runtime Mechanics

4.1 Global template store (`workflow_template_cd`, `workflow_template_stages`, `workflow_template_transitions`)
4.2 Tenant-scoped workflow config (`tenant_workflow_templates_cf`, `tenant_workflow_settings_cf`)
4.3 Per-service-category override
4.4 Transition service (DB function vs NestJS service)
4.5 Versioning: template v1 → v2 → tenant patch
4.6 Guards (requires_invoice, requires_pod, requires_scan_ok)
4.7 Error handling (illegal transition, missing stage, inactive template)
4.8 Audit of transitions

---

## 5. Catalog Registry Synchronization

5.1 Catalog families:

* services (DRY_CLEAN, LAUNDRY, IRON_ONLY, REPAIRS, ALTERATION)
* fabrics
* item types
* stains
* preferences
* payment
* org types
* priorities, colors, icons
  5.2 Versioned sync (HQ → tenants)
  5.3 Change detection: `updated_at`, `version_no`, `hash`
  5.4 Bulk import (CSV/JSON)
  5.5 Fallback & rollback
  5.6 Multilingual fields (name/name2)
  5.7 Tenant-side “shadow catalogs” (when tenant wants local labels)

---

## 6. Feature Flags – Runtime Enforcement

6.1 JSONB structure (per tenant)
6.2 NestJS guard pattern:

```ts
@UseGuards(FeatureFlagGuard)
@FeatureFlag('pdf_invoices')
```

6.3 Cache strategy (Redis)
6.4 Invalidation (when plan changes)
6.5 Flag precedence (tenant > plan > global default)
6.6 Logging and testing (unit tests for guards)

---

## 7. Automation & Worker Architecture

7.1 BullMQ queues (`saas-core`, `billing`, `catalog-sync`, `alerts`)
7.2 Job payloads (tenant_id, job_type, context)
7.3 Retry/backoff/dead-letter queues
7.4 Idempotency for billing and seeding
7.5 Scheduled jobs (CRON-like): renewals, expiry, usage aggregation
7.6 Worker observability (dashboard, metrics per queue)

---

## 8. Observability & SLO Enforcement

8.1 NestJS interceptors → OTel traces
8.2 Metrics:

* saas_active_tenants
* saas_plan_distribution
* saas_limit_breaches_total
* saas_catalog_sync_errors_total
  8.3 Traces with tenant dimension
  8.4 Alert rules (Prometheus): high error rate, failed jobs, slow DB
  8.5 Audit correlation: `trace_id` in `sys_audit_log`
  8.6 SLO policy (p50<300ms, p95<800ms, 99.9% availability)

---

## 9. Security, RLS & Governance

9.1 RLS baseline: all org_* tables RLS ON
9.2 HQ bypass via SECURITY DEFINER (only from backend)
9.3 Per-tenant key/secret storage (for payment gateways)
9.4 PII encryption (pgcrypto)
9.5 Audit immutability (hash-chain of audit rows)
9.6 IP allowlist / VPN for HQ console
9.7 Role matrix (super_admin, tech_admin, biz_admin, auditor, support_readonly)

---

## 10. AI / Automation Layer

10.1 AI services as *advisors*, not *enforcers*
10.2 AI: Plan Recommender

* input: usage, limit hits, industry, branches
* output: recommended_plan, confidence, rationale
  10.3 AI: Workflow Optimizer
* input: order transition logs
* output: “your intake→processing is slow, enable preparation screen”
  10.4 AI: Tenant Risk Detector
* input: unpaid invoices, low usage, many errors
* output: “at-risk”
  10.5 Human-in-the-loop approval (HQ must click Apply)
  10.6 Audit of AI decisions

---

## 11. CI/CD & Schema Control

11.1 Migration naming: `0001_saas_core.sql`, `0002_sys_catalogs.sql`, …
11.2 Pre-merge checks (lint, tests, migration dry run)
11.3 Environment promotion (dev → stage → prod-hq)
11.4 Seed runners (idempotent, environment-aware)
11.5 Breaking change policy (sys_* must be backward compatible)
11.6 Docs generator (OpenAPI → Markdown → Next.js admin docs route)

---

## 12. Deployment & Ops

12.1 Local stack (Docker: Postgres, Redis, MinIO, NestJS, Next.js)
12.2 Staging stack (with mock gateways)
12.3 Production stack (K8s, Helm, Terraform)
12.4 Backups & PITR (Postgres 16)
12.5 Incident runbook (tenant locked, catalog broken, billing failed)
12.6 Rollback strategy per migration

---

## 13. **NEW AREA** – Licensing & Entitlements (Internal)

13.1 Internal licensing model (you control all)
13.2 Entitlement object per tenant:

```json
{
  "plan": "pro",
  "modules": ["orders","invoicing","workflow","delivery"],
  "add_ons": ["whatsapp_receipt","pdf_invoices"],
  "max_users": 15,
  "max_branches": 3
}
```

13.3 Add-on licensing (extra POS, extra branch, extra delivery route)
13.4 Entitlement checks in UI (hide/show)
13.5 Reporting: “who is using what?”

---

## 14. **NEW AREA** – Tenant/Org Customization Layer

14.1 Theme/branding config per tenant (logo, colors, invoice header)
14.2 Localization per tenant (default lang = ar, fallback = en)
14.3 Pricing profile per tenant (later)
14.4 Custom workflow per service category
14.5 Storage of tenant config in JSONB with schema validation
14.6 Safe upgrades (HQ changes global template → tenant overrides stay)

---

## 15. **NEW AREA** – Data Residency & Multi-Region (GCC Focus)

15.1 Region tags on tenant (`region: GCC-OM`, `GCC-SA`, `EU`)
15.2 Routing rules (tenant in GCC → use GCC DB cluster)
15.3 Storage placement (MinIO/S3 region-based buckets)
15.4 Cross-region catalog sync
15.5 Legal/compliance note (Oman, KSA, UAE data locality)
15.6 Future: per-region billing currency

---

## 16. **NEW AREA** – Backup, BCDR, and Tenant-Level Restore

16.1 Periodic full DB backups (cluster-level)
16.2 Tenant-scoped exports (org_* filtered by tenant_org_id)
16.3 Disaster recovery drill steps
16.4 Restore tenant to point-in-time
16.5 “Quarantine mode” for compromised tenant
16.6 Retention policy (30/60/90 days)

---

## 17. **NEW AREA** – Import / Export & Onboarding Tooling

17.1 Import customers, items, catalog from Excel/CSV
17.2 Mapping templates (source column → sys_* code)
17.3 Validation rules (duplicate phone, missing category)
17.4 Export for ERP/accounting
17.5 Onboarding wizard for new tenant (calls seeding APIs)
17.6 Progress tracker + logs for onboarding

---

## 18. **NEW AREA** – Developer & Integration Portal (Internal)

18.1 API key management for integrations
18.2 Webhook registry per tenant
18.3 Event types (`tenant.plan.changed`, `order.ready`, `invoice.created`)
18.4 Signed webhooks (secret, timestamp, signature)
18.5 Replay protection
18.6 Integration health page (last delivery, last error)

---

## 19. **NEW AREA** – Support & Impersonation

19.1 Secure impersonation token (short-lived)
19.2 Audit “who impersonated whom and when”
19.3 Read-only impersonation vs full impersonation
19.4 Capture console errors from tenant side
19.5 Link to logs (Sentry) from HQ console

---

## 20. **NEW AREA** – Performance & Load Guardrails

20.1 Targets: search <1s @ 100k orders, p95<800ms
20.2 Query patterns (composite keys, indexes, partitions)
20.3 Rate limiting per tenant
20.4 Throttling high-volume tenants
20.5 Caching strategies (catalogs, plans, features)
20.6 k6 scenarios for SaaS admin APIs

---

## 21. **NEW AREA** – Testing & QA Matrix

21.1 Unit tests for: feature flags, RLS policies, workflow transitions
21.2 Integration tests for: tenant creation, plan change, catalog sync
21.3 E2E tests (Playwright) for HQ console flows
21.4 Security tests (SQL injection, privilege escalation)
21.5 Regression packs for sys_* changes
21.6 Device/RTL testing for admin AR pages (later)

---

## 22. **NEW AREA** – Reporting, Analytics, and Billing Insights

22.1 SaaS HQ dashboard KPIs:

* active tenants
* ARPU
* churned/suspended
* feature adoption
  22.2 Tenant-level ops reports (orders/day, invoices/day)
  22.3 Cost-to-serve per tenant (approx)
  22.4 Upgrade suggestion reports
  22.5 Export to BI / external dashboards

---

## 23. **NEW AREA** – Compliance & Policy Management

23.1 Data retention per tenant type
23.2 PII export & delete requests
23.3 Audit evidence export
23.4 Policy versioning (what policy was active when tenant was created)
23.5 Terms / SLA acknowledgement tracking

---

If this looks good, I’ll start **filling in the first 4–5 sections (1 → 5) in full detail** right away, using the exact stack you chose (NestJS + Prisma + Postgres 16 + Redis/BullMQ + Next.js + i18n + RLS). I won’t ask again — I’ll just write them in full.
