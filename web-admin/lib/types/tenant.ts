/**
 * PRD-002: Tenant Onboarding & Management Types
 * Type definitions for tenant, subscription, and plan management
 */

import type { DiscountType } from '@/lib/types/payment';

// ========================
// Tenant Types
// ========================

export interface Tenant {
  id: string;
  name: string;
  name2?: string | null;
  slug: string;
  email: string;
  phone: string;
  s_cureent_plan: string;
  address?: string | null;
  city?: string | null;
  country: string;
  currency: string;
  timezone: string;
  language: string;
  is_active: boolean;
  status: 'trial' | 'active' | 'suspended' | 'canceled';
  logo_url?: string | null;
  brand_color_primary: string;
  brand_color_secondary: string;
  business_hours?: BusinessHours | null;
  feature_flags?: FeatureFlags | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  mon?: DayHours | null;
  tue?: DayHours | null;
  wed?: DayHours | null;
  thu?: DayHours | null;
  fri?: DayHours | null;
  sat?: DayHours | null;
  sun?: DayHours | null;
}

export interface DayHours {
  open: string; // HH:mm format
  close: string; // HH:mm format
}

export interface FeatureFlags {
  /*
  pdf_invoices: boolean;
  whatsapp_receipts: boolean;
  in_app_receipts: boolean;
  printing: boolean;
  b2b_contracts: boolean;
  white_label: boolean;
  marketplace_listings: boolean;
  loyalty_programs: boolean;
  driver_app: boolean;
  multi_branch: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
  */
  // added by jehad
  
