/**
 * PRD-003: Customer Management API
 * Customer Export to CSV - Admin Only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchCustomers } from '@/lib/services/customers.service';
import type { CustomerSearchParams } from '@/lib/types/customer';

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/**
 * Get authenticated user and tenant context
 */
async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const tenantId = user.user_metadata?.tenant_org_id;
  if (!tenantId) {
    throw new Error('No tenant context');
  }

  return {
    user,
    tenantId,
    userId: user.id,
    userRole: user.user_metadata?.role || 'user',
  };
}

/**
 * Convert customers to CSV format
 */
function convertToCSV(customers: any[]): string {
  // CSV Headers
  const headers = [
    'Customer Number',
    'First Name',
    'Last Name',
    'Display Name',
    'Phone',
    'Email',
    'Type',
    'Profile Status',
    'Phone Verified',
    'Email Verified',
    'Loyalty Points',
    'Total Orders',
    'Last Order Date',
    'Created At',
  ];

  // CSV Rows
  const rows = customers.map((customer) => [
    customer.customerNumber || '',
    customer.firstName || '',
    customer.lastName || '',
    customer.displayName || '',
    customer.phone || '',
    customer.email || '',
    customer.type || '',
    customer.profileStatus || '',
    customer.phoneVerified ? 'Yes' : 'No',
    customer.emailVerified ? 'Yes' : 'No',
    customer.loyaltyPoints || 0,
    customer.totalOrders || 0,
    customer.lastOrderAt
      ? new Date(customer.lastOrderAt).toLocaleDateString()
      : '',
    customer.createdAt
      ? new Date(customer.createdAt).toLocaleDateString()
      : '',
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        // Escape cells that contain commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ),
  ].join('\n');

  return csvContent;
}

// ==================================================================
// GET /api/v1/customers/export - Export Customers to CSV (Admin Only)
// ==================================================================

/**
 * Export customers to CSV file
 *
 * Query Parameters:
 * - type: 'guest' | 'stub' | 'full' (filter by type)
 * - status: 'active' | 'inactive' (filter by status)
 * - startDate: ISO date string (created after)
 * - endDate: ISO date string (created before)
 *
 * Response: CSV file download
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userRole } = await getAuthContext();

    // 2. Check admin permission
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        {
          error: 'Insufficient permissions. Only admins can export customer data.',
        },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);

    const params: CustomerSearchParams = {
      page: 1,
      limit: 10000, // Export up to 10,000 customers at once
      type: (searchParams.get('type') as any) || undefined,
      status: (searchParams.get('status') as 'active' | 'inactive') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // 4. Fetch customers (with server-side date filtering)
    const { customers } = await searchCustomers(params);

    // 5. Convert to CSV
    const csvContent = convertToCSV(customers);

    // 8. Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `customers_${timestamp}.csv`;

    // 9. Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting customers:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'No tenant context') {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to export customers' },
      { status: 500 }
    );
  }
}
