/**
 * Message Queue Manager
 * Manages queuing and sequential processing of messages
 * @module ui/feedback/utils
 */

import type { MessageType, MessageOptions, MessageResult } from '../types';

export interface QueuedMessage {
  id: string;
  type: MessageType;
  message: string;
  options?: MessageOptions;
  resolve: (result: MessageResult) => void;
  timestamp: number;
}

/**
 * Message Queue Manager
 * Handles queuing and sequential processing of messages
 */
class MessageQueueManager {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private maxSize: number = 5;
  private processingDelay: number = 300; // Delay between messages in ms

  /**
   * Set maximum queue size
   */
  setMaxSize(size: number): void {
    this.maxSize = Math.max(1, size);
  }

  /**
   * Set delay between processing messages
   */
  setProcessingDelay(delay: number): void {
    this.processingDelay = Math.max(0, delay);
  }

  /**
   * Add message to queue
   */
  async enqueue(
    type: MessageType,
    message: string,
    options?: MessageOptions,
    showFn: (type: MessageType, message: string, options?: MessageOptions) => MessageResult | Promise<MessageResult>
  ): Promise<MessageResult> {
    return new Promise<MessageResult>((resolve) => {
      // Check if queue is full
      if (this.queue.length >= this.maxSize) {
        // Remove oldest message
        const removed = this.queue.shift();
        if (removed) {
          removed.resolve({ confirmed: false });
        }
      }

      const queuedMessage: QueuedMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        options,
        resolve,
        timestamp: Date.now(),
      };

      this.queue.push(queuedMessage);

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue(showFn);
      }
    });
  }

  /**
   * Process queue sequentially
   */
  private async processQueue(
    showFn: (type: MessageType, message: string, options?: MessageOptions) => MessageResult | Promise<MessageResult>
  ): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const queuedMessage = this.queue.shift();
      if (!queuedMessage) {
        break;
      }

      try {
        // Show the message
        const result = await Promise.resolve(
          showFn(queuedMessage.type, queuedMessage.message, queuedMessage.options)
        );
        queuedMessage.resolve(result);
      } catch (error) {
        // Resolve with error result
        queuedMessage.resolve({ confirmed: false });
      }

      // Wait before processing next message (if there are more)
      if (this.queue.length > 0 && this.processingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.processingDelay));
      }
    }

    this.processing = false;
  }

  /**
   * Clear all queued messages
   */
  clear(): void {
    const messages = [...this.queue];
    this.queue = [];
    this.processing = false;

    // Resolve all pending messages
    messages.forEach((msg) => {
      msg.resolve({ confirmed: false });
    });
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get all queued messages (for debugging)
   */
  getQueue(): ReadonlyArray<QueuedMessage> {
    return [...this.queue];
  }
}

export const messageQueue = new MessageQueueManager();

