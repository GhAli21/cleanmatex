/**
 * Generate a clean code from a name (uppercase, no spaces, underscores)
 * Used for customer category codes and similar slug/code fields
 */
export function generateCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}
