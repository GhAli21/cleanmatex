/**
 * WhatsApp Business API Client
 * Integration with Meta WhatsApp Business API for receipt delivery
 * PRD-006: Digital Receipts
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { logger } from '@/lib/utils/logger';
import { WhatsAppDeliveryError, WhatsAppAPIError, WhatsAppRateLimitError } from '@/lib/services/receipt-service';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

export interface SendTextMessageParams {
  to: string;
  message: string;
  tenantId: string;
}

export interface SendImageMessageParams {
  to: string;
  imageUrl: string;
  caption?: string;
  tenantId: string;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  parameters?: string[];
  tenantId: string;
}

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppClient {
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.config.apiVersion = config.apiVersion || 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}`;
  }

  /**
   * Send text message via WhatsApp
   */
  async sendTextMessage(
    params: SendTextMessageParams
  ): Promise<WhatsAppMessageResult> {
    try {
      const { to, message, tenantId } = params;

      logger.info('Sending WhatsApp text message', {
        tenantId,
        to: this.maskPhoneNumber(to),
        feature: 'whatsapp',
        action: 'send_text',
      });

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || 'WhatsApp API error';
        const errorCode = data.error?.code;

        // Handle rate limiting
        if (errorCode === 80007 || errorCode === 80008) {
          throw new WhatsAppRateLimitError(
            'WhatsApp API rate limit exceeded',
            { tenantId, to: this.maskPhoneNumber(to), retryAfter: data.error?.error_subcode }
          );
        }

        throw new WhatsAppAPIError(errorMessage, {
          tenantId,
          to: this.maskPhoneNumber(to),
          errorCode,
          errorType: data.error?.type,
        });
      }

      logger.info('WhatsApp text message sent successfully', {
        tenantId,
        messageId: data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp text message', error as Error, {
        tenantId: params.tenantId,
        to: this.maskPhoneNumber(params.to),
      });

      if (error instanceof WhatsAppAPIError || error instanceof WhatsAppRateLimitError) {
        throw error;
      }

      throw new WhatsAppDeliveryError(
        'Failed to send WhatsApp message',
        { tenantId: params.tenantId, originalError: (error as Error).message }
      );
    }
  }

  /**
   * Send image message via WhatsApp
   */
  async sendImageMessage(
    params: SendImageMessageParams
  ): Promise<WhatsAppMessageResult> {
    try {
      const { to, imageUrl, caption, tenantId } = params;

      logger.info('Sending WhatsApp image message', {
        tenantId,
        to: this.maskPhoneNumber(to),
        feature: 'whatsapp',
        action: 'send_image',
      });

      // First, upload media if it's a local URL
      let mediaId: string | undefined;
      if (!imageUrl.startsWith('http')) {
        // Upload media to WhatsApp
        mediaId = await this.uploadMedia(imageUrl, tenantId);
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'image',
          image: mediaId
            ? { id: mediaId }
            : {
                link: imageUrl,
                caption: caption || '',
              },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || 'WhatsApp API error';
        throw new WhatsAppAPIError(errorMessage, {
          tenantId,
          to: this.maskPhoneNumber(to),
          errorCode: data.error?.code,
        });
      }

      logger.info('WhatsApp image message sent successfully', {
        tenantId,
        messageId: data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp image message', error as Error, {
        tenantId: params.tenantId,
        to: this.maskPhoneNumber(params.to),
      });

      if (error instanceof WhatsAppAPIError || error instanceof WhatsAppRateLimitError) {
        throw error;
      }

      throw new WhatsAppDeliveryError(
        'Failed to send WhatsApp image',
        { tenantId: params.tenantId, originalError: (error as Error).message }
      );
    }
  }

  /**
   * Send template message via WhatsApp
   */
  async sendTemplateMessage(
    params: SendTemplateMessageParams
  ): Promise<WhatsAppMessageResult> {
    try {
      const { to, templateName, languageCode, parameters = [], tenantId } = params;

      logger.info('Sending WhatsApp template message', {
        tenantId,
        to: this.maskPhoneNumber(to),
        templateName,
        feature: 'whatsapp',
        action: 'send_template',
      });

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.formatPhoneNumber(to),
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: parameters.length > 0
              ? [
                  {
                    type: 'body',
                    parameters: parameters.map((param) => ({
                      type: 'text',
                      text: param,
                    })),
                  },
                ]
              : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || 'WhatsApp API error';
        throw new WhatsAppAPIError(errorMessage, {
          tenantId,
          to: this.maskPhoneNumber(to),
          errorCode: data.error?.code,
        });
      }

      logger.info('WhatsApp template message sent successfully', {
        tenantId,
        messageId: data.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp template message', error as Error, {
        tenantId: params.tenantId,
        to: this.maskPhoneNumber(params.to),
      });

      if (error instanceof WhatsAppAPIError || error instanceof WhatsAppRateLimitError) {
        throw error;
      }

      throw new WhatsAppDeliveryError(
        'Failed to send WhatsApp template',
        { tenantId: params.tenantId, originalError: (error as Error).message }
      );
    }
  }

  /**
   * Upload media to WhatsApp
   */
  private async uploadMedia(
    mediaUrl: string,
    tenantId: string
  ): Promise<string> {
    try {
      // Fetch the media file
      const mediaResponse = await fetch(mediaUrl);
      const mediaBlob = await mediaResponse.blob();

      // Upload to WhatsApp
      const formData = new FormData();
      formData.append('file', mediaBlob);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', 'image');

      const uploadResponse = await fetch(
        `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
          body: formData,
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new WhatsAppAPIError('Failed to upload media', {
          tenantId,
          errorCode: uploadData.error?.code,
        });
      }

      return uploadData.id;
    } catch (error) {
      logger.error('Failed to upload media to WhatsApp', error as Error, {
        tenantId,
      });
      throw new WhatsAppAPIError('Media upload failed', {
        tenantId,
        originalError: (error as Error).message,
      });
    }
  }

  /**
   * Format phone number for WhatsApp (remove +, spaces, etc.)
   */
  private formatPhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Mask phone number for logging (privacy)
   */
  private maskPhoneNumber(phone: string): string {
    const formatted = this.formatPhoneNumber(phone);
    if (formatted.length <= 4) {
      return '****';
    }
    return `${formatted.slice(0, 2)}****${formatted.slice(-2)}`;
  }

  /**
   * Retry logic with exponential backoff
   */
  async sendWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on rate limit errors immediately
        if (error instanceof WhatsAppRateLimitError) {
          const retryAfter = (error.details?.retryAfter as number) || 60;
          await this.delay(retryAfter * 1000);
          continue;
        }

        // Don't retry on non-retryable errors
        if (error instanceof WhatsAppAPIError) {
          const errorCode = error.details?.errorCode as number;
          if (errorCode && [100, 131047, 131026].includes(errorCode)) {
            throw error; // Non-retryable errors
          }
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create WhatsApp client from environment variables
 */
export function createWhatsAppClient(tenantId: string): WhatsAppClient | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    logger.warn('WhatsApp credentials not configured', {
      tenantId,
      feature: 'whatsapp',
    });
    return null;
  }

  return new WhatsAppClient({
    phoneNumberId,
    accessToken,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  });
}

