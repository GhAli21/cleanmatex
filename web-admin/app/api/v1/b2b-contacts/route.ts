/**
 * B2B Contacts API
 * GET /api/v1/b2b-contacts?customer_id=xxx - List contacts by customer
 * POST /api/v1/b2b-contacts - Create contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  listContactsByCustomer,
  createContact,
} from '@/lib/services/b2b-contacts.service';
import { z } from 'zod';

const CreateContactSchema = z.object({
  customerId: z.string().uuid(),
  contactName: z.string().optional(),
  contactName2: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  roleCd: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:read')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customer_id query parameter is required' },
        { status: 400 }
      );
    }

    const contacts = await listContactsByCustomer(customerId);
    return NextResponse.json({ success: true, data: contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list contacts';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission('customers:update')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const body = await request.json();
    const parsed = CreateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const contact = await createContact({
      customerId: parsed.data.customerId,
      contactName: parsed.data.contactName ?? null,
      contactName2: parsed.data.contactName2 ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email && parsed.data.email !== '' ? parsed.data.email : null,
      roleCd: parsed.data.roleCd ?? null,
      isPrimary: parsed.data.isPrimary ?? false,
    });
    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contact';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
