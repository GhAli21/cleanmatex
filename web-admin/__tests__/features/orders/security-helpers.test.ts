/**
 * Unit Tests: Security Helpers
 * Tests for input sanitization and XSS prevention
 */

import {
  sanitizeInput,
  sanitizeForAttribute,
  sanitizeNumber,
  sanitizeUUID,
  sanitizeStringArray,
  sanitizeOrderNotes,
} from '@/lib/utils/security-helpers';

describe('Security Helpers', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('alert("XSS")');
      expect(sanitizeInput('<div>Hello</div>')).toBe('Hello');
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('onclick="alert(1)"')).toBe('alert(1)"');
      expect(sanitizeInput('onerror="bad()"')).toBe('bad()"');
    });

    it('should remove javascript protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeInput(null as unknown as string)).toBe('');
      expect(sanitizeInput(123 as unknown as string)).toBe('');
    });
  });

  describe('sanitizeForAttribute', () => {
    it('should escape quotes', () => {
      expect(sanitizeForAttribute('hello"world')).toContain('&quot;');
      expect(sanitizeForAttribute("hello'world")).toContain('&#x27;');
    });

    it('should escape forward slash', () => {
      expect(sanitizeForAttribute('path/to/file')).toContain('&#x2F;');
    });
  });

  describe('sanitizeNumber', () => {
    it('should validate and return valid numbers', () => {
      expect(sanitizeNumber(10)).toBe(10);
      expect(sanitizeNumber('10.5')).toBe(10.5);
    });

    it('should enforce min/max constraints', () => {
      expect(sanitizeNumber(5, 1, 10)).toBe(5);
      expect(sanitizeNumber(0, 1, 10)).toBeNull();
      expect(sanitizeNumber(11, 1, 10)).toBeNull();
    });

    it('should reject invalid values', () => {
      expect(sanitizeNumber('not-a-number')).toBeNull();
      expect(sanitizeNumber(NaN)).toBeNull();
      expect(sanitizeNumber(Infinity)).toBeNull();
    });
  });

  describe('sanitizeUUID', () => {
    it('should validate and normalize valid UUIDs', () => {
      const uuid = '123E4567-E89B-12D3-A456-426614174000';
      const result = sanitizeUUID(uuid);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid UUIDs', () => {
      expect(sanitizeUUID('not-a-uuid')).toBeNull();
      expect(sanitizeUUID('123')).toBeNull();
      expect(sanitizeUUID(null)).toBeNull();
    });
  });

  describe('sanitizeStringArray', () => {
    it('should sanitize array of strings', () => {
      const input = ['hello', '<script>bad</script>', 'world'];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['hello', 'bad', 'world']);
    });

    it('should filter out non-string values', () => {
      const input = ['hello', 123, null, 'world'];
      const result = sanitizeStringArray(input as unknown[]);
      expect(result).toEqual(['hello', 'world']);
    });

    it('should filter out empty strings', () => {
      const input = ['hello', '', '   ', 'world'];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['hello', 'world']);
    });
  });

  describe('sanitizeOrderNotes', () => {
    it('should remove script tags', () => {
      const notes = 'Hello <script>alert("XSS")</script> World';
      const result = sanitizeOrderNotes(notes);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const notes = 'Text onclick="bad()" more text';
      const result = sanitizeOrderNotes(notes);
      expect(result).not.toContain('onclick');
    });

    it('should limit length', () => {
      const longNotes = 'a'.repeat(10000);
      const result = sanitizeOrderNotes(longNotes);
      expect(result.length).toBeLessThanOrEqual(5000);
    });

    it('should preserve safe content', () => {
      const notes = 'Regular text with numbers 123 and symbols !@#';
      const result = sanitizeOrderNotes(notes);
      expect(result).toContain('Regular text');
      expect(result).toContain('123');
    });
  });
});

