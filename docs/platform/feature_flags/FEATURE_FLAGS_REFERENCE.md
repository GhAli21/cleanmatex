---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Feature Flags Reference

Global feature flag definitions and plan mappings.

**Source:** `hq_ff_feature_flags_mst`, `sys_ff_pln_flag_mappings_dtl`, migrations 0062, 0066, 0067, 0140

## Tables

| Table | Purpose |
|------|---------|
| hq_ff_feature_flags_mst | Global flag definitions |
| sys_ff_pln_flag_mappings_dtl | Plan-flag relationships with plan-specific values |
| org_ff_overrides_cf | Tenant-specific overrides (HQ approval workflow) |

## hq_ff_feature_flags_mst Columns

| Column | Description |
|--------|-------------|
| flag_key | Primary key (e.g., pdf_invoices, service_preferences_enabled) |
| flag_name, flag_name2 | Display name (EN/AR) |
| flag_description, flag_description2 | Description |
| governance_category | tenant_feature, tenant_limit, hq_feature, hq_config, experimental, beta |
| data_type | boolean, integer, float, string, etc. |
| default_value | JSONB default |
| plan_binding_type | plan_bound, independent |
| enabled_plan_codes | JSONB array of plan codes where flag is enabled |
| allows_tenant_override | Whether tenant can override |
| comp_code | Links to sys_components_cd for navigation |

## Plan-Level Flags (org_tenants_mst / sys_plan_limits)

These flags live in `org_tenants_mst.feature_flags` and `sys_plan_limits.feature_flags` (JSON object):

| Flag Key | Name | Description |
|----------|------|-------------|
| pdf_invoices | PDF Invoices | Generate and download PDF invoices |
| whatsapp_receipts | WhatsApp Receipts | Send receipts via WhatsApp |
| in_app_receipts | In-App Receipts | View receipts in mobile app |
| printing | Receipt Printing | Print receipts on thermal printers |
| b2b_contracts | B2B Contracts | Corporate customer contracts |
| white_label | White Label | Custom branding |
| marketplace_listings | Marketplace Listings | List services on marketplace |
| loyalty_programs | Loyalty Programs | Customer loyalty points |
| driver_app | Driver App | Mobile app for delivery drivers |
| multi_branch | Multi-Branch | Manage multiple branch locations |
| advanced_analytics | Advanced Analytics | Detailed reports and BI |
| api_access | API Access | REST API access |

## HQ-Managed Flags (hq_ff_feature_flags_mst)

From migrations 0066, 0140:

| flag_key | governance_category | enabled_plan_codes |
|----------|---------------------|--------------------|
| service_preferences_enabled | tenant_feature | STARTER, GROWTH, PRO, ENTERPRISE |
| packing_preferences_enabled | tenant_feature | STARTER, GROWTH, PRO, ENTERPRISE |
| per_piece_packing | tenant_feature | ENTERPRISE |
| per_piece_service_prefs | tenant_feature | ENTERPRISE |
| customer_standing_prefs | tenant_feature | STARTER, GROWTH, PRO, ENTERPRISE |
| bundles_enabled | tenant_feature | GROWTH, PRO, ENTERPRISE |
| smart_suggestions | tenant_feature | GROWTH, PRO, ENTERPRISE |
| sla_adjustment | tenant_feature | STARTER, GROWTH, PRO, ENTERPRISE |
| repeat_last_order | tenant_feature | STARTER, GROWTH, PRO, ENTERPRISE |
| processing_confirmation | tenant_feature | ENTERPRISE |
| max_service_prefs_per_item | tenant_limit | — |
| max_service_prefs_per_piece | tenant_limit | — |
| max_bundles | tenant_limit | — |
| feature_flag_override_hq | tenant_feature | — |

## sys_ff_pln_flag_mappings_dtl

Plan-specific values (e.g., max prefs per item):

| plan_code | flag_key | plan_specific_value | is_enabled |
|-----------|----------|---------------------|------------|
| FREE_TRIAL | service_preferences_enabled | 3 | true |
| STARTER | service_preferences_enabled | 6 | true |
| GROWTH | service_preferences_enabled | 10 | true |
| PRO | service_preferences_enabled | 10 | true |
| ENTERPRISE | service_preferences_enabled | -1 (unlimited) | true |
| GROWTH | bundles_enabled | 5 | true |
| PRO | bundles_enabled | 5 | true |
| ENTERPRISE | bundles_enabled | -1 | true |

## See Also

- [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md)
- [NAVIGATION_FEATURE_FLAGS](NAVIGATION_FEATURE_FLAGS.md)
- [TENANT_AND_PLAN_FLAGS](TENANT_AND_PLAN_FLAGS.md)
