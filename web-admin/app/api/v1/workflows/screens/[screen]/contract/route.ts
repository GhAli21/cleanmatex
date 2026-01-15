import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/workflows/screens/[screen]/contract
 * Returns screen contract configuration (pre-conditions, permissions)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ screen: string }> }
) {
  try {
    const { screen } = await params;
    const supabase = await createClient();

    const { data: contract, error } = await supabase.rpc(
      'cmx_ord_screen_pre_conditions',
      { p_screen: screen }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      screen,
      preConditions: contract,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

