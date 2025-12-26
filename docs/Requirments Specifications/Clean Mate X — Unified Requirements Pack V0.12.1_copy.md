**CleanMateX - Unified Requirements Pack v0.12 (EN)**

_Status: OPEN (requirements not locked) • Target Region: GCC • Languages: English + Arabic (RTL)_

**Table of Contents**

- Vision & Scope
- KPIs & Success Criteria
- SRS - Software Requirements Specification
  - 3.1 Orders & Intake
  - 3.2 Workflow & Operations (Assembly → QA → Packing → Ready)
  - 3.3 Scheduling & Logistics
  - 3.4 Finance & Receipts
  - 3.5 Admin / Config
  - 3.6 Marketing & Engagement
  - 3.7 Marketplace, Reviews & Disputes
  - 3.8 Inventory, Supplier & Machines
  - 3.9 Analytics & Sustainability
  - 3.10 AI (Optional Modules)
  - 3.11 Integrations
- Non‑Functional Requirements (NFRs)
- Data Model (Entities)
- API Overview & Webhooks
- Use Cases (UC01-UC27)
- Operational Workflows
- Feature Details & Acceptance Criteria
- Policies & Configuration
- Notification Templates
- Security, Privacy & Compliance
- Test Strategy & UAT
- Roadmap & Release Slicing
- Traceability Matrix (RTM)
- Master Backlog (summary)
- RAID Log & Key Decisions
- Change Log (v0.12)
- Sign‑off (kept OPEN)

**1) Vision & Scope**

**Vision**: Mobile‑first, multi‑tenant SaaS for laundry & dry cleaning that minimizes errors, accelerates operations, and delights customers with digital experiences. EN/AR out of the box; light hardware footprint; in the future : friendly driver app.

**Scope (MVP → P1 → P2)**

- End‑to‑end workflow: Quick Drop/Intake → Preparation (itemize) → Sorting → Washing/Dry‑clean → Drying → Finishing → **Assembly → Final QA → Packing → Ready** → Out‑for‑Delivery/Pickup → Delivered/Collected → Post‑Delivery Issue‑to‑Solve → Closed.
- Omni‑channel intake (POS/App/WhatsApp). Driver POD (OTP/sign/photo). Live tracking.
- Finance: invoices, refunds/credit notes, B2B statements; receipts via WhatsApp/In‑App/PDF.
- Marketplace (listings, commission/escrow), Reviews & Disputes, optional Supplier Portal.
- Marketing: loyalty/referrals/memberships; Campaigns; Wallet & Family accounts.
- Ops: Inventory & Machines; HR/Attendance; Analytics; Sustainability metrics.
- Platform: Feature flags, multi‑gateway payments, observability, i18n/RTL, security & privacy.

**2) KPIs & Success Criteria**

| **Goal** | **KPI** | **Target** |
| --- | --- | --- |
| Counter speed | Intake→receipt median | < 5 minutes |
| Mixups | Assembly incident rate | < 0.5% |
| Delivery disputes | OTP POD adoption | ≥ 95% |
| Digital adoption | WA/In‑App/PDF receipt share | ≥ 80% |
| Reliability | API availability (core) | ≥ 99.9% |
| SLA | Ready‑By breaches | < 3% |

**3) SRS - Software Requirements Specification**

**3.0 Introduction**

**Purpose**: Define functional and non‑functional requirements for the MVP+ platform including Assembly gates, Marketplace, Reviews/Disputes, Supplier Portal, and platform services.  
**Users/Roles**: Customer (B2C/B2B), Counter/Operator, Assembly/QA/Packing, Driver, Finance, Admin, Marketing, Ops Manager, Supplier (optional), Moderator.

**3.1 Orders & Intake**

- **FR‑QD‑001 Quick Drop intake**: create order for unknown bag; capture photos; issue bag label; auto‑create **Preparation** task.  
    _AC_: After Preparation, order lines exist; Ready‑By calculated; labels printed; SLA started.
- **FR‑PRE‑001 Preparation itemization**: fast UI (bulk add, presets); per‑piece/service assignment; notes/stains.  
    _AC_: 10 items ≤ 3 minutes; accuracy ≥ 99% in UAT set.
- **FR‑SPL‑001 Split‑Suborder**: split selected pieces to child with linkage; merge before processing if allowed.  
    _AC_: Parent/child invoices can be merged/separate per policy; audit trail.
