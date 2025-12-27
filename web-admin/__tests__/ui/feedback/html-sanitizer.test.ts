/**
 * Unit tests for html-sanitizer utility
 */

import { sanitizeHtml, containsHtml } from '@/src/ui/feedback/utils/html-sanitizer';

describe('HTML Sanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const html = '<p>Safe paragraph</p>';
      const result = sanitizeHtml(html);
      expect(result).toContain('Safe paragraph');
      expect(result).toContain('<p>');
    });

    it('should remove script tags', () => {
      const html = '<p>Safe</p><script>alert("XSS")</script>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const html = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('onclick');
    });

    it('should remove iframe tags', () => {
      const html = '<p>Safe</p><iframe src="evil.com"></iframe>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<iframe>');
    });

    it('should allow anchor tags with href', () => {
      const html = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<a');
      expect(result).toContain('href');
    });

    it('should preserve allowed attributes', () => {
      const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
      const result = sanitizeHtml(html);
      expect(result).toContain('href');
      expect(result).toContain('target');
      expect(result).toContain('rel');
    });

    it('should remove disallowed attributes', () => {
      const html = '<div data-custom="value" onclick="alert()">Content</div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('data-custom');
      expect(result).not.toContain('onclick');
    });

    it('should handle empty string', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle plain text', () => {
      const text = 'Plain text without HTML';
      const result = sanitizeHtml(text);
      expect(result).toBe(text);
    });

    it('should preserve nested structure', () => {
      const html = '<div><p>Paragraph</p><ul><li>Item</li></ul></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<div>');
      expect(result).toContain('<p>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });
  });

  describe('containsHtml', () => {
    it('should detect HTML tags', () => {
      expect(containsHtml('<p>Hello</p>')).toBe(true);
      expect(containsHtml('<div>Content</div>')).toBe(true);
      expect(containsHtml('<a href="#">Link</a>')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(containsHtml('Plain text')).toBe(false);
      expect(containsHtml('No tags here')).toBe(false);
    });

    it('should detect self-closing tags', () => {
      expect(containsHtml('Line<br/>break')).toBe(true);
      expect(containsHtml('Image<img src="test.jpg"/>')).toBe(true);
    });

    it('should handle empty string', () => {
      expect(containsHtml('')).toBe(false);
    });

    it('should detect HTML in mixed content', () => {
      expect(containsHtml('Text <span>with</span> HTML')).toBe(true);
    });
  });
});

