import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/middleware/require-permission';
import { getWorkflowScreenContract } from '@/lib/services/workflow-profile.service';

/**
 * GET /api/v1/workflows/screens/[screen]/contract
 * Returns the effective tenant-aware screen contract configuration.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ screen: string }> }
) {
  try {
    // Tenant resolved server-side from authenticated session.
    const { tenantId } = await getAuthContext();
    const { screen } = await params;
    const contract = await getWorkflowScreenContract(tenantId, screen);

    return NextResponse.json({
      screen,
      preConditions: contract,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

