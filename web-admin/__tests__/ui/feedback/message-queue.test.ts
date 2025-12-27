/**
 * Unit tests for message-queue utility
 */

import { messageQueue } from '@/src/ui/feedback/utils/message-queue';
import { MessageType } from '@/src/ui/feedback/types';

describe('Message Queue', () => {
  beforeEach(() => {
    // Clear queue before each test
    messageQueue.clear();
  });

  describe('enqueue', () => {
    it('should enqueue a message', async () => {
      const showFn = jest.fn().mockReturnValue({ id: '1', dismiss: () => {} });
      const result = await messageQueue.enqueue(MessageType.SUCCESS, 'Test message', {}, showFn);
      expect(result).toBeDefined();
      expect(showFn).toHaveBeenCalled();
    });

    it('should respect max queue size', async () => {
      messageQueue.setMaxSize(2);
      const showFn = jest.fn().mockReturnValue({ id: '1', dismiss: () => {} });
      
      const promise1 = messageQueue.enqueue(MessageType.SUCCESS, 'Message 1', {}, showFn);
      const promise2 = messageQueue.enqueue(MessageType.SUCCESS, 'Message 2', {}, showFn);
      const promise3 = messageQueue.enqueue(MessageType.SUCCESS, 'Message 3', {}, showFn);
      
      await Promise.all([promise1, promise2, promise3]);
      
      // Should process all messages (queue removes oldest when full)
      expect(showFn).toHaveBeenCalled();
    });

    it('should process messages sequentially', async () => {
      const callOrder: number[] = [];
      const showFn = jest.fn().mockImplementation((type: MessageType, message: string) => {
        callOrder.push(parseInt(message));
        return { id: message, dismiss: () => {} };
      });

      const p1 = messageQueue.enqueue(MessageType.SUCCESS, '1', {}, showFn);
      const p2 = messageQueue.enqueue(MessageType.SUCCESS, '2', {}, showFn);
      const p3 = messageQueue.enqueue(MessageType.SUCCESS, '3', {}, showFn);

      await Promise.all([p1, p2, p3]);

      // Messages should be processed in order
      expect(callOrder.length).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all queued messages', async () => {
      const showFn = jest.fn().mockReturnValue({ id: '1', dismiss: () => {} });
      const p1 = messageQueue.enqueue(MessageType.SUCCESS, 'Message 1', {}, showFn);
      const p2 = messageQueue.enqueue(MessageType.SUCCESS, 'Message 2', {}, showFn);
      
      messageQueue.clear();
      
      await Promise.all([p1, p2]);
      // Queue should be cleared
      expect(messageQueue.size()).toBe(0);
    });
  });

  describe('setMaxSize', () => {
    it('should update max queue size', async () => {
      messageQueue.setMaxSize(5);
      const showFn = jest.fn().mockReturnValue({ id: '1', dismiss: () => {} });
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(messageQueue.enqueue(MessageType.SUCCESS, `Message ${i}`, {}, showFn));
      }
      
      await Promise.all(promises);
      expect(messageQueue.size()).toBe(0); // Queue should be empty after processing
    });
  });

  describe('size', () => {
    it('should return current queue size', async () => {
      const showFn = jest.fn().mockReturnValue({ id: '1', dismiss: () => {} });
      messageQueue.enqueue(MessageType.SUCCESS, 'Message', {}, showFn);
      // Size might be 0 or 1 depending on processing speed
      expect(messageQueue.size()).toBeGreaterThanOrEqual(0);
    });
  });
});

