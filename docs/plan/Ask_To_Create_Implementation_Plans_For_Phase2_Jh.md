
Create comprehensive, full, smart, perfect implementation plans for each PRD/Feature in Phase 2 - Enhanced Operations PRDs, Consider This:
- move 33. **Staff Management** (PRD-033) from Phase 5 to Phase 2.
- move 23. **Bilingual Support (EN/AR)** (PRD-023) from Phase 3 to Phase 2.
- 

---
PRD-SAAS-MNG-001 — CleanMateX HQ SaaS Platform Management:
Create features/PRDs related to the SAAS platform management name them start from PRD-SAAS-MNG-001 that contains a Combine All features/PRDs related to the SAAS platform management features, such as and not limited to this list:
- Its an “Internal SaaS HQ Console” model rather than a public self-serve system.
- Will be used and managed by me and our team, so the users will be me and our team. 

- Tenant onboarding workflow.
- Create Tenant onboarding workflow details.
- creating tenant/organizations.
- managing plans and subscriptions, features flags/limits... so on.
- assign plans/approve/modify/activate/stopping subscriptions.
- Workflow engine management with Workflow state transitions, such as Create/enable/disable default Workflow configuration/settings templates types.
- Managing Global Customers (shared identity across tenants) Master Customers Data, sys_customers_mst..., such as how to manage getting and updating global customer dad from org_customers_mst when creating customers is by each tenant?
- Catalog Management Coding part, such as:
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

---

Workflow engine management with Workflow state transitions:
Create Workflow configuration/settings templates types:
1- Simple workflow (intake → ready → delivered).
2- 
3- 
4- 
5- 

Status transitions: intake → processing → ready → delivered.

---

Tenant onboarding workflow:
Create Tenant onboarding workflow details.

---

