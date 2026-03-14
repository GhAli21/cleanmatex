
export const DEFAULT_LEGACY_FEATURE_FLAGS: FeatureFlags = {
  [FEATURE_FLAG_KEYS.PDF_INVOICES]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.PDF_INVOICES] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.WHATSAPP_RECEIPTS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.WHATSAPP_RECEIPTS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.IN_APP_RECEIPTS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.IN_APP_RECEIPTS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.PRINTING]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.PRINTING] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.B2B_CONTRACTS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.B2B_CONTRACTS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.WHITE_LABEL]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.WHITE_LABEL] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.MARKETPLACE_LISTINGS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.MARKETPLACE_LISTINGS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.LOYALTY_PROGRAMS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.LOYALTY_PROGRAMS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.DRIVER_APP]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.DRIVER_APP] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.MULTI_BRANCH]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.MULTI_BRANCH] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.ADVANCED_ANALYTICS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.ADVANCED_ANALYTICS] as boolean) ?? false,
  [FEATURE_FLAG_KEYS.API_ACCESS]: (DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.API_ACCESS] as boolean) ?? false,
};
{
  pdf_invoices: false,
  whatsapp_receipts: false,
  in_app_receipts: false,
  printing: false,
  b2b_contracts: false,
  white_label: false,
  marketplace_listings: false,
  loyalty_programs: false,
  driver_app: false,
  multi_branch: false,
  advanced_analytics: false,
  api_access: false,
}
in_app_receipts: false,
  printing: false,
  b2b_contracts: false,
  marketplace_listings: false,
  loyalty_programs: false,
  driver_app: false,
  multi_branch: false,
  advanced_analytics: false,
  api_access: false,
  
export const FEATURE_FLAGS: Record<FeatureFlagKey, { name: string; description: string }> = {
  pdf_invoices: {
    name: 'PDF Invoices',
    description: 'Generate and download PDF invoices',
  },
  whatsapp_receipts: {
    name: 'WhatsApp Receipts',
    description: 'Send receipts via WhatsApp',
  },
  in_app_receipts: {
    name: 'In-App Receipts',
    description: 'View receipts in mobile app',
  },
  printing: {
    name: 'Receipt Printing',
    description: 'Print receipts on thermal printers',
  },
  b2b_contracts: {
    name: 'B2B Contracts',
    description: 'Corporate customer contracts and billing',
  },
  white_label: {
    name: 'White Label',
    description: 'Custom branding and white-label apps',
  },
  marketplace_listings: {
    name: 'Marketplace Listings',
    description: 'List services on the marketplace',
  },
  loyalty_programs: {
    name: 'Loyalty Programs',
    description: 'Customer loyalty points and rewards',
  },
  driver_app: {
    name: 'Driver App',
    description: 'Mobile app for delivery drivers',
  },
  multi_branch: {
    name: 'Multi-Branch',
    description: 'Manage multiple branch locations',
  },
  advanced_analytics: {
    name: 'Advanced Analytics',
    description: 'Detailed reports and business intelligence',
  },
  api_access: {
    name: 'API Access',
    description: 'REST API access for integrations',
  },
};

========================

