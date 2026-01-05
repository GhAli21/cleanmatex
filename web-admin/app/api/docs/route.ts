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

export const maxDuration = 10; // Vercel timeout limit

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API docs generation timeout')), 8000);
    });

    const specPromise = getApiDocs();
    const spec = await Promise.race([specPromise, timeoutPromise]) as any;
    
    const duration = Date.now() - startTime;
    console.log(`[API Docs] Generated in ${duration}ms`);
    
    return NextResponse.json(spec);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Docs] Error after ${duration}ms:`, error);
    
    // Return a minimal spec instead of failing
    return NextResponse.json({
      openapi: '3.0.0',
      info: {
        title: 'CleanMateX API Documentation',
        version: '1.0.0',
        description: error instanceof Error 
          ? `API documentation generation failed: ${error.message}. This is likely due to file scanning issues on Vercel.`
          : 'API documentation is being generated. Please try again in a moment.',
      },
      paths: {},
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    });
  }
}