- **FR‑ISS‑001 Issue‑to‑Solve (pre/post)**: spawn quick‑solve or re‑process suborder; notify customer; SLA timers.  
    _AC_: Re‑process routes to correct stage; all actions auditable.
- Pricing/Promotions (**FR‑PRC‑001**): per‑piece/kg; discounts, vouchers, gift cards; taxes/VAT; price overrides with roles.

**3.2 Workflow & Operations**

- **Master Flow**: as in Scope (see Operational Workflows).
- **FR‑TRK‑001 Per‑piece scanning** at each transition; expected vs scanned; missing alerts; reports.
- **FR‑ASM‑001 Assembly**: completeness scan; exception types (missing/wrong/damage); locations (bins/racks) with capacity; packaging rules; bilingual packing list.  
    _Gate_: **Ready** requires Assembly 100% + QA pass.
- **FR‑QA‑001 Final QA**: pass/fail; photo on fail; rework loop.
- **FR‑PCK‑001 Packing**: apply packaging profile; attach packing list; mark **Ready**.
- **FR‑REL‑001 Partial release**: with consent; track outstanding items; invoice/release policy.
- Configurable workflows (guardrails), multi‑branch/franchise, offline tolerance.

**3.3 Scheduling & Logistics**

- **FR‑SCD‑001 Slots** with capacity calendar; recurring schedules; reschedule/cancel policies.
- **FR‑DRV‑001 Driver app**: route; pickup/delivery; **POD** via OTP/sign/photo; retries/conflicts handled.
- Live status & notifications; geofences; later: capacity‑aware dynamic slots (P2).

**3.4 Finance & Receipts**

- **FR‑INV‑001 Invoicing** at Ready/Delivery; multi‑tender; advance/partial payments.
- **FR‑RFD‑001 Refunds/Credit notes** with approvals; reversal docs; audit.
- **FR‑RCT‑001 Receipts** via WhatsApp text/image & In‑App; PDF (plan‑gated); optional print.
- **FR‑B2B‑001 Statements & consolidation**; **FR‑B2B‑002 Credit control & dunning**; PO/cost centers.
- Cash hand‑in reconciliation; multi‑currency; GCC VAT; **Accounting sync** CSV→API.

**3.5 Admin / Config**

- Policies (scan enforcement, partial release, Ready‑By); catalogs (services, price lists, priorities, issues/solutions).
- Users/Roles **(RBAC)**; **feature flags** per plan; audit logs; data exports; branding per tenant.

**3.6 Marketing & Engagement**

- **FR‑LOY‑001 Referrals**; **FR‑LOY‑002 Loyalty points/tiers**; **FR‑SUB‑001 Memberships** (benefits, renewals, proration).
- **FR‑CMP‑001 Campaign manager**: segmentation, coupons/vouchers, uplift.
- **FR‑WLT‑001 Wallet** & **FR‑FAM‑001 Family accounts** with limits/approvals.

**3.7 Marketplace, Reviews & Disputes**

- **FR‑MKT‑001 Marketplace listings** per tenant; branding; photos; **commission/escrow**.
- **FR‑MKT‑003 Dynamic slot pricing**; **eco badges**; **cross‑sell** add‑ons.
- **FR‑CX‑REV‑001 Verified reviews**; moderation queue (approve/hide/report).
- **FR‑DSP‑001 Dispute Center**: categories, evidence, SLAs, outcomes (refund/voucher/re‑process); audit.

**3.8 Inventory, Supplier & Machines**

- **FR‑INV‑101 Consumables** thresholds; supplier records; cost per order; re‑order suggestion.
- **FR‑SUP‑001 Supplier Portal (optional)**: POs, mark shipped, upload invoice & delivery note.
- **FR‑MCH‑101 Machines**: usage counters; maintenance reminders/logs; downtime analytics.

**3.9 Analytics & Sustainability**

- **FR‑ANL‑001 Revenue heatmap**; SLA dashboards; cohorts/segments; benchmarking.
- **FR‑SUS‑001 Sustainability metrics** (water/energy estimates); eco badges; packaging options.

**3.10 AI (Optional)**

- Pricing estimator; vision QA; routing ETA; predictive maintenance; churn/loyalty-**assistive** (non‑blocking), explainable, feedback‑capture.

**3.11 Integrations**

- Payment gateways (plugin architecture); WhatsApp Business; multi‑provider SMS/Email fallbacks; accounting (CSV→API); maps/traffic.