[
  {
    "flag_key": "tenant_pdf_invoices",
    "flag_name": "PDF Invoices",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_whatsapp_receipts",
    "flag_name": "WhatsApp Receipts",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_in_app_receipts",
    "flag_name": "In-App Receipts",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_multi_branch",
    "flag_name": "Multi-Branch Support",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_driver_app",
    "flag_name": "Driver App Access",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_white_label",
    "flag_name": "White Label Branding",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_advanced_analytics",
    "flag_name": "Advanced Analytics",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_api_access",
    "flag_name": "API Access",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_max_orders_per_month",
    "flag_name": "Max Orders Per Month",
    "flag_description": null,
    "data_type": "integer",
    "default_value": 100
  },
  {
    "flag_key": "tenant_max_branches",
    "flag_name": "Max Branches",
    "flag_description": null,
    "data_type": "integer",
    "default_value": 1
  },
  {
    "flag_key": "tenant_max_users",
    "flag_name": "Max Users",
    "flag_description": null,
    "data_type": "integer",
    "default_value": 1
  },
  {
    "flag_key": "tenant_max_storage_mb",
    "flag_name": "Max Storage (MB)",
    "flag_description": null,
    "data_type": "integer",
    "default_value": 1000
  },
  {
    "flag_key": "tenant_beta_ai_classification",
    "flag_name": "AI Order Classification (Beta)",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_beta_voice_orders",
    "flag_name": "Voice Order Entry (Beta)",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "tenant_new_dashboard_ui",
    "flag_name": "New Dashboard UI",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "hq_maintenance_mode",
    "flag_name": "Maintenance Mode",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "hq_advanced_analytics",
    "flag_name": "HQ Advanced Analytics",
    "flag_description": null,
    "data_type": "boolean",
    "default_value": true
  },
  {
    "flag_key": "tenant_custom_domain",
    "flag_name": "Custom Domain",
    "flag_description": null,
    "data_type": "string",
    "default_value": ""
  },
  {
    "flag_key": "tenant_branding_config",
    "flag_name": "Branding Configuration",
    "flag_description": null,
    "data_type": "object",
    "default_value": {}
  },
  {
    "flag_key": "workflow_role_restrictions_enabled",
    "flag_name": "Workflow Role Restrictions Enabled",
    "flag_description": "Enable Workflow Role Restrictions Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "user_activity_tracking",
    "flag_name": "User Activity Tracking",
    "flag_description": "Enable User Activity Tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "verified_reviews_enabled",
    "flag_name": "Verified Reviews Enabled",
    "flag_description": "Enable Verified Reviews Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "wallet_enabled",
    "flag_name": "Wallet Enabled",
    "flag_description": "Enable Wallet Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "webhooks",
    "flag_name": "Webhooks",
    "flag_description": "Configure webhooks for order events",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "webhooks_enabled",
    "flag_name": "Webhooks Enabled",
    "flag_description": "Enable Webhooks Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "whatsapp_business_api",
    "flag_name": "Whatsapp Business Api",
    "flag_description": "Enable Whatsapp Business Api",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "whatsapp_notifications",
    "flag_name": "WhatsApp Notifications",
    "flag_description": "Send order status updates via WhatsApp",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "whatsapp_receipts",
    "flag_name": "WhatsApp Receipts",
    "flag_description": "Send receipts via WhatsApp Business API",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "whatsapp_receipts_enabled",
    "flag_name": "Whatsapp Receipts Enabled",
    "flag_description": "Enable Whatsapp Receipts Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "white_label",
    "flag_name": "White Label",
    "flag_description": "Custom branding and white-label apps",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "white_label_enabled",
    "flag_name": "White Label Enabled",
    "flag_description": "Enable White Label Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "workflow_automation",
    "flag_name": "Workflow Automation",
    "flag_description": "Automated status transitions based on rules",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "workflow_per_service_category",
    "flag_name": "Workflow Per Service Category",
    "flag_description": "Enable Workflow Per Service Category",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "machine_maintenance_logs",
    "flag_name": "Machine Maintenance Logs",
    "flag_description": "Enable Machine Maintenance Logs",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "maintenance_mode_enabled",
    "flag_name": "Maintenance Mode Enabled",
    "flag_description": "Enable Maintenance Mode Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "accounting_export_enabled",
    "flag_name": "Accounting Export Enabled",
    "flag_description": "Enable Accounting Export Enabled",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "accounting_integration",
    "flag_name": "Accounting Integration",
    "flag_description": "Sync with accounting software (QuickBooks, Xero)",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "address_management",
    "flag_name": "Address Management",
    "flag_description": "Manage multiple delivery addresses per customer",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "audit_logs",
    "flag_name": "Audit Logs",
    "flag_description": "Comprehensive audit trail of all actions",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "advance_payments_enabled",
    "flag_name": "Advance Payments Enabled",
    "flag_description": "Enable Advance Payments Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "advanced_analytics",
    "flag_name": "Advanced Analytics",
    "flag_description": "Detailed reports and business intelligence",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "advanced_analytics_enabled",
    "flag_name": "Advanced Analytics Enabled",
    "flag_description": "Enable Advanced Analytics Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "advanced_roles_enabled",
    "flag_name": "Advanced Roles Enabled",
    "flag_description": "Enable Advanced Roles Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_churn_prediction",
    "flag_name": "Ai Churn Prediction",
    "flag_description": "Enable Ai Churn Prediction",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_damage_detection",
    "flag_name": "AI Damage Detection",
    "flag_description": "AI-powered damage and stain detection from photos",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_features_explainable_only",
    "flag_name": "Ai Features Explainable Only",
    "flag_description": "Enable Ai Features Explainable Only",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_feedback_capture",
    "flag_name": "Ai Feedback Capture",
    "flag_description": "Enable Ai Feedback Capture",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_pricing_estimator",
    "flag_name": "Ai Pricing Estimator",
    "flag_description": "Enable Ai Pricing Estimator",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_ready_by_prediction",
    "flag_name": "Ai Ready By Prediction",
    "flag_description": "Enable Ai Ready By Prediction",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_recommendations_enabled",
    "flag_name": "Ai Recommendations Enabled",
    "flag_description": "Enable Ai Recommendations Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_routing_eta",
    "flag_name": "Ai Routing Eta",
    "flag_description": "Enable Ai Routing Eta",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ai_vision_qa",
    "flag_name": "Ai Vision Qa",
    "flag_description": "Enable Ai Vision Qa",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "api_access",
    "flag_name": "API Access",
    "flag_description": "REST API access for integrations",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "api_access_enabled",
    "flag_name": "Api Access Enabled",
    "flag_description": "Enable Api Access Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "approval_required_for_refunds",
    "flag_name": "Approval Required For Refunds",
    "flag_description": "Enable Approval Required For Refunds",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "assembly_bin_location_tracking",
    "flag_name": "Assembly Bin Location Tracking",
    "flag_description": "Enable Assembly Bin Location Tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "assembly_capacity_limits",
    "flag_name": "Assembly Capacity Limits",
    "flag_description": "Enable Assembly Capacity Limits",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "assembly_completeness_check",
    "flag_name": "Assembly Completeness Check",
    "flag_description": "Enable Assembly Completeness Check",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "assembly_stage_enabled",
    "flag_name": "Assembly Stage Enabled",
    "flag_description": "Enable Assembly Stage Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "assembly_workflow",
    "flag_name": "Assembly Workflow",
    "flag_description": "Assemble items back together per order with barcode scanning",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "audit_logs_enabled",
    "flag_name": "Audit Logs Enabled",
    "flag_description": "Enable Audit Logs Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "b2b_contracts",
    "flag_name": "B2B Contracts",
    "flag_description": "Corporate customer contracts and billing",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "b2b_invoicing",
    "flag_name": "B2B Invoicing",
    "flag_description": "Generate invoices for corporate customers with payment terms",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "b2b_invoicing_enabled",
    "flag_name": "B2B Invoicing Enabled",
    "flag_description": "Enable B2B Invoicing Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "b2b_statements_enabled",
    "flag_name": "B2B Statements Enabled",
    "flag_description": "Enable B2B Statements Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "background_jobs_enabled",
    "flag_name": "Background Jobs Enabled",
    "flag_description": "Enable Background Jobs Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "backward_stage_transition_allowed",
    "flag_name": "Backward Stage Transition Allowed",
    "flag_description": "Enable Backward Stage Transition Allowed",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "barcode_scanning",
    "flag_name": "Barcode Scanning",
    "flag_description": "Scan barcodes for item tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "basic_reports_enabled",
    "flag_name": "Basic Reports Enabled",
    "flag_description": "Enable Basic Reports Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "benchmarking_enabled",
    "flag_name": "Benchmarking Enabled",
    "flag_description": "Enable Benchmarking Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "branch_analytics",
    "flag_name": "Branch Analytics",
    "flag_description": "Performance analytics per branch",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "branch_level_user_access",
    "flag_name": "Branch Level User Access",
    "flag_description": "Enable Branch Level User Access",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "branch_transfers",
    "flag_name": "Branch Transfers",
    "flag_description": "Transfer orders between branches",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "branded_emails",
    "flag_name": "Branded Emails",
    "flag_description": "Customize email templates with branding",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "branded_receipts",
    "flag_name": "Branded Receipts",
    "flag_description": "Customize receipt templates with branding",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "bulk_order_import",
    "flag_name": "Bulk Order Import",
    "flag_description": "Import multiple orders from CSV/Excel files",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "bulk_pricing",
    "flag_name": "Bulk Pricing",
    "flag_description": "Volume discounts and bulk pricing tiers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "campaigns_enabled",
    "flag_name": "Campaigns Enabled",
    "flag_description": "Enable Campaigns Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "centralized_inventory",
    "flag_name": "Centralized Inventory",
    "flag_description": "Shared inventory management across branches",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "cohort_analysis_enabled",
    "flag_name": "Cohort Analysis Enabled",
    "flag_description": "Enable Cohort Analysis Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "commission_engine_enabled",
    "flag_name": "Commission Engine Enabled",
    "flag_description": "Enable Commission Engine Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "configurable_workflows_enabled",
    "flag_name": "Configurable Workflows Enabled",
    "flag_description": "Enable Configurable Workflows Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "consumables_threshold_alerts",
    "flag_name": "Consumables Threshold Alerts",
    "flag_description": "Enable Consumables Threshold Alerts",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "cost_per_order_tracking",
    "flag_name": "Cost Per Order Tracking",
    "flag_description": "Enable Cost Per Order Tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "coupons_enabled",
    "flag_name": "Coupons Enabled",
    "flag_description": "Enable Coupons Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "credit_limits",
    "flag_name": "Credit Limits",
    "flag_description": "Set credit limits for B2B customers",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "credit_notes_enabled",
    "flag_name": "Credit Notes Enabled",
    "flag_description": "Enable Credit Notes Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "custom_branding",
    "flag_name": "Custom Branding",
    "flag_description": "Customize colors, logos, and branding",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "custom_domain",
    "flag_name": "Custom Domain",
    "flag_description": "Use custom domain for tenant portal",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "custom_domain_enabled",
    "flag_name": "Custom Domain Enabled",
    "flag_description": "Enable Custom Domain Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "custom_reports",
    "flag_name": "Custom Reports",
    "flag_description": "Create custom reports with filters and exports",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "custom_workflows",
    "flag_name": "Custom Workflows",
    "flag_description": "Create custom workflow steps and status transitions",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_analytics",
    "flag_name": "Customer Analytics",
    "flag_description": "Customer lifetime value, retention, and segmentation",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_app",
    "flag_name": "Customer Mobile App",
    "flag_description": "Mobile app for customers to place and track orders",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_evidence_upload",
    "flag_name": "Customer Evidence Upload",
    "flag_description": "Enable Customer Evidence Upload",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_history",
    "flag_name": "Order History",
    "flag_description": "View complete order history per customer",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_notes",
    "flag_name": "Customer Notes",
    "flag_description": "Add internal notes about customers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_portal",
    "flag_name": "Customer Portal",
    "flag_description": "Self-service portal for customers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_profiles",
    "flag_name": "Customer Profiles",
    "flag_description": "Detailed customer profiles with history",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_segments",
    "flag_name": "Customer Segmentation",
    "flag_description": "Segment customers by behavior, value, or attributes",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_tags",
    "flag_name": "Customer Tags",
    "flag_description": "Tag and categorize customers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "damage_reporting_enabled",
    "flag_name": "Damage Reporting Enabled",
    "flag_description": "Enable Damage Reporting Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "data_encryption",
    "flag_name": "Data Encryption",
    "flag_description": "Encrypt sensitive customer and payment data",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "data_export_enabled",
    "flag_name": "Data Export Enabled",
    "flag_description": "Enable Data Export Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "delivery_optimization",
    "flag_name": "Delivery Optimization",
    "flag_description": "Optimize delivery routes for efficiency",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "delivery_scheduling",
    "flag_name": "Delivery Scheduling",
    "flag_description": "Schedule delivery time slots",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "delivery_scheduling_enabled",
    "flag_name": "Delivery Scheduling Enabled",
    "flag_description": "Enable Delivery Scheduling Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "delivery_tracking",
    "flag_name": "Delivery Tracking",
    "flag_description": "Real-time delivery tracking with GPS",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "delivery_zones",
    "flag_name": "Delivery Zones",
    "flag_description": "Define delivery zones and pricing",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "device_limit_enforced",
    "flag_name": "Device Limit Enforced",
    "flag_description": "Enable Device Limit Enforced",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "digital_receipts",
    "flag_name": "Digital Receipts",
    "flag_description": "Send digital receipts via email/SMS/WhatsApp",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "discount_coupons",
    "flag_name": "Discount Coupons",
    "flag_description": "Create and manage discount coupons",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "dispute_center_enabled",
    "flag_name": "Dispute Center Enabled",
    "flag_description": "Enable Dispute Center Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "downtime_analytics_enabled",
    "flag_name": "Downtime Analytics Enabled",
    "flag_description": "Enable Downtime Analytics Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "driver_app",
    "flag_name": "Driver App",
    "flag_description": "Mobile app for delivery drivers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "driver_app_enabled",
    "flag_name": "Driver App Enabled",
    "flag_description": "Enable Driver App Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "driver_assignment",
    "flag_name": "Driver Assignment",
    "flag_description": "Manually or automatically assign drivers to deliveries",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "driver_route_optimization",
    "flag_name": "Driver Route Optimization",
    "flag_description": "Enable Driver Route Optimization",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "dunning_enabled",
    "flag_name": "Dunning Enabled",
    "flag_description": "Enable Dunning Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "dynamic_slot_pricing",
    "flag_name": "Dynamic Slot Pricing",
    "flag_description": "Enable Dynamic Slot Pricing",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "eco_badges_enabled",
    "flag_name": "Eco Badges Enabled",
    "flag_description": "Enable Eco Badges Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "email_password_login_enabled",
    "flag_name": "Email Password Login Enabled",
    "flag_description": "Enable Email Password Login Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "email_provider_enabled",
    "flag_name": "Email Provider Enabled",
    "flag_description": "Enable Email Provider Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "email_receipts",
    "flag_name": "Email Receipts",
    "flag_description": "Send receipts and invoices via email",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "email_receipts_enabled",
    "flag_name": "Email Receipts Enabled",
    "flag_description": "Enable Email Receipts Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "emergency_disable_orders",
    "flag_name": "Emergency Disable Orders",
    "flag_description": "Enable Emergency Disable Orders",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "emergency_disable_payments",
    "flag_name": "Emergency Disable Payments",
    "flag_description": "Enable Emergency Disable Payments",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "escrow_enabled",
    "flag_name": "Escrow Enabled",
    "flag_description": "Enable Escrow Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "exception_reason_codes_enabled",
    "flag_name": "Exception Reason Codes Enabled",
    "flag_description": "Enable Exception Reason Codes Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "export_reports",
    "flag_name": "Export Reports",
    "flag_description": "Export reports to PDF, Excel, CSV",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "export_to_csv_enabled",
    "flag_name": "Export To Csv Enabled",
    "flag_description": "Enable Export To Csv Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "express_service_enabled",
    "flag_name": "Express Service Enabled",
    "flag_description": "Enable Express Service Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "family_accounts_enabled",
    "flag_name": "Family Accounts Enabled",
    "flag_description": "Enable Family Accounts Enabled",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "feature_flag_override_hq",
    "flag_name": "Feature Flag Override Hq",
    "flag_description": "Enable Feature Flag Override Hq",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "franchise_mode_enabled",
    "flag_name": "Franchise Mode Enabled",
    "flag_description": "Enable Franchise Mode Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "gdpr_compliance",
    "flag_name": "GDPR Compliance",
    "flag_description": "GDPR compliance tools and data export",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "geofence_validation_enabled",
    "flag_name": "Geofence Validation Enabled",
    "flag_description": "Enable Geofence Validation Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "gift_cards_enabled",
    "flag_name": "Gift Cards Enabled",
    "flag_description": "Enable Gift Cards Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "google_maps_enabled",
    "flag_name": "Google Maps Enabled",
    "flag_description": "Enable Google Maps Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "idempotency_enforced",
    "flag_name": "Idempotency Enforced",
    "flag_description": "Enable Idempotency Enforced",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "image_recognition",
    "flag_name": "Image Recognition",
    "flag_description": "Automatically identify items from photos",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "impersonation_enabled",
    "flag_name": "Impersonation Enabled",
    "flag_description": "Enable Impersonation Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "in_app_receipts",
    "flag_name": "In-App Receipts",
    "flag_description": "View receipts in mobile app",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "in_app_receipts_enabled",
    "flag_name": "In App Receipts Enabled",
    "flag_description": "Enable In App Receipts Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "intake_barcode_scan_required",
    "flag_name": "Intake Barcode Scan Required",
    "flag_description": "Enable Intake Barcode Scan Required",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "intake_bulk_add_items",
    "flag_name": "Intake Bulk Add Items",
    "flag_description": "Enable Intake Bulk Add Items",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "intake_label_printing",
    "flag_name": "Intake Label Printing",
    "flag_description": "Enable Intake Label Printing",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "intake_workflow",
    "flag_name": "Intake Workflow",
    "flag_description": "Formal intake process with item receipt confirmation",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "inventory_tracking_enabled",
    "flag_name": "Inventory Tracking Enabled",
    "flag_description": "Enable Inventory Tracking Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "invoice_at_delivery",
    "flag_name": "Invoice At Delivery",
    "flag_description": "Enable Invoice At Delivery",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "invoice_at_ready",
    "flag_name": "Invoice At Ready",
    "flag_description": "Enable Invoice At Ready",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "invoice_printing",
    "flag_name": "Invoice Printing",
    "flag_description": "Print invoices and receipts",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "invoicing_enabled",
    "flag_name": "Invoicing Enabled",
    "flag_description": "Enable Invoicing Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "issue_to_solve_enabled",
    "flag_name": "Issue To Solve Enabled",
    "flag_description": "Enable Issue To Solve Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "label_printing",
    "flag_name": "Label Printing",
    "flag_description": "Print barcode/QR code labels for items",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "label_printing_58mm",
    "flag_name": "Label Printing 58Mm",
    "flag_description": "Enable Label Printing 58Mm",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "label_printing_80mm",
    "flag_name": "Label Printing 80Mm",
    "flag_description": "Enable Label Printing 80Mm",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "live_order_tracking",
    "flag_name": "Live Order Tracking",
    "flag_description": "Enable Live Order Tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "loyalty_points_enabled",
    "flag_name": "Loyalty Points Enabled",
    "flag_description": "Enable Loyalty Points Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "loyalty_program_enabled",
    "flag_name": "Loyalty Program Enabled",
    "flag_description": "Enable Loyalty Program Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "loyalty_programs",
    "flag_name": "Loyalty Programs",
    "flag_description": "Customer loyalty points and rewards",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "loyalty_tiers_enabled",
    "flag_name": "Loyalty Tiers Enabled",
    "flag_description": "Enable Loyalty Tiers Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "machine_tracking_enabled",
    "flag_name": "Machine Tracking Enabled",
    "flag_description": "Enable Machine Tracking Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "magic_link_login_enabled",
    "flag_name": "Magic Link Login Enabled",
    "flag_description": "Enable Magic Link Login Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "manual_price_override_enabled",
    "flag_name": "Manual Price Override Enabled",
    "flag_description": "Enable Manual Price Override Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "marketplace_enabled",
    "flag_name": "Marketplace Enabled",
    "flag_description": "Enable Marketplace Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "points_system",
    "flag_name": "Points System",
    "flag_description": "Earn and redeem loyalty points",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "marketplace_listings",
    "flag_name": "Marketplace Listings",
    "flag_description": "List services on the marketplace",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "marketplace_listings_enabled",
    "flag_name": "Marketplace Listings Enabled",
    "flag_description": "Enable Marketplace Listings Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "membership_plans_enabled",
    "flag_name": "Membership Plans Enabled",
    "flag_description": "Enable Membership Plans Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "merge_suborders_enabled",
    "flag_name": "Merge Suborders Enabled",
    "flag_description": "Enable Merge Suborders Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "missing_item_alerts",
    "flag_name": "Missing Item Alerts",
    "flag_description": "Enable Missing Item Alerts",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "mobile_ordering",
    "flag_name": "Mobile Ordering",
    "flag_description": "Allow customers to place orders via mobile app",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "mobile_tracking",
    "flag_name": "Mobile Order Tracking",
    "flag_description": "Real-time order tracking in mobile apps",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_branch",
    "flag_name": "Multi-Branch",
    "flag_description": "Manage multiple branch locations",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_branch_enabled",
    "flag_name": "Multi Branch Enabled",
    "flag_description": "Enable Multi Branch Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_currency_enabled",
    "flag_name": "Multi Currency Enabled",
    "flag_description": "Enable Multi Currency Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_language",
    "flag_name": "Multi-Language Support",
    "flag_description": "Full bilingual support (English/Arabic)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_tenant_enabled",
    "flag_name": "Multi Tenant Enabled",
    "flag_description": "Enable Multi Tenant Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "multi_tender_payments",
    "flag_name": "Multi Tender Payments",
    "flag_description": "Enable Multi Tender Payments",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "offline_queue_enabled",
    "flag_name": "Offline Queue Enabled",
    "flag_description": "Enable Offline Queue Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "online_booking",
    "flag_name": "Online Booking",
    "flag_description": "Allow customers to book services online",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "online_payments",
    "flag_name": "Online Payment Processing",
    "flag_description": "Accept card payments via payment gateways (Stripe, HyperPay, PayTabs)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_analytics",
    "flag_name": "Order Analytics",
    "flag_description": "Order volume, status distribution, and trends",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_notes",
    "flag_name": "Order Notes & Instructions",
    "flag_description": "Add detailed notes and special instructions to orders",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_reminders",
    "flag_name": "Order Reminders",
    "flag_description": "Automated reminders for ready orders and pickups",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_scheduling",
    "flag_name": "Order Scheduling",
    "flag_description": "Schedule orders for future pickup/delivery dates",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_split_enabled",
    "flag_name": "Order Split Enabled",
    "flag_description": "Enable Order Split Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "order_templates",
    "flag_name": "Order Templates",
    "flag_description": "Save and reuse order templates for recurring customers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "otp_login_enabled",
    "flag_name": "Otp Login Enabled",
    "flag_description": "Enable Otp Login Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "otp_proof_of_delivery",
    "flag_name": "Otp Proof Of Delivery",
    "flag_description": "Enable Otp Proof Of Delivery",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "packing_list_printing",
    "flag_name": "Packing List Printing",
    "flag_description": "Print bilingual packing lists",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "packing_stage_enabled",
    "flag_name": "Packing Stage Enabled",
    "flag_description": "Enable Packing Stage Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "packing_workflow",
    "flag_name": "Packing Workflow",
    "flag_description": "Generate packing lists and manage packaging materials",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "partial_delivery_enabled",
    "flag_name": "Partial Delivery Enabled",
    "flag_description": "Enable Partial Delivery Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "partial_payments",
    "flag_name": "Partial Payments",
    "flag_description": "Allow customers to pay orders in installments",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "partial_payments_enabled",
    "flag_name": "Partial Payments Enabled",
    "flag_description": "Enable Partial Payments Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "partial_release_enabled",
    "flag_name": "Partial Release Enabled",
    "flag_description": "Enable Partial Release Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "payment_gateway_hyperpay",
    "flag_name": "HyperPay Integration",
    "flag_description": "Process payments via HyperPay gateway (GCC region)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "payment_gateway_paytabs",
    "flag_name": "PayTabs Integration",
    "flag_description": "Process payments via PayTabs gateway (GCC region)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "payment_gateway_stripe",
    "flag_name": "Stripe Integration",
    "flag_description": "Process payments via Stripe gateway",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "payment_plans",
    "flag_name": "Payment Plans",
    "flag_description": "Create custom payment plans for large orders",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "pdf_invoices",
    "flag_name": "PDF Invoices",
    "flag_description": "Generate and download PDF invoices",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "pdf_receipts_enabled",
    "flag_name": "Pdf Receipts Enabled",
    "flag_description": "Enable Pdf Receipts Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "performance_dashboard",
    "flag_name": "Performance Dashboard",
    "flag_description": "Real-time KPI dashboard with widgets",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "photo_capture_on_intake",
    "flag_name": "Photo Capture On Intake",
    "flag_description": "Enable Photo Capture On Intake",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "photo_pod_enabled",
    "flag_name": "Photo Pod Enabled",
    "flag_description": "Enable Photo Pod Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "pickup_scheduling_enabled",
    "flag_name": "Pickup Scheduling Enabled",
    "flag_description": "Enable Pickup Scheduling Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "piece_level_barcode_tracking",
    "flag_name": "Piece Level Barcode Tracking",
    "flag_description": "Enable Piece Level Barcode Tracking",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "pos_integration",
    "flag_name": "POS Integration",
    "flag_description": "Integrate with point-of-sale systems",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "preparation_stage_enabled",
    "flag_name": "Preparation Stage Enabled",
    "flag_description": "Enable Preparation Stage Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "preparation_workflow",
    "flag_name": "Preparation Workflow",
    "flag_description": "Item tagging, photography, and condition documentation",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "pricing_rules",
    "flag_name": "Pricing Rules",
    "flag_description": "Dynamic pricing based on rules and conditions",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "printing",
    "flag_name": "Receipt Printing",
    "flag_description": "Print receipts on thermal printers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "priority_orders_enabled",
    "flag_name": "Priority Orders Enabled",
    "flag_description": "Enable Priority Orders Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "product_variants",
    "flag_name": "Product Variants",
    "flag_description": "Create variants for services (e.g., express, standard)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "promotional_pricing_rules",
    "flag_name": "Promotional Pricing Rules",
    "flag_description": "Enable Promotional Pricing Rules",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "public_catalog",
    "flag_name": "Public Catalog",
    "flag_description": "Public-facing service catalog",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "push_notifications",
    "flag_name": "Push Notifications",
    "flag_description": "Mobile app push notifications for customers",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "qa_mandatory_before_ready",
    "flag_name": "Qa Mandatory Before Ready",
    "flag_description": "Enable Qa Mandatory Before Ready",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "qa_photo_on_fail_required",
    "flag_name": "Qa Photo On Fail Required",
    "flag_description": "Enable Qa Photo On Fail Required",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "qa_stage_enabled",
    "flag_name": "Qa Stage Enabled",
    "flag_description": "Enable Qa Stage Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "qa_workflow",
    "flag_name": "Quality Assurance",
    "flag_description": "Quality check gate before orders can be marked ready",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "qr_code_generation",
    "flag_name": "QR Code Generation",
    "flag_description": "Generate QR codes for orders and items",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "quick_drop_enabled",
    "flag_name": "Quick Drop Enabled",
    "flag_description": "Enable Quick Drop Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "quick_drop_orders",
    "flag_name": "Quick Drop Orders",
    "flag_description": "Create orders without detailed itemization",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "quick_drop_without_items",
    "flag_name": "Quick Drop Without Items",
    "flag_description": "Enable Quick Drop Without Items",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "rate_limiting_enabled",
    "flag_name": "Rate Limiting Enabled",
    "flag_description": "Enable Rate Limiting Enabled",
    "data_type": "integer",
    "default_value": 0
  },
  {
    "flag_key": "rbac_enabled",
    "flag_name": "Rbac Enabled",
    "flag_description": "Enable Rbac Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "read_only_mode",
    "flag_name": "Read Only Mode",
    "flag_description": "Enable Read Only Mode",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "ready_by_estimation_enabled",
    "flag_name": "Ready By Estimation Enabled",
    "flag_description": "Enable Ready By Estimation Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "receipt_branding_enabled",
    "flag_name": "Receipt Branding Enabled",
    "flag_description": "Enable Receipt Branding Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "receipt_history",
    "flag_name": "Receipt History",
    "flag_description": "Access historical receipts",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "referral_program",
    "flag_name": "Referral Program",
    "flag_description": "Customer referral rewards program",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "referrals_enabled",
    "flag_name": "Referrals Enabled",
    "flag_description": "Enable Referrals Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "refunds_enabled",
    "flag_name": "Refunds Enabled",
    "flag_description": "Enable Refunds Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "reprocess_flow_enabled",
    "flag_name": "Reprocess Flow Enabled",
    "flag_description": "Enable Reprocess Flow Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "revenue_analytics",
    "flag_name": "Revenue Analytics",
    "flag_description": "Revenue tracking, trends, and forecasting",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "revenue_heatmaps",
    "flag_name": "Revenue Heatmaps",
    "flag_description": "Enable Revenue Heatmaps",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "review_moderation_required",
    "flag_name": "Review Moderation Required",
    "flag_description": "Enable Review Moderation Required",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "rtl_support",
    "flag_name": "RTL Support",
    "flag_description": "Right-to-left language support",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sandbox_mode_enabled",
    "flag_name": "Sandbox Mode Enabled",
    "flag_description": "Enable Sandbox Mode Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "scan_enforcement_per_stage",
    "flag_name": "Scan Enforcement Per Stage",
    "flag_description": "Enable Scan Enforcement Per Stage",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "service_catalog",
    "flag_name": "Service Catalog",
    "flag_description": "Manage laundry and dry cleaning services",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "service_categories",
    "flag_name": "Service Categories",
    "flag_description": "Organize services into categories",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "session_timeout_control",
    "flag_name": "Session Timeout Control",
    "flag_description": "Enable Session Timeout Control",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "signature_pod_enabled",
    "flag_name": "Signature Pod Enabled",
    "flag_description": "Enable Signature Pod Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "signed_webhooks_only",
    "flag_name": "Signed Webhooks Only",
    "flag_description": "Enable Signed Webhooks Only",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sla_dashboards_enabled",
    "flag_name": "Sla Dashboards Enabled",
    "flag_description": "Enable Sla Dashboards Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "slot_capacity_management",
    "flag_name": "Slot Capacity Management",
    "flag_description": "Enable Slot Capacity Management",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sms_notifications",
    "flag_name": "SMS Notifications",
    "flag_description": "Send SMS alerts for order status changes",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sms_provider_enabled",
    "flag_name": "Sms Provider Enabled",
    "flag_description": "Enable Sms Provider Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sorting_workflow",
    "flag_name": "Sorting Workflow",
    "flag_description": "Sort items by fabric type, color, and service category",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "store_app",
    "flag_name": "Store Staff App",
    "flag_description": "Mobile app for store staff to manage orders",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "supplier_management_enabled",
    "flag_name": "Supplier Management Enabled",
    "flag_description": "Enable Supplier Management Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "supplier_portal_enabled",
    "flag_name": "Supplier Portal Enabled",
    "flag_description": "Enable Supplier Portal Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sustainability_metrics_enabled",
    "flag_name": "Sustainability Metrics Enabled",
    "flag_description": "Enable Sustainability Metrics Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "vat_enabled",
    "flag_name": "Vat Enabled",
    "flag_description": "Enable Vat Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "thermal_printing_enabled",
    "flag_name": "Thermal Printing Enabled",
    "flag_description": "Enable Thermal Printing Enabled",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "third_party_integrations",
    "flag_name": "Third-Party Integrations",
    "flag_description": "Integrate with accounting, CRM, and other systems",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "track_individual_pieces",
    "flag_name": "Track Individual Pieces",
    "flag_description": "Enable Track Individual Pieces",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "two_factor_auth",
    "flag_name": "Two-Factor Authentication",
    "flag_description": "Enable 2FA for user accounts",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "processing_confirmation",
    "flag_name": "Processing Confirmation",
    "flag_description": "Require processing confirmation per pref (Enterprise)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "max_service_prefs_per_item",
    "flag_name": "Max Service Prefs Per Item",
    "flag_description": "Max service preferences per order item (-1=unlimited)",
    "data_type": "integer",
    "default_value": 10
  },
  {
    "flag_key": "max_service_prefs_per_piece",
    "flag_name": "Max Service Prefs Per Piece",
    "flag_description": "Max service preferences per piece (Enterprise)",
    "data_type": "integer",
    "default_value": 5
  },
  {
    "flag_key": "max_bundles",
    "flag_name": "Max Bundles",
    "flag_description": "Max preference bundles per tenant",
    "data_type": "integer",
    "default_value": 5
  },
  {
    "flag_key": "service_preferences_enabled",
    "flag_name": "Service Preferences Enabled",
    "flag_description": "Enable service preferences (starch, perfume, delicate, etc.)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "packing_preferences_enabled",
    "flag_name": "Packing Preferences Enabled",
    "flag_description": "Enable packing preferences (hang, fold, box)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "per_piece_packing",
    "flag_name": "Per-Piece Packing",
    "flag_description": "Allow packing preference per piece (Enterprise)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "per_piece_service_prefs",
    "flag_name": "Per-Piece Service Prefs",
    "flag_description": "Allow service preferences per piece (Enterprise)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "customer_standing_prefs",
    "flag_name": "Customer Standing Prefs",
    "flag_description": "Allow customer standing preferences",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "bundles_enabled",
    "flag_name": "Preference Bundles Enabled",
    "flag_description": "Enable Care Package bundles (Growth+)",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "repeat_last_order",
    "flag_name": "Repeat Last Order",
    "flag_description": "Repeat preferences from last order",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "sla_adjustment",
    "flag_name": "SLA Adjustment",
    "flag_description": "Adjust ready-by based on preference turnaround",
    "data_type": "boolean",
    "default_value": false
  },
  {
    "flag_key": "smart_suggestions",
    "flag_name": "Smart Suggestions",
    "flag_description": "Suggest preferences from history",
    "data_type": "boolean",
    "default_value": false
  }
]
