/**
 * PRD-003: Customer Address Management Service
 * Handle customer addresses with multi-tenant isolation
 */

import { createClient } from '@/lib/supabase/server';
import type {
  CustomerAddress,
  CreateAddressRequest,
  UpdateAddressRequest,
} from '@/lib/types/customer';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Get tenant ID from current session
 */
async function getTenantIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.user_metadata?.tenant_org_id) {
    throw new Error('Unauthorized: No tenant context');
  }

  return user.user_metadata.tenant_org_id;
}

/**
 * Get user ID from current session
 */
async function getUserIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user.id;
}

/**
 * Verify customer belongs to current tenant
 */
/**
 * Verify customer access - handles both sys_customers_mst.id and org_customers_mst.id
 */
async function verifyCustomerAccess(customerId: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // First, check if this is an org_customers_mst.id
  const { data: orgCustomerCheck } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  let sysCustomerId: string;

  if (orgCustomerCheck) {
    // This is an org_customers_mst.id, use the linked customer_id
    sysCustomerId = orgCustomerCheck.customer_id || customerId;
  } else {
    // This might be a sys_customers_mst.id, verify it belongs to this tenant
    const { data: link } = await supabase
      .from('org_customers_mst')
      .select('customer_id')
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId)
      .maybeSingle();

    if (!link) {
      throw new Error('Customer not found or access denied');
    }

    sysCustomerId = customerId;
  }

  // Verify the sys_customers_mst.id exists and belongs to tenant
  const { data: finalCheck } = await supabase
    .from('org_customers_mst')
    .select('customer_id')
    .eq('customer_id', sysCustomerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  if (!finalCheck) {
    throw new Error('Customer not found or access denied');
  }
}

/**
 * Map database row to CustomerAddress type
 */
function mapToCustomerAddress(row: any): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    tenantOrgId: row.tenant_org_id,
    addressType: row.address_type,
    label: row.label,
    building: row.building,
    floor: row.floor,
    apartment: row.apartment,
    street: row.street,
    area: row.area,
    city: row.city,
    country: row.country || 'OM',
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    isDefault: row.is_default,
    deliveryNotes: row.delivery_notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    isActive: row.is_active,
  };
}

// ==================================================================
// ADDRESS CRUD OPERATIONS
// ==================================================================

/**
 * Create a new address for a customer
 */
export async function createAddress(
  customerId: string,
  request: CreateAddressRequest
): Promise<CustomerAddress> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const userId = await getUserIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  // If this is set as default, unset other defaults first
  // (This is also handled by the database trigger, but we do it here for immediate consistency)
  if (request.isDefault) {
    await supabase
      .from('org_customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId);
  }

  // Create address
  const { data: address, error } = await supabase
    .from('org_customer_addresses')
    .insert({
      customer_id: customerId,
      tenant_org_id: tenantId,
      address_type: request.addressType,
      label: request.label || null,
      building: request.building || null,
      floor: request.floor || null,
      apartment: request.apartment || null,
      street: request.street || null,
      area: request.area || null,
      city: request.city || null,
      country: request.country || 'OM',
      postal_code: request.postalCode || null,
      latitude: request.latitude || null,
      longitude: request.longitude || null,
      is_default: request.isDefault || false,
      delivery_notes: request.deliveryNotes || null,
      created_by: userId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating address:', error);
    throw new Error('Failed to create address');
  }

  return mapToCustomerAddress(address);
}

/**
 * Get all addresses for a customer
 */
export async function getCustomerAddresses(
  customerId: string
): Promise<CustomerAddress[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  const { data: addresses, error } = await supabase
    .from('org_customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching addresses:', error);
    throw new Error('Failed to fetch addresses');
  }

  return addresses.map(mapToCustomerAddress);
}

/**
 * Get a single address by ID
 */
export async function getAddressById(
  customerId: string,
  addressId: string
): Promise<CustomerAddress | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  const { data: address, error } = await supabase
    .from('org_customer_addresses')
    .select('*')
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching address:', error);
    return null;
  }

  return address ? mapToCustomerAddress(address) : null;
}

/**
 * Get default address for a customer
 */
export async function getDefaultAddress(
  customerId: string
): Promise<CustomerAddress | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  const { data: address, error } = await supabase
    .from('org_customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching default address:', error);
    return null;
  }

  return address ? mapToCustomerAddress(address) : null;
}

/**
 * Update an address
 */
export async function updateAddress(
  customerId: string,
  addressId: string,
  updates: UpdateAddressRequest
): Promise<CustomerAddress> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  const userId = await getUserIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  // Verify address exists and belongs to customer
  const existingAddress = await getAddressById(customerId, addressId);
  if (!existingAddress) {
    throw new Error('Address not found or access denied');
  }

  // If setting as default, unset other defaults first
  if (updates.isDefault) {
    await supabase
      .from('org_customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId)
      .eq('tenant_org_id', tenantId)
      .neq('id', addressId);
  }

  // Update address
  const { data: address, error } = await supabase
    .from('org_customer_addresses')
    .update({
      address_type: updates.addressType,
      label: updates.label,
      building: updates.building,
      floor: updates.floor,
      apartment: updates.apartment,
      street: updates.street,
      area: updates.area,
      city: updates.city,
      country: updates.country,
      postal_code: updates.postalCode,
      latitude: updates.latitude,
      longitude: updates.longitude,
      is_default: updates.isDefault,
      delivery_notes: updates.deliveryNotes,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('Error updating address:', error);
    throw new Error('Failed to update address');
  }

  return mapToCustomerAddress(address);
}

/**
 * Set an address as default
 */
export async function setDefaultAddress(
  customerId: string,
  addressId: string
): Promise<CustomerAddress> {
  return updateAddress(customerId, addressId, { isDefault: true });
}

/**
 * Delete an address (soft delete)
 */
export async function deleteAddress(
  customerId: string,
  addressId: string
): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  // Verify address exists
  const existingAddress = await getAddressById(customerId, addressId);
  if (!existingAddress) {
    throw new Error('Address not found or access denied');
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from('org_customer_addresses')
    .update({ is_active: false })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId);

  if (error) {
    console.error('Error deleting address:', error);
    throw new Error('Failed to delete address');
  }

  // If deleted address was default, set another address as default
  if (existingAddress.isDefault) {
    const remainingAddresses = await getCustomerAddresses(customerId);
    if (remainingAddresses.length > 0) {
      await setDefaultAddress(customerId, remainingAddresses[0].id);
    }
  }
}

/**
 * Permanently delete an address (hard delete)
 * Use with caution - only for admin operations
 */
export async function permanentlyDeleteAddress(
  customerId: string,
  addressId: string
): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();

  // Verify customer access
  await verifyCustomerAccess(customerId);

  const { error } = await supabase
    .from('org_customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId);

  if (error) {
    console.error('Error permanently deleting address:', error);
    throw new Error('Failed to permanently delete address');
  }
}

/**
 * Validate address coordinates
 */
export function validateCoordinates(
  latitude?: number,
  longitude?: number
): { valid: boolean; error?: string } {
  if (latitude === undefined && longitude === undefined) {
    return { valid: true }; // Optional fields
  }

  if (latitude === undefined || longitude === undefined) {
    return { valid: false, error: 'Both latitude and longitude must be provided' };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
}

/**
 * Calculate distance between two coordinates (in kilometers)
 * Uses Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
