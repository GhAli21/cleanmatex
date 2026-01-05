import { getApiDocs } from '@/lib/swagger/swagger.config';
import { NextResponse } from 'next/server';

/**
 * GET /api/docs
 * Returns OpenAPI specification for API documentation
 * 
 * This endpoint is runtime-only and won't break the build process
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spec = await getApiDocs();
    return NextResponse.json(spec);
  } catch (error) {
    console.error('Error generating API docs:', error);
    // Return a minimal spec instead of failing
    return NextResponse.json({
      openapi: '3.0.0',
      info: {
        title: 'CleanMateX API Documentation',
        version: '1.0.0',
        description: 'API documentation is being generated. Please try again in a moment.',
      },
      paths: {},
    });
  }
}