**4) Non‑Functional Requirements (NFRs)**

- **NFR‑SEC‑001 Security**: RLS per tenant; RBAC; TLS; encryption‑at‑rest; secrets mgmt; signed webhooks; idempotency; audit logs.
- **NFR‑PERF‑001 Performance**: p50 < 300ms / p95 < 800ms core reads; async heavy ops; capacity tests.
- **NFR‑AVL‑001 Availability**: ≥ 99.9% core APIs; graceful degradation; offline queues.
- **NFR‑SCL‑001 Scalability**: stateless APIs; Postgres + replicas; Redis queues; partitioning strategy.
- **NFR‑I18N‑001 i18n/RTL**: EN/AR UI; localized PDFs; bidi correctness.
- **NFR‑PRV‑001 Privacy/Compliance**: consent logs; data portability/deletion; VAT invariants; residency when needed.
- **NFR‑OBS‑001 Observability**: OpenTelemetry traces/metrics/logs; dashboards; SLO alerting.
- **NFR‑LDS‑001 Load/Stress**: k6 suite; baseline per release; backpressure/failover drills.

**5) Data Model (Entities)**

Tenant, User, Customer (B2C/B2B), Contract, Order, OrderItem, WorkflowState, AssemblyTask, AssemblyItem, AssemblyException, **AssemblyLocation**, PackingList, Issue, IssueSolution, Invoice, Payment, Statement, Route, POD, LoyaltyProgram, Membership, WalletAccount, WalletTransaction, FamilyLink, InventoryItem, Supplier, Machine, MaintenanceLog, Campaign, Voucher, **Review**, **Dispute**, **MarketplaceListing**, **Commission**, AnalyticsAggregate, SustainabilityMetric, RoutingRule, IntegrationProvider.

**6) API Overview & Webhooks (selected)**

**Endpoints**:  
POST /v1/orders · POST /v1/orders/{id}/split · POST /v1/orders/{id}/issue-to-solve · POST /v1/orders/{id}/items · POST /v1/orders/{id}/transition · POST /v1/assembly/{id}/scan · POST /v1/qa/{id}/decision · POST /v1/packing/{id}/complete · POST /v1/delivery/{id}/pod · POST /v1/invoices · POST /v1/payments · POST /v1/loyalty/earn · POST /v1/loyalty/redeem · POST /v1/memberships · POST /v1/wallet/topup · POST /v1/campaigns · POST /v1/inventory/consume · POST /v1/machines/{id}/maintenance · POST /v1/marketplace/listings · POST /v1/reviews · POST /v1/disputes.

**Webhooks**: order.updated, order.ready, order.delivered, invoice.issued, loyalty.updated, membership.updated, dispute.updated, review.moderated.

**7) Use Cases (UC01-UC27)**

- **UC01** Quick Drop Intake & Preparation
- **UC02** Split‑Suborder
- **UC03** Issue‑to‑Solve (Pre/Post)
- **UC04** Per‑Piece Scan
- **UC05** Assembly Completeness → **UC06** Final QA → **UC07** Packing & Ready
- **UC08** Delivery POD
- **UC09** Invoicing & Receipts
- **UC10** Admin Config
- **UC11** Loyalty & Memberships
- **UC12** Wallet & Family
- **UC13** Inventory & Machines
- **UC14** B2B Contract Billing
- **UC15** Campaigns & Promotions
- **UC16** Analytics & Heatmap
- **UC17** Payments & Integrations
- **UC18** HR & Attendance
- **UC19** White‑label / Franchise
- **UC20** Voice/WhatsApp Ordering
- **UC21** Sustainability Metrics
- **UC22** Advanced Routing
- **UC23** Marketplace Listing
- **UC24** Marketplace Order (commission/escrow)
- **UC25** Review & Moderation
- **UC26** Dispute Management
- **UC27** Supplier PO Fulfillment

**8) Operational Workflows (high‑fidelity)**

**Preparation**: convert Quick Drop → itemize → assign services → set Ready‑By → print labels (defer unknowns with reason).  
**Assembly**: scan expected vs scanned; handle exceptions; pick packaging; generate EN/AR packing list; hand‑off to QA.  
**QA & Packing**: QA pass/fail (rework on fail) → pack by rules → mark Ready (gates enforced).  
**Delivery/Pickup**: route assignment; POD (OTP/sign/photo); retries; customer updates.  
**Post‑Delivery Issue‑to‑Solve**: log issue; Quick Solve or Re‑process; notify; SLA tracked.