    tenant_new_dashboard_ui: boolean;
    tenant_beta_ai_classification: boolean;
    tenant_beta_voice_orders: boolean;
    hq_maintenance_mode: boolean;
    maintenance_mode_enabled: boolean;
    hq_advanced_analytics: boolean;
    machine_maintenance_logs: boolean;
    tenant_api_access: boolean;
    workflow_role_restrictions_enabled: boolean;
    tenant_whatsapp_receipts: boolean;
    tenant_in_app_receipts: boolean;
    tenant_multi_branch: boolean;
    tenant_driver_app: boolean;
    tenant_white_label: boolean;
    tenant_advanced_analytics: boolean;
    wallet_enabled: boolean;
    webhooks: boolean;
    webhooks_enabled: boolean;
    whatsapp_business_api: boolean;
    whatsapp_notifications: boolean;
    whatsapp_receipts: boolean;
    whatsapp_receipts_enabled: boolean;
    white_label: boolean;
    white_label_enabled: boolean;
    workflow_automation: boolean;
    workflow_per_service_category: boolean;
    tenant_pdf_invoices: boolean;
    tenant_custom_domain: string;
    tenant_branding_config: Record<string, any>;
    smart_suggestions: boolean;
    processing_confirmation: boolean;
    service_preferences_enabled: boolean;
    packing_preferences_enabled: boolean;
    per_piece_packing: boolean;
    per_piece_service_prefs: boolean;
    customer_standing_prefs: boolean;
    bundles_enabled: boolean;
    repeat_last_order: boolean;
    sla_adjustment: boolean;
    accounting_export_enabled: number;
    accounting_integration: number;
    erp_lite_enabled: boolean;
    erp_lite_gl_enabled: boolean;
    erp_lite_reports_enabled: boolean;
    erp_lite_ar_enabled: boolean;
    erp_lite_expenses_enabled: boolean;
    erp_lite_bank_recon_enabled: boolean;
    erp_lite_ap_enabled: boolean;
    erp_lite_po_enabled: boolean;
    erp_lite_branch_pl_enabled: boolean;
    address_management: boolean;
    audit_logs: boolean;
    advance_payments_enabled: boolean;
    advanced_analytics: boolean;
    advanced_analytics_enabled: boolean;
    advanced_roles_enabled: boolean;
    ai_churn_prediction: boolean;
    ai_damage_detection: boolean;
    ai_features_explainable_only: boolean;
    ai_feedback_capture: boolean;
    ai_pricing_estimator: boolean;
    ai_ready_by_prediction: boolean;
    ai_recommendations_enabled: boolean;
    ai_routing_eta: boolean;
    ai_vision_qa: boolean;
    api_access: boolean;
    api_access_enabled: boolean;
    approval_required_for_refunds: boolean;
    assembly_bin_location_tracking: boolean;
    assembly_completeness_check: boolean;
    assembly_stage_enabled: boolean;
    assembly_workflow: boolean;
    audit_logs_enabled: boolean;
    b2b_contracts: boolean;
    b2b_invoicing: boolean;
    b2b_invoicing_enabled: boolean;
    b2b_statements_enabled: boolean;
    background_jobs_enabled: boolean;
    backward_stage_transition_allowed: boolean;
    barcode_scanning: boolean;
    basic_reports_enabled: boolean;
    benchmarking_enabled: boolean;
    branch_analytics: boolean;
    branch_level_user_access: boolean;
    branch_transfers: boolean;
    branded_emails: boolean;
    branded_receipts: boolean;
    bulk_order_import: boolean;
    bulk_pricing: boolean;
    campaigns_enabled: boolean;
    centralized_inventory: boolean;
    cohort_analysis_enabled: boolean;
    commission_engine_enabled: boolean;
    configurable_workflows_enabled: boolean;
    cost_per_order_tracking: boolean;
    coupons_enabled: boolean;
    credit_notes_enabled: boolean;
    custom_branding: boolean;
    custom_domain: boolean;
    custom_domain_enabled: boolean;
    custom_reports: boolean;
    custom_workflows: boolean;
    customer_analytics: boolean;
    customer_app: boolean;
    customer_evidence_upload: boolean;
    customer_history: boolean;
    customer_notes: boolean;
    customer_portal: boolean;
    customer_profiles: boolean;
    customer_segments: boolean;
    customer_tags: boolean;
    damage_reporting_enabled: boolean;
    data_encryption: boolean;
    data_export_enabled: boolean;
    delivery_optimization: boolean;
    delivery_scheduling: boolean;
    delivery_scheduling_enabled: boolean;
    delivery_tracking: boolean;
    delivery_zones: boolean;
    digital_receipts: boolean;
    discount_coupons: number;
    dispute_center_enabled: boolean;
    downtime_analytics_enabled: boolean;
    driver_app: boolean;
    driver_app_enabled: boolean;
    driver_assignment: boolean;
    driver_route_optimization: boolean;
    dunning_enabled: boolean;
    dynamic_slot_pricing: boolean;
    eco_badges_enabled: boolean;
    email_password_login_enabled: boolean;
    email_provider_enabled: boolean;
    email_receipts: boolean;
    email_receipts_enabled: boolean;
    emergency_disable_orders: boolean;
    emergency_disable_payments: boolean;
    escrow_enabled: boolean;
    exception_reason_codes_enabled: boolean;
    export_reports: boolean;
    export_to_csv_enabled: boolean;
    express_service_enabled: boolean;
    family_accounts_enabled: number;
    feature_flag_override_hq: boolean;
    franchise_mode_enabled: boolean;
    gdpr_compliance: boolean;
    geofence_validation_enabled: boolean;
    gift_cards_enabled: boolean;
    google_maps_enabled: boolean;
    idempotency_enforced: boolean;
    image_recognition: boolean;
    impersonation_enabled: boolean;
    in_app_receipts: boolean;
    in_app_receipts_enabled: boolean;
    intake_barcode_scan_required: boolean;
    intake_bulk_add_items: boolean;
    intake_label_printing: boolean;
    intake_workflow: boolean;
    inventory_tracking_enabled: boolean;
    invoice_at_delivery: boolean;
    invoice_at_ready: boolean;
    invoice_printing: boolean;
    invoicing_enabled: boolean;
    issue_to_solve_enabled: boolean;
    label_printing: boolean;
    label_printing_58mm: boolean;
    label_printing_80mm: boolean;
    live_order_tracking: boolean;
    loyalty_points_enabled: boolean;
    loyalty_program_enabled: boolean;
    loyalty_programs: boolean;
    loyalty_tiers_enabled: boolean;
    machine_tracking_enabled: boolean;
    magic_link_login_enabled: boolean;
    manual_price_override_enabled: boolean;
    marketplace_enabled: boolean;
    points_system: boolean;
    marketplace_listings: boolean;
    marketplace_listings_enabled: boolean;
    membership_plans_enabled: boolean;
    merge_suborders_enabled: boolean;
    missing_item_alerts: boolean;
    mobile_ordering: boolean;
    mobile_tracking: boolean;
    multi_branch: boolean;
    multi_branch_enabled: boolean;
    multi_currency_enabled: boolean;
    multi_language: boolean;
    multi_tenant_enabled: boolean;
    multi_tender_payments: boolean;
    offline_queue_enabled: boolean;
    online_booking: boolean;
    online_payments: boolean;
    order_analytics: boolean;
    order_notes: boolean;
    order_reminders: boolean;
    order_scheduling: boolean;
    order_split_enabled: boolean;
    order_templates: boolean;
    otp_login_enabled: boolean;
    otp_proof_of_delivery: boolean;
    packing_list_printing: boolean;
    packing_stage_enabled: boolean;
    packing_workflow: boolean;
    partial_delivery_enabled: boolean;
    partial_payments: boolean;
    partial_payments_enabled: boolean;
    partial_release_enabled: boolean;
    payment_gateway_hyperpay: boolean;
    payment_gateway_paytabs: boolean;
    payment_gateway_stripe: boolean;
    payment_plans: boolean;
    pdf_invoices: boolean;
    pdf_receipts_enabled: boolean;
    performance_dashboard: boolean;
    photo_capture_on_intake: boolean;
    photo_pod_enabled: boolean;
    pickup_scheduling_enabled: boolean;
    piece_level_barcode_tracking: boolean;
    pos_integration: boolean;
    preparation_stage_enabled: boolean;
    preparation_workflow: boolean;
    pricing_rules: boolean;
    printing: boolean;
    priority_orders_enabled: boolean;
    product_variants: boolean;
    promotional_pricing_rules: boolean;
    public_catalog: boolean;
    push_notifications: boolean;
    qa_mandatory_before_ready: boolean;
    qa_photo_on_fail_required: boolean;
    qa_stage_enabled: boolean;
    qa_workflow: boolean;
    qr_code_generation: boolean;
    quick_drop_enabled: boolean;
    quick_drop_orders: boolean;
    quick_drop_without_items: boolean;
    rbac_enabled: boolean;
    read_only_mode: boolean;
    ready_by_estimation_enabled: boolean;
    receipt_branding_enabled: boolean;
    receipt_history: boolean;
    referral_program: boolean;
    referrals_enabled: boolean;
    refunds_enabled: boolean;
    reprocess_flow_enabled: boolean;
    revenue_analytics: boolean;
    revenue_heatmaps: boolean;
    review_moderation_required: boolean;
    rtl_support: boolean;
    sandbox_mode_enabled: boolean;
    scan_enforcement_per_stage: boolean;
    service_catalog: boolean;
    service_categories: boolean;
    session_timeout_control: boolean;
    signature_pod_enabled: boolean;
    signed_webhooks_only: boolean;
    sla_dashboards_enabled: boolean;
    slot_capacity_management: boolean;
    sms_notifications: boolean;
    sms_provider_enabled: boolean;
    sorting_workflow: boolean;
    store_app: boolean;
    supplier_management_enabled: boolean;
    supplier_portal_enabled: boolean;
    sustainability_metrics_enabled: boolean;
    vat_enabled: boolean;
    thermal_printing_enabled: boolean;
    third_party_integrations: boolean;
    track_individual_pieces: boolean;
    two_factor_auth: boolean;
    user_activity_tracking: boolean;
    verified_reviews_enabled: boolean;
    tenant_max_storage_mb: number;
    tenant_max_users: number;
    device_limit_enforced: number;
    assembly_capacity_limits: number;
    credit_limits: number;
    consumables_threshold_alerts: number;
    max_service_prefs_per_item: number;
    max_service_prefs_per_piece: number;
    max_bundles: number;
    rate_limiting_enabled: number;
    tenant_max_branches: number;
    tenant_max_orders_per_month: number;
  
}

