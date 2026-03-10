# Plan CR Reconciliation Map

This file maps legacy planning material in `docs/plan_cr/` to the approved planning authority in `docs/plan/`.

## Reading Rule

- `docs/plan/` is the approved planning authority
- `docs/plan_cr/` is secondary backlog, comparison, or historical planning material
- do not match files by PRD number alone because numbering collides between the two planning systems

## Important Numbering Collision Note

Examples of collisions:

- `docs/plan/master_plan_cc_01.md` uses `PRD-015` for reporting and analytics, while `docs/plan_cr/015_web_admin_layout_navigation_dev_prd.md` uses `015` for web-admin layout and navigation
- `docs/plan/master_plan_cc_01.md` uses `PRD-023` for bilingual support, while `docs/plan_cr/023_backend_orders_api_dev_prd.md` uses `023` for backend orders API
- `docs/plan/master_plan_cc_01.md` uses `PRD-042` for wallet system, while `docs/plan_cr/042_analytics_reporting_engine_dev_prd.md` uses `042` for analytics

Always reconcile by topic, not by number.

## Current Topic Mapping

### Master plan

- approved: `master_plan_cc_01.md`
- legacy overlap: `../plan_cr/master_plan_cc_01.md`
- current rule: use the `docs/plan/` copy first

### Phase 2 enhanced operations

- approved: `files/Phase_2_Enhanced_Operations_Overview.md`
- overlapping secondary drafts:
  - `../plan_cr/007_catalog_service_management_dev_prd.md`
  - `../plan_cr/012_assembly_qa_packing_dev_prd.md`
  - `../plan_cr/013_invoicing_payments_dev_prd.md`
  - `../plan_cr/014_delivery_logistics_dev_prd.md`
  - `../plan_cr/042_analytics_reporting_engine_dev_prd.md`
- current rule: the approved Phase 2 overview wins; use `plan_cr` files only for extra detail mining

### Bilingual support

- approved: `files/PRD_023_Bilingual_Support_Implementation_Plan.md`
- overlapping secondary draft: `../plan_cr/050_shared_i18n_package_dev_prd.md`
- current rule: keep the `docs/plan/` file authoritative because the `plan_cr` draft reflects older package assumptions

### MVP foundation and early operations

- approved anchor docs:
  - `master_plan_cc_01.md`
  - `PRD-004_QUICK_START.md`
- overlapping secondary drafts:
  - `../plan_cr/003_authentication_authorization_dev_prd.md`
  - `../plan_cr/004_multi_tenancy_core_dev_prd.md`
  - `../plan_cr/006_customer_management_dev_prd.md`
  - `../plan_cr/008_order_intake_quick_drop_dev_prd.md`
  - `../plan_cr/010_order_workflow_engine_dev_prd.md`
- current rule: use the approved plan set first; mine `plan_cr` only for extra implementation detail

## Leave As Secondary Reference

These files are still useful as secondary planning/backlog material and should not be promoted automatically:

- `../plan_cr/create-development-plans.plan.md`
- `../plan_cr/021_backend_architecture_setup_dev_prd.md`
- `../plan_cr/027_customer_app_architecture_dev_prd.md`
- `../plan_cr/032_driver_app_architecture_dev_prd.md`
- `../plan_cr/049_shared_types_package_dev_prd.md`
- `../plan_cr/050_shared_i18n_package_dev_prd.md`
- `../plan_cr/051_shared_utils_package_dev_prd.md`
- `../plan_cr/053_testing_strategy_implementation_dev_prd.md`
- `../plan_cr/054_observability_monitoring_dev_prd.md`
- `../plan_cr/055_security_hardening_dev_prd.md`
- `../plan_cr/056_performance_optimization_dev_prd.md`
- `../plan_cr/057_deployment_infrastructure_dev_prd.md`
- `../plan_cr/058_documentation_training_dev_prd.md`

## Safe Maintenance Rule

- add mappings here before demoting or reorganizing major `plan_cr` files
- do not rename, merge, or delete `plan_cr` files by PRD number alone