**9) Feature Details & Acceptance Criteria (selected highlights)**

- **Quick Drop & Preparation**: AC-after Preparation, order lines present; SLA started; labels printed; photo optional.
- **Split / Issue‑to‑Solve**: AC-linkage intact; finance preview for merged/separate billing; audit trail.
- **Per‑Piece Tracking & Assembly**: AC-100% scan before Ready; packing list totals=order totals; exceptions documented with outcomes.
- **Scheduling/Logistics**: AC-OTP required unless policy override; retries; conflict resolution logged.
- **Finance & Receipts**: AC-receipts archived; refund/credit approvals; B2B statements; shift reconciliation.
- **Marketplace/Reviews/Disputes**: AC-commission breakdown visible; slot multipliers tooltips; verified‑only reviews; dispute SLA timers.
- **Inventory & Machines**: AC-threshold alerts; maintenance reminders; downtime analytics.
- **Analytics & Sustainability**: AC-heatmap correctness on sample dataset; eco badge rules documented.
- **AI**: AC-hints non‑blocking; operator feedback captured; guardrails for explainability.

**10) Policies & Configuration**

Scan enforcement (default **on** for High/Urgent & B2B), partial release rules, Ready‑By defaults per service/priority, notification templates (EN/AR), channel toggles, quiet hours, data retention/export, security posture, per‑branch working hours & blackout dates.

**11) Notification Templates (variables)**

Order Created, Preparation Needed, Assembly Exception, Ready for Pickup/Delivery, Out for Delivery (includes {otpCode}), Delivered/Collected, Issue‑to‑Solve Created, Loyalty Updated.

**12) Security, Privacy & Compliance**

RLS, RBAC, TLS, encryption‑at‑rest, secret rotation, audit trails, minimal PII in logs, consent logging, VAT archiving, potential data residency, signed webhooks, idempotent APIs.

**13) Test Strategy & UAT**

Unit, API contracts, E2E in CI, manual UAT per UC. Key scenarios: full E2E (Quick Drop→Ready→OTP POD), Assembly exception→rework, Split & Issue‑to‑Solve pre/post, Refund/Statement, Wallet/Loyalty/Membership, Marketplace order→review→dispute.

**14) Roadmap & Release Slicing**

- **MVP**: core workflow + Assembly/QA/Pack gates + OTP POD + receipts + observability baseline.
- **P1**: B2B (statements/credit), Marketplace listings, Reviews/Disputes, capacity calendar, inventory basics, dynamic workflow builder, multi‑gateway, campaigns, heatmap.
- **P2**: AI (pricing/vision/routing/predictive), segmentation/benchmarking, accounting API, voice/WA ordering, sustainability badges.
- **Enterprise**: white‑label/franchise tooling, partner integrations.

**15) Traceability Matrix (sample rows)**

| **ID** | **Requirement** | **UC** | **Test Ref** |
| --- | --- | --- | --- |
| FR‑QD‑001 | Quick Drop intake | UC01 | T‑QD‑001 |
| FR‑ASM‑001 | Assembly completeness | UC05 | T‑ASM‑001 |
| FR‑PCK‑001 | Packing & Ready gate | UC07 | T‑PCK‑001 |
| FR‑DRV‑001 | Driver OTP POD | UC08 | T‑DRV‑001 |
| FR‑MKT‑001 | Marketplace listings | UC23 | T‑MKT‑001 |
| FR‑DSP‑001 | Dispute management | UC26 | T‑DSP‑001 |

_(Complete RTM provided in Excel v0.12; mirrored in Backlog IDs.)_

**16) Master Backlog (summary)**

Must (MVP): Quick Drop, Preparation, Split, Issue‑to‑Solve, Per‑piece scan, Assembly, QA, Packing, OTP POD, Receipts, Policies/Flags, Observability baseline.  
Should (P1): Statements/Credit, Marketplace listings, Reviews, Disputes, Capacity calendar, Inventory basics, Dynamic workflow, Multi‑gateway, Campaigns, Heatmap.  
Could (P2): Family accounts, Accounting API, Voice/WA ordering, Sustainability badges, predictive maintenance, advanced routing.

**17) RAID Log & Key Decisions**

