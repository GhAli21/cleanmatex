/**
 * PRD-002: Tenant Onboarding & Management Types
 * Type definitions for tenant, subscription, and plan management
 */

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
