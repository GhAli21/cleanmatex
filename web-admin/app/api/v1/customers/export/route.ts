/**
 * PRD-003: Customer Management API
 * Customer Export to CSV - Admin Only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { searchCustomers } from '@/lib/services/customers.service';
import type { CustomerSearchParams } from '@/lib/types/customer';
import { civilDateInZone } from '@/lib/utils/operational-time';
import { resolveOperationalTimeZone } from '@/lib/utils/operational-zone.server';
import { toApiInstant } from '@/lib/clock/api-output';

/**
 * Convert customers to CSV format
 * @param customers
 */
/** ISO `Z` cell; offset-less text is refused rather than read in the server zone (S7 `toApiInstant`). */
function instantIso(value: string | Date | null | undefined): string {
  return toApiInstant(value) ?? '';
}

function convertToCSV(customers: any[], zone: string | null): string {
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
    'Last Order Instant',
    'Created Instant',
    'Time Zone',
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
    civilDateInZone(customer.lastOrderAt, zone),
    civilDateInZone(customer.createdAt, zone),
    instantIso(customer.lastOrderAt),
    instantIso(customer.createdAt),
    zone ?? '',
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
 * @param request
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const { userRole, tenantId } = await getAuthContext();

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
      excludeB2b: searchParams.get('excludeB2b') === 'true',
    };

    // 4. Fetch customers (with server-side date filtering)
    const { customers } = await searchCustomers(params);

    // 5. Convert to CSV
    const zone = tenantId
      ? await resolveOperationalTimeZone(tenantId, 'invoice', null)
      : null;
    const csvContent = convertToCSV(customers, zone);

    const filenameDay = civilDateInZone(new Date(), zone) || 'export';
    const filename = `customers_${filenameDay}.csv`;

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
      if (error.message === 'Unauthorized' || error.message === 'Password change required' || error.message.startsWith('No tenant access')) {
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
