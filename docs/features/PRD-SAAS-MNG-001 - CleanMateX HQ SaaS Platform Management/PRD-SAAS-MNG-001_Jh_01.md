
- Automation & Worker Architecture
- Observability & SLO Enforcement
- Security, RLS & Governance
- AI / Automation Layer
- CI/CD & Schema Control
- Deployment & Ops
- Licensing & Entitlements (Internal)
- Tenant/Org Customization Layer
- Data Residency & Multi-Region (Initialy GCC Focus and international ability)
- Backup, BCDR, and Tenant-Level Restore
- Import / Export & Onboarding Tooling
- Developer & Integration Portal (Internal)
- Support & Impersonation
- Performance & Load Guardrails
- Testing & QA Matrix
- Reporting, Analytics, and Billing Insights
- Compliance & Policy Management

platform console

Decision 1: Separate Application. Yes

---

You are experienced professional SAAS Solutions architect and SAAS platform management solution architect.

Create features/PRDs related to the SAAS platform management name them start from PRD-SAAS-MNG-00xx that contains a Combine All features/PRDs related to the SAAS platform management features, such as and not limited to this list:
PRD-SAAS-MNG-00xx — CleanMateX HQ SaaS Platform Management:
Evaluate this and put your suggestions: 
- Its an “Internal SaaS HQ Console” model rather than a public self-serve system.
- Will be used and managed by me and our team, so the users will be me and our team. 
- Should be standalone module, with separate login, dashboard, .... so on.
- Manage Tenant Lifecycle, such as creating tenant/organizations, fill initial/default data, plans, subscriptions, ..so on.
- managing plans and subscriptions, features flags/limits... so on.
- assign plans/approve/modify/activate/stopping subscriptions.
- Workflow engine management with Workflow state transitions, such as Create/enable/disable default Workflow configuration/settings templates types.
- Managing Customers Data: Global And Tenant/organizations Customers (shared identity across tenants) Master Customers Data, sys_customers_mst. AND tenant/organizations Customers and how to manage this two layers.
- Auth system , manging users, rols, ... so on.
- Automation & Worker Architecture
- Observability & SLO Enforcement
- Security, RLS & Governance
- AI / Automation Layer
- CI/CD & Schema Control
- Deployment & Ops
- Licensing & Entitlements (Internal)
- Tenant/Org Customization Layer
- Data Residency & Multi-Region (Initialy GCC Focus and international ability)
- Backup, BCDR, and Tenant-Level Restore
- Import / Export & Onboarding Tooling
- Developer & Integration Portal (Internal)
- Support & Impersonation
- Performance & Load Guardrails
- Testing & QA Matrix
- Reporting, Analytics, and Billing Insights
- Compliance & Policy Management
- Core Data Management, default seeds, initial, default data, such as Service Catalog Management Coding part, such as:
	- Service categories codes, sys_service_category_cd, ALL Main Services Categories/Sections FIXED BY us:DRY_CLEAN, LAUNDRY, IRON_ONLY, REPAIRS, ALTERATION
	- sys_service_type_cd, 
	- sys_item_fabric_type_cd.
	- sys_item_type_cd.
	- default products/items codes, sys_products_init_data_mst
	- sys_item_notes_ctg_cd, sys_item_notes_cd.
	- sys_item_stain_type_cd.
	- sys_preference_ctg_cd, sys_preference_options_cd
	- sys_plan_subscriptions_types_cf, ALL Plans in the system: freemium, basic, pro, plus, enterprise
	- sys_plan_limits_cd, sys_features_code_cd, sys_plan_features_cf, sys_plan_limits_cf, 
	- sys_workflow_template_cd, Template definitions (WF_STANDARD, WF_ASSEMBLY_QA, etc.)
	- sys_workflow_template_stages, Stages per template with sequence,
	- sys_workflow_template_transitions for Allowed transitions with rules
	- default currencies, sys_currency_cd.
	- sys_customer_type_cd
	- sys_color_cd
	- sys_icons_cd
	- sys_priority_cd
	- sys_user_type_cd
	- sys_product_unit_cd, Measurement Units
	- sys_invoice_type_cd
	- sys_order_status_cd
	- sys_org_type_cd, tenant/organizations types
	- sys_payment_method_cd, ALL payment_methods in the system: Pay on collect, cash, card, paymet gateways...
	- sys_payment_type_cd, Payment type such as: Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup
- and so on, All related to the SAAS platform management.

