/**
 * PRD-003: Customer Management Types
 * Type definitions for progressive customer engagement system
 */

// ==================================================================
// ENUMS & CONSTANTS
// ==================================================================

export type CustomerType = 'guest' | 'stub' | 'walk_in' | 'full';
export type ProfileStatus = 0 | 1 | 2 | 3;
export type isActive = true | false;
export type AddressType = 'home' | 'work' | 'other';
export type OTPPurpose = 'registration' | 'login' | 'verification';

// ==================================================================
// CUSTOMER CORE TYPES
// ==================================================================

/**
 * Customer Preferences (stored in JSONB)
 */
export interface CustomerPreferences {
  folding?: 'hang' | 'fold';
  fragrance?: 'none' | 'lavender' | 'rose' | 'citrus' | 'ocean';
  ecoFriendly?: boolean;
  notifications?: {
    whatsapp?: boolean;
    sms?: boolean;
    email?: boolean;
  };
}

/**
 * Complete Customer Profile
 */
export interface Customer {
  // Identity
  id: string;
  customerNumber: string | null;

  // Basic Info
  firstName: string;
  lastName: string | null;
  displayName: string | null;
  name: string | null;
  name2: string | null; // Arabic name

  // Contact
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  emailVerified: boolean;

  // Profile Type
  type: CustomerType;
  profileStatus: ProfileStatus;

  // Media
  avatarUrl: string | null;

  // Preferences
  preferences: CustomerPreferences;

  // Legacy Address Fields (from sys_customers_mst)
  address: string | null;
  area: string | null;
  building: string | null;
  floor: string | null;

  // Tenant Reference
  firstTenantOrgId: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Customer with Tenant-Specific Data
 * GET /api/v1/customers/:id returns this with optional addresses array.
 */
export interface CustomerWithTenantData extends Customer {
  tenantData: {
    tenantOrgId: string;
    loyaltyPoints: number;
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: string | null;
    joinedAt: string;
  };
  /** Populated when fetching customer by id; not present on list responses */
  addresses?: CustomerAddress[];
}

/**
 * Customer List Item (for table views)
 */
export interface CustomerListItem {
  id: string;
  customerNumber: string | null;
  displayName: string | null; 
  name: string | null;
  name2: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  type: CustomerType;
  profileStatus: ProfileStatus;
  createdAt: string;
  totalOrders: number;
  lastOrderAt: string | null;
  loyaltyPoints: number;
  // Progressive search metadata
  source?: 'current_tenant' | 'sys_global' | 'other_tenant';
  belongsToCurrentTenant?: boolean;
  originalTenantId?: string;
  customerId?: string; // sys_customers_mst.id if linked to global customer
  orgCustomerId?: string; // org_customers_mst.id (for other tenant source)
}

// ==================================================================
// CUSTOMER ADDRESS TYPES
// ==================================================================

/**
 * Customer Address
 */
export interface CustomerAddress {
  id: string;
  customerId: string;
  tenantOrgId: string;

  // Type & Label
  addressType: AddressType;
  label: string | null;

  // Address Fields
  building: string | null;
  floor: string | null;
  apartment: string | null;
  street: string | null;
  area: string | null;
  city: string | null;
  country: string; // Default: 'OM'
  postalCode: string | null;

  // GPS Coordinates
  latitude: number | null;
  longitude: number | null;

  // Metadata
  isDefault: boolean;
  deliveryNotes: string | null;

  // Audit
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isActive: boolean;
}

// ==================================================================
// REQUEST TYPES (API Inputs)
// ==================================================================

/**
 * Create Guest Customer (no phone/email required)
 */
export interface CreateGuestCustomerRequest {
  type: 'guest';
  firstName: string;
  lastName?: string;
  displayName?: string;
  name?: string;
  name2?: string; 
}

/**
 * Create Stub Customer (phone required)
 */
export interface CreateStubCustomerRequest {
  type: 'stub';
  firstName: string;
  lastName?: string;
  phone: string;
  displayName?: string;
  name?: string;
  name2?: string; 
}

/**
 * Create Full Customer (phone + OTP + complete profile)
 */
export interface CreateFullCustomerRequest {
  type: 'full';
  firstName: string;
  lastName?: string;
  displayName?: string;
  name?: string;
  name2?: string; // Arabic name
  phone: string;
  email?: string;
  otpCode?: string; // Required for phone verification
  preferences?: CustomerPreferences;
  addresses?: CreateAddressRequest[];
}

/**
 * Union type for all customer creation requests
 */
export type CustomerCreateRequest =
  | CreateGuestCustomerRequest
  | CreateStubCustomerRequest
  | CreateFullCustomerRequest;

/**
 * Update Customer Profile
 */
export interface CustomerUpdateRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  name?: string;
  name2?: string; // Arabic name
  email?: string;
  address?: string;
  area?: string;
  building?: string;
  floor?: string;
  preferences?: CustomerPreferences;
}

