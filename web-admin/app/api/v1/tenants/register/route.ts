/**
 * POST /api/v1/tenants/register
 * Public endpoint for tenant self-service registration
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerTenant } from '@/lib/services/tenants.service';
import type { TenantRegistrationRequest } from '@/lib/types/tenant';

export async function POST(request: NextRequest) {
  try {
    const body: TenantRegistrationRequest = await request.json();

    // Validate required fields
    const requiredFields = [
      'businessName',
      'slug',
      'email',
      'phone',
      'country',
      'currency',
      'timezone',
      'language',
      'adminUser',
    ];

    for (const field of requiredFields) {
      if (!body[field as keyof TenantRegistrationRequest]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate admin user fields
    if (!body.adminUser.email || !body.adminUser.password || !body.adminUser.displayName) {
      return NextResponse.json(
        { error: 'Admin user email, password, and display name are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email) || !emailRegex.test(body.adminUser.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 chars, 1 uppercase, 1 number, 1 special)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(body.adminUser.password)) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character',
        },
        { status: 400 }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(body.slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Register tenant
    const response = await registerTenant(body);

    return NextResponse.json(
      {
        success: true,
        data: response,
        message: 'Tenant registered successfully. Your 14-day trial has started.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Registration failed';

    // Check for specific error types
    if (errorMessage.includes('already taken') || errorMessage.includes('already registered')) {
      return NextResponse.json({ error: errorMessage }, { status: 409 }); // Conflict
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