**Risks**: label/scanner mismatch; WhatsApp onboarding; credit control disputes.  
**Assumptions**: RTL acceptable across devices.  
**Dependencies**: payment gateways.  
**Decisions**: OTP default for POD; digital receipts default; CSV‑first for accounting; plugin gateways; requirements kept OPEN.

**18) Change Log (v0.12)**

Consolidated v0.9 open + v0.11 + Marketplace/Reviews/Disputes/Supplier/Monitoring. Aligned Assembly wording & gates; added partial release & locations; expanded NFRs for observability & load/stress; updated UAT scenarios.

**19) Sign‑off (OPEN)**

| **Name** | **Role** | **Signature** | **Date** |
| --- | --- | --- | --- |
| Jehad Almekhlafi | Product Owner / Founder |     |     |
| Stakeholder | -   |     |     |

**Addendum v0.12.1 - Integrated from Newly Uploaded Docs (Tech Stack, Invoicing/Receipts, Customer Model, Market Segments)**

**A) Technical Stack (Refined)**

- **Mobile**: Flutter (Customer/Driver), push via FCM; offline queue; AR/EN RTL; Crashlytics.
- **Web Admin**: Next.js (React+TS), Tailwind, i18next for i18n.
- **Backend**: NestJS (REST/OpenAPI), Redis/BullMQ for jobs, idempotency; Prisma ORM; feature flags per tenant.
- **DB**: PostgreSQL 16 with **RLS per tenant**, partitions, JSONB; PITR backups.
- **Integrations**: GCC payment gateways (HyperPay, PayTabs, Stripe), WhatsApp Business API, SMS, Google Maps.
- **Infra/DevOps**: Kubernetes (EKS), Terraform, Helm, GitHub Actions CI/CD; Prometheus, Grafana, Sentry; OpenTelemetry tracing.
- **Performance/SLOs**: p50<300ms, p95<800ms; orders search <1s @100k; availability 99.9%.

**B) Invoicing & Receipt Strategy (Dual‑Level Control)**

**Delivery Channels**

- **PDF (EN/AR)** via WA/Email/App; printable (A4/thermal).
- **WhatsApp Text + Branded Image** (with QR).
- **In‑App Digital Receipt** (download as PDF/image).
- **Printed Receipt** (optional; on demand).

**Dual‑Level Configuration Model**

- _System Admin (CleanMateX HQ)_: Plan‑based **feature flags** (e.g., pdf_invoices, whatsapp_text_image, in_app_receipts, printing, b2b_contracts, white_label).
- _Laundry Admin (Tenant)_: Per‑tenant **settings** (default channel, rules by customer type B2C/B2B, fallback channel, branding).

**Customer‑Type Mapping**  
Guest → WhatsApp text/image; Stub → WA/SMS link (image/PDF); Full App User → in‑app receipt (+optional WA); B2B → formal PDF (+optional print).

**C) Customer Model (Progressive Engagement)**

- **Guest** (no phone/app) → barcode receipt only.
- **Stub Profile** (first name + phone at POS) → WA/SMS link + web tracking → upgrade path to app.
- **Full Profile** (OTP) → loyalty, promotions, marketplace; tenant memberships; preferences (fold/hang, fragrance, eco).  
    **Storage**: Global identity (users/{uid}); Tenant profile (tenants/{tenantId}/profiles/{uid}); B2B contracts; temporary walk‑in on orders.

**D) Market Segments Alignment**

- **Traditional Small**: mobile‑first POS; WA receipts; no printer required; pay‑as‑you‑go viable.
- **SMEs**: delivery + loyalty; driver app; basic analytics; subscription tiers (Starter/Pro/Pro Plus/Enterprise).
- **Large Chains/Franchise**: enterprise features (B2B, SLAs, ERP/Accounting API), white‑label; centralized reporting.  
    **Marketplace**: cross‑segment growth (commission, sponsored placement, eco/express badges).

**E) Backlog & RTM Deltas (appended)**

- **FR‑INV‑002 Dual‑Level Feature Flags** (System vs Tenant) → Admin/Platform; **Must/P1**.
- **FR‑RCT‑002 Channel Rules by Customer Type** → Finance; **Should/P1**.
- **FR‑CST‑001 Progressive Engagement** (Guest→Stub→Full) → Customers; **Must/MVP**.
- **FR‑CST‑002 Invite/Deep‑Link Onboarding** → Customers; **Should/P1**.
- **NFR‑OBS‑002 Crash/Error Monitoring** (Sentry/Crashlytics) → Platform; **Must/MVP**.

