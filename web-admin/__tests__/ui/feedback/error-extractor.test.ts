/**
 * Unit tests for error-extractor utility
 */

import { extractErrorMessage } from '@/src/ui/feedback/utils/error-extractor';

describe('Error Extractor', () => {
  describe('extractErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      const result = extractErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('should extract message from string', () => {
      const error = 'String error message';
      const result = extractErrorMessage(error);
      expect(result).toBe('String error message');
    });

    it('should extract message from AxiosError-like object', () => {
      const error = {
        response: {
          data: {
            message: 'API error message',
          },
        },
      };
      const result = extractErrorMessage(error);
      expect(result).toBe('API error message');
    });

    it('should extract message from Supabase error', () => {
      const error = {
        message: 'Supabase error',
        details: 'Some details',
      };
      const result = extractErrorMessage(error);
      expect(result).toBe('Supabase error');
    });

    it('should extract message from nested error object', () => {
      const error = {
        error: {
          message: 'Nested error message',
        },
      };
      const result = extractErrorMessage(error);
      expect(result).toBe('Nested error message');
    });

    it('should use fallback message when extraction fails', () => {
      const error = {};
      const fallback = 'Default error message';
      const result = extractErrorMessage(error, { fallback });
      expect(result).toBe(fallback);
    });

    it('should use default fallback when no fallback provided', () => {
      const error = {};
      const result = extractErrorMessage(error);
      expect(result).toBe('An error occurred');
    });

    it('should handle null error', () => {
      const result = extractErrorMessage(null);
      expect(result).toBe('An error occurred');
    });

    it('should handle undefined error', () => {
      const result = extractErrorMessage(undefined);
      expect(result).toBe('An error occurred');
    });

    it('should extract from custom paths', () => {
      const error = {
        customField: 'Custom error message',
      };
      const result = extractErrorMessage(error, {
        extractFrom: ['customField'],
      });
      expect(result).toBe('Custom error message');
    });

    it('should handle Response object (fetch)', () => {
      const error = {
        status: 404,
        statusText: 'Not Found',
      };
      const result = extractErrorMessage(error);
      expect(result).toContain('404');
      expect(result).toContain('Not Found');
    });

    it('should handle number errors', () => {
      const error = 500;
      const result = extractErrorMessage(error);
      expect(result).toBe('500');
    });
  });
});