// ========================
// Subscription Types
// ========================

export interface Subscription {
  id: string;
  tenant_org_id: string;
  plan: string;
  status: 'trial' | 'active' | 'canceling' | 'canceled' | 'past_due';
  orders_limit: number;
  orders_used: number;
  branch_limit: number;
  user_limit: number;
  start_date: string;
  end_date: string;
  trial_ends?: string | null;
  last_payment_date?: string | null;
  last_payment_amount?: number | null;
  last_payment_method?: string | null;
  payment_reference?: string | null;
  payment_notes?: string | null;
  last_invoice_number?: string | null;
  last_invoice_date?: string | null;
  auto_renew: boolean;
  cancellation_date?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'canceling' | 'canceled' | 'past_due';

export interface TenantSubscription {
  id: string;
  tenant_org_id: string;

  // Plan reference
  plan_code: string;
  plan_name: string | null;

  // Status
  status: SubscriptionStatus;

  // Pricing
  base_price: number;
  currency: string;
  billing_cycle: string;

  // Billing period
  current_period_start: string;
  current_period_end: string;

  // Trial
  trial_start: string | null;
  trial_end: string | null;

  // Lifecycle dates
  activated_at: string | null;
  suspended_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;

  // Discount information
  discount_code: string | null;
  discount_value: number | null;
  discount_type: DiscountType | null;
  discount_duration_months: number | null;
  discount_applied_at: string | null;