/**
 * Upgrade Stub to Full Profile
 */
export interface CustomerUpgradeRequest {
  email?: string;
  otpCode: string; // Required for verification
  preferences?: CustomerPreferences;
  addresses?: CreateAddressRequest[];
}

/**
 * Customer Search/Filter Parameters
 */
export interface CustomerSearchParams {
  page?: number;
  limit?: number;
  search?: string; // Search by name, phone, email, customer number
  type?: CustomerType; // Filter by type
  status?: 'active' | 'inactive'; // Filter by is_active
  sortBy?: 'name' | 'createdAt' | 'lastOrderAt' | 'totalOrders';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Merge Customers Request (Admin Only)
 */
export interface MergeCustomersRequest {
  sourceCustomerId: string; // Customer to merge from (will be deactivated)
  targetCustomerId: string; // Customer to merge into
  reason?: string;
}

// ==================================================================
// ADDRESS REQUEST TYPES
// ==================================================================

/**
 * Create Address Request
 */
export interface CreateAddressRequest {
  addressType: AddressType;
  label?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  street?: string;
  area?: string;
  city?: string;
  country?: string; // Default: 'OM'
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  deliveryNotes?: string;
}

/**
 * Update Address Request
 */
export interface UpdateAddressRequest {
  addressType?: AddressType;
  label?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  street?: string;
  area?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  deliveryNotes?: string;
}

// ==================================================================
// OTP TYPES
// ==================================================================

/**
 * Send OTP Request
 */
export interface SendOTPRequest {
  phone: string;
  purpose: OTPPurpose;
}

/**
 * Verify OTP Request
 */
export interface VerifyOTPRequest {
  phone: string;
  code: string;
}

/**
 * OTP Verification Response
 */
export interface OTPVerificationResponse {
  verified: boolean;
  token?: string; // Temporary token for registration (valid 15 minutes)
  message?: string;
}

/**
 * Send OTP Response
 */
export interface SendOTPResponse {
  success: boolean;
  message: string;
  expiresAt: string;
  phone: string; // Masked phone (e.g., "+968901****56")
}

// ==================================================================
// RESPONSE TYPES (API Outputs)
// ==================================================================

/**
 * Customer Create Response
 */
export interface CustomerCreateResponse {
  success: boolean;
  data: Customer;
  message?: string;
}

/**
 * Customer List Response
 */
export interface CustomerListResponse {
  success: boolean;
  data: CustomerListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Customer Detail Response
 */
export interface CustomerDetailResponse {
  success: boolean;
  data: CustomerWithTenantData;
}

/**
 * Customer Update Response
 */
export interface CustomerUpdateResponse {
  success: boolean;
  data: Customer;
  message?: string;
}

/**
 * Customer Merge Response
 */
export interface CustomerMergeResponse {
  success: boolean;
  data: {
    targetCustomer: Customer;
    ordersMoved: number;
    loyaltyPointsMerged: number;
  };
  message?: string;
}

/**
 * Address Response
 */
export interface AddressResponse {
  success: boolean;
  data: CustomerAddress;
  message?: string;
}

/**
 * Address List Response
 */
export interface AddressListResponse {
  success: boolean;
  data: CustomerAddress[];
}

// ==================================================================
// AUDIT & LOGS
// ==================================================================

/**
 * Customer Merge Log Entry
 */
export interface CustomerMergeLog {
  id: string;
  tenantOrgId: string;
  sourceCustomerId: string;
  targetCustomerId: string;
  mergedBy: string;
  mergeReason: string | null;
  ordersMoved: number;
  loyaltyPointsMerged: number;
  createdAt: string;
}

// ==================================================================
// UTILITY TYPES
// ==================================================================

/**
 * Phone Normalization Result
 */
export interface PhoneNormalizationResult {
  normalized: string; // E.164 format (e.g., "+96890123456")
  countryCode: string; // e.g., "+968"
  nationalNumber: string; // e.g., "90123456"
  isValid: boolean;
}

/**
 * Customer Export Options
 */
export interface CustomerExportOptions {
  type?: CustomerType;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  format?: 'csv' | 'xlsx';
}

/**
 * Customer Statistics
 */
export interface CustomerStatistics {
  total: number;
  byType: {
    guest: number;
    stub: number;
    full: number;
  };
  newThisMonth: number;
  active: number;
  inactive: number;
}
