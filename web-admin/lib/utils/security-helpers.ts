/**
 * Security Helpers
 * 
 * Utilities for input sanitization and XSS prevention.
 * Provides type-safe functions for sanitizing user inputs before processing.
 * 
 * @module security-helpers
 */

/**
 * Sanitizes a string input by removing potentially dangerous characters
 * 
 * @param input - String to sanitize
 * @returns Sanitized string safe for database storage and display
 * 
 * @example
 * ```ts
 * const safe = sanitizeInput(userInput);
 * ```
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers (onclick, onerror, etc.)
        .trim();
}

/**
 * Sanitizes a string for use in HTML attributes
 * 
 * @param input - String to sanitize
 * @returns Sanitized string safe for HTML attributes
 */
export function sanitizeForAttribute(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    return sanitizeInput(input)
        .replace(/"/g, '&quot;') // Escape double quotes
        .replace(/'/g, '&#x27;') // Escape single quotes
        .replace(/\//g, '&#x2F;'); // Escape forward slash
}

/**
 * Validates and sanitizes a numeric input
 * 
 * @param value - Value to validate and sanitize
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @returns Sanitized number or null if invalid
 */
export function sanitizeNumber(
    value: unknown,
    min?: number,
    max?: number
): number | null {
    if (typeof value === 'number') {
        if (isNaN(value) || !isFinite(value)) {
            return null;
        }
        if (min !== undefined && value < min) {
            return null;
        }
        if (max !== undefined && value > max) {
            return null;
        }
        return value;
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || !isFinite(parsed)) {
            return null;
        }
        if (min !== undefined && parsed < min) {
            return null;
        }
        if (max !== undefined && parsed > max) {
            return null;
        }
        return parsed;
    }

    return null;
}

/**
 * Validates and sanitizes a UUID string
 * 
 * @param value - Value to validate
 * @returns Sanitized UUID or null if invalid
 */
export function sanitizeUUID(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const trimmed = value.trim();

    if (uuidRegex.test(trimmed)) {
        return trimmed.toLowerCase();
    }

    return null;
}

/**
 * Sanitizes an array of strings
 * 
 * @param inputs - Array of strings to sanitize
 * @returns Array of sanitized strings
 */
export function sanitizeStringArray(inputs: unknown[]): string[] {
    if (!Array.isArray(inputs)) {
        return [];
    }

    return inputs
        .filter((item): item is string => typeof item === 'string')
        .map(sanitizeInput)
        .filter((item) => item.length > 0);
}

/**
 * Sanitizes order notes (allows some formatting but removes dangerous content)
 * 
 * @param notes - Notes string to sanitize
 * @returns Sanitized notes safe for storage and display
 */
export function sanitizeOrderNotes(notes: string): string {
    if (typeof notes !== 'string') {
        return '';
    }

    // Remove script tags and event handlers
    let sanitized = notes
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .trim();

    // Limit length to prevent DoS
    const MAX_NOTES_LENGTH = 5000;
    if (sanitized.length > MAX_NOTES_LENGTH) {
        sanitized = sanitized.substring(0, MAX_NOTES_LENGTH);
    }

    return sanitized;
}