  // Plan change scheduling
  scheduled_plan_code: string | null;
  scheduled_plan_change_date: string | null;
  plan_change_scheduled_at: string | null;
  plan_changed_at: string | null;
  previous_plan_code: string | null;

  // Payment method
  default_payment_method_id: string | null;

  // Metadata
  subscription_notes: string | null;

  // Audit fields
  created_at: string;
  created_by: string | null;
  created_info: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_info: string | null;
  rec_status: number;
  rec_order: number | null;
  rec_notes: string | null;
  is_active: boolean;
}

// ========================
// Plan Types
// ========================

export interface PlanLimits {
  plan_code: string;
  plan_name: string;
  plan_name2?: string | null;
  plan_description?: string | null;
  plan_description2?: string | null;
  orders_limit: number;
  users_limit: number;
  branches_limit: number;
  storage_mb_limit: number;
  price_monthly: number;
  price_yearly?: number | null;
  feature_flags: FeatureFlags;
  is_public: boolean;
  display_order?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanComparison extends PlanLimits {
  isCurrentPlan: boolean;
  isRecommended?: boolean;
}

// ========================
// Usage Tracking Types
// ========================

export interface UsageTracking {
  id: string;
  tenant_org_id: string;
  period_start: string; // Date
  period_end: string; // Date
  orders_count: number;
  users_count: number;
  branches_count: number;
  storage_mb: number;
  api_calls: number;
  created_at: string;
  updated_at: string;
}

export interface UsageMetrics {
  currentPeriod: {
    start: string;
    end: string;
  };
  limits: {
    ordersLimit: number;
    usersLimit: number;
    branchesLimit: number;
    storageMbLimit: number;
  };
  usage: {
    ordersCount: number;
    ordersPercentage: number;
    usersCount: number;
    usersPercentage: number;
    branchesCount: number;
    branchesPercentage: number;
    storageMb: number;
    storagePercentage: number;
  };
  warnings: UsageWarning[];
}

export interface UsageWarning {
  type: 'approaching_limit' | 'limit_exceeded' | 'limit_reached';
  resource: 'orders' | 'users' | 'branches' | 'storage';
  message: string;
  percentage: number;
}

// ========================
// Registration Types
// ========================

export interface TenantRegistrationRequest {
  businessName: string;
  businessNameAr?: string;
  slug: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  language: string;
  adminUser: {
    email: string;
    password: string;
    displayName: string;
  };
}

export interface TenantRegistrationResponse {
  tenant: Tenant;
  subscription: Subscription;
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
}

// ========================
// Update Request Types
// ========================

export interface TenantUpdateRequest {
  name?: string;
  name2?: string;
  phone?: string;
  address?: string;
  city?: string;
  brand_color_primary?: string;
  brand_color_secondary?: string;
  business_hours?: BusinessHours;
}

export interface SubscriptionUpgradeRequest {
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

export interface SubscriptionCancelRequest {
  reason: string;
  feedback?: string;
}

// ========================
// Helper Types
// ========================

export interface SlugValidationResult {
  isValid: boolean;
  errors?: string[];
  suggestedSlug?: string;
}

export interface LimitCheckResult {
  canProceed: boolean;
  limitType?: 'orders' | 'users' | 'branches' | 'storage';
  current: number;
  limit: number;
  message?: string;
}
