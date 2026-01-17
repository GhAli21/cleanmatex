/**
 * CSRF Token API Route
 * 
 * GET /api/auth/csrf-token
 * Returns the CSRF token from cookies for client-side use
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCSRFTokenFromRequest } from '@/lib/security/csrf';

export async function GET(request: NextRequest) {
  try {
    // Get CSRF token from request cookies
    const token = getCSRFTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: 'CSRF token not found' },
        { status: 404 }
      );
    }

    // Return token (client will use this in X-CSRF-Token header)
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get CSRF token' },
      { status: 500 }
    );
  }
}

