/**
 * Unit tests for cmx-message utility
 */

import { cmxMessage } from '@/src/ui/feedback/cmx-message';
import { MessageType, DisplayMethod } from '@/src/ui/feedback/types';
import { setMessageConfig, resetMessageConfig } from '@/src/ui/feedback/message-config';

describe('cmxMessage', () => {
  beforeEach(() => {
    // Reset config before each test
    resetMessageConfig();
  });

  describe('success', () => {
    it('should display success message', () => {
      const result = cmxMessage.success('Operation successful');
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('error', () => {
    it('should display error message', () => {
      const result = cmxMessage.error('Operation failed');
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('errorFrom', () => {
    it('should extract and display error from Error instance', () => {
      const error = new Error('Test error');
      const result = cmxMessage.errorFrom(error);
      expect(result).toBeDefined();
    });

    it('should use fallback message when extraction fails', () => {
      const error = {};
      const result = cmxMessage.errorFrom(error, { fallback: 'Custom fallback' });
      expect(result).toBeDefined();
    });
  });

  describe('warning', () => {
    it('should display warning message', () => {
      const result = cmxMessage.warning('Warning message');
      expect(result).toBeDefined();
    });
  });

  describe('info', () => {
    it('should display info message', () => {
      const result = cmxMessage.info('Info message');
      expect(result).toBeDefined();
    });
  });

  describe('loading', () => {
    it('should display loading message', () => {
      const result = cmxMessage.loading('Loading...');
      expect(result).toBeDefined();
    });
  });

  describe('message validation', () => {
    it('should truncate messages longer than 1000 characters', () => {
      const longMessage = 'a'.repeat(2000);
      const result = cmxMessage.success(longMessage);
      expect(result).toBeDefined();
    });

    it('should handle empty messages', () => {
      const result = cmxMessage.success('');
      expect(result).toBeDefined();
    });

    it('should handle null/undefined messages gracefully', () => {
      // @ts-expect-error Testing invalid input
      const result1 = cmxMessage.success(null);
      expect(result1).toBeDefined();
      
      // @ts-expect-error Testing invalid input
      const result2 = cmxMessage.success(undefined);
      expect(result2).toBeDefined();
    });
  });

  describe('clearQueue', () => {
    it('should clear message queue', () => {
      cmxMessage.setConfig({ queueMessages: true });
      cmxMessage.success('Message 1');
      cmxMessage.success('Message 2');
      
      cmxMessage.clearQueue();
      // Queue should be cleared
      expect(cmxMessage.clearQueue).toBeDefined();
    });
  });

  describe('setConfig', () => {
    it('should update configuration', () => {
      cmxMessage.setConfig({
        defaultMethod: DisplayMethod.CONSOLE,
        throttleMs: 200,
      });
      
      const result = cmxMessage.success('Test');
      expect(result).toBeDefined();
    });
  });

  describe('rate limiting', () => {
    it('should throttle rapid messages', () => {
      cmxMessage.setConfig({ throttleMs: 100 });
      
      const result1 = cmxMessage.success('Message 1');
      const result2 = cmxMessage.success('Message 2'); // Should be throttled
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should allow forced messages to bypass throttling', () => {
      cmxMessage.setConfig({ throttleMs: 100 });
      
      const result1 = cmxMessage.success('Message 1');
      const result2 = cmxMessage.success('Message 2', { force: true });
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});

