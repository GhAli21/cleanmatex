import { NextResponse } from 'next/server';
import { z } from 'zod';

export function parseSearchParams(searchParams: URLSearchParams): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}

export function jsonValidationError(error: z.ZodError) {
  return NextResponse.json(
    {
      success: false,
      error: 'Invalid request',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    },
    { status: 400 }
  );
}

export function jsonApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof z.ZodError) {
    return jsonValidationError(error);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const normalized = message.toLowerCase();
  const status =
    normalized.includes('not found') ? 404
    : normalized.includes('unauthorized') ? 401
    : normalized.includes('permission denied') ? 403
    : normalized.includes('required') ||
        normalized.includes('cannot') ||
        normalized.includes('only') ||
        normalized.includes('must') ||
        normalized.includes('invalid') ? 400
    : 500;

  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}
