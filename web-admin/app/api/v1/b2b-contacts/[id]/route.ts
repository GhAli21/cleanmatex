/**
 * B2B Contact by ID API
 * GET /api/v1/b2b-contacts/:id
 * PATCH /api/v1/b2b-contacts/:id
 * DELETE /api/v1/b2b-contacts/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  updateContact,
  deleteContact,
} from '@/lib/services/b2b-contacts.service';
import { z } from 'zod';

const UpdateContactSchema = z.object({
  contactName: z.string().optional(),
  contactName2: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  roleCd: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('b2b_contacts:view')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const supabase = await createClient();
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('org_b2b_contacts_dtl')
      .select('*')
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const contact = {
      id: data.id,
      tenantOrgId: data.tenant_org_id,
      customerId: data.customer_id,
      contactName: data.contact_name ?? null,
      contactName2: data.contact_name2 ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      roleCd: data.role_cd ?? null,
      isPrimary: Boolean(data.is_primary),
      recStatus: Number(data.rec_status) ?? 1,
      isActive: Boolean(data.is_active),
      createdAt: data.created_at ?? null,
      createdBy: data.created_by ?? null,
      updatedAt: data.updated_at ?? null,
      updatedBy: data.updated_by ?? null,
    };
    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get contact';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('b2b_contacts:create')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const contact = await updateContact(id, {
      contactName: parsed.data.contactName,
      contactName2: parsed.data.contactName2,
      phone: parsed.data.phone,
      email: parsed.data.email && parsed.data.email !== '' ? parsed.data.email : null,
      roleCd: parsed.data.roleCd,
      isPrimary: parsed.data.isPrimary,
    });
    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contact';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requirePermission('b2b_contacts:create')(request);
    if (authCheck instanceof NextResponse) return authCheck;

    const { id } = await params;
    await deleteContact(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete contact';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
