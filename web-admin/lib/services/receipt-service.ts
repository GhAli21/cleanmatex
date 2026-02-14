/**
 * ReceiptService
 * Core business logic for Digital Receipts operations
 * PRD-006: Digital Receipts
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/errors/base-errors';

export class ReceiptGenerationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'RECEIPT_GENERATION_ERROR', 500, details);
  }
}

export class WhatsAppDeliveryError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WHATSAPP_DELIVERY_ERROR', 500, details);
  }
}

export class WhatsAppAPIError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WHATSAPP_API_ERROR', 500, details);
  }
}

export class WhatsAppRateLimitError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'WHATSAPP_RATE_LIMIT_ERROR', 429, details);
  }
}

export class TemplateNotFoundError extends AppError {
  constructor(templateType: string, language: string) {
    super(
      `Receipt template not found: ${templateType} (${language})`,
      'TEMPLATE_NOT_FOUND',
      404,
      { templateType, language }
    );
  }
}

export interface GenerateReceiptParams {
  orderId: string;
  tenantId: string;
  receiptTypeCode: string;
  language?: string;
}

export interface GenerateReceiptResult {
  success: boolean;
  receiptId?: string;
  contentText?: string;
  contentHtml?: string;
  qrCode?: string;
  error?: string;
}

export interface SendReceiptParams {
  orderId: string;
  tenantId: string;
  receiptTypeCode: string;
  deliveryChannels: string[];
  language?: string;
}

export interface SendReceiptResult {
  success: boolean;
  receiptIds?: string[];
  error?: string;
}

export interface GetReceiptsParams {
  orderId: string;
  tenantId: string;
}

export interface ReceiptRecord {
  id: string;
  receiptTypeCode: string;
  deliveryChannelCode: string;
  deliveryStatusCode: string;
  sentAt?: string;
  deliveredAt?: string;
  retryCount: number;
}

export class ReceiptService {
  /**
   * Generate receipt content for an order
   */
  static async generateReceipt(
    params: GenerateReceiptParams
  ): Promise<GenerateReceiptResult> {
    try {
      const { orderId, tenantId, receiptTypeCode, language = 'en' } = params;
      const supabase = await createClient();

      logger.info('Generating receipt', {
        tenantId,
        orderId,
        receiptTypeCode,
        language,
        feature: 'receipts',
        action: 'generate',
      });

      // Get order with customer and items
      const { data: order, error: orderError } = await supabase
        .from('org_orders_mst')
        .select(
          `
          *,
          customer:org_customers_mst(
            customer_name,
            customer_name2,
            phone,
            email
          ),
          items:org_order_items_dtl(
            product_name,
            product_name2,
            quantity,
            total_price
          )
        `
        )
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      // Get template
      const { data: template, error: templateError } = await supabase
        .from('org_rcpt_templates_cf')
        .select('*')
        .eq('tenant_org_id', tenantId)
        .eq('template_type', receiptTypeCode)
        .eq('language', language)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        throw new TemplateNotFoundError(receiptTypeCode, language);
      }

      // Replace template placeholders
      const contentText = this.replaceTemplatePlaceholders(
        template.template_content,
        order,
        language
      );

      // Generate HTML version (basic)
      const contentHtml = this.generateHtmlReceipt(order, language);

      // Generate QR code
      const qrCode = await this.generateQRCode(order.order_no, tenantId);

      // Create receipt record
      const orderWithBranch = order as { branch_id?: string | null };
      const { data: receipt, error: receiptError } = await supabase
        .from('org_rcpt_receipts_mst')
        .insert({
          tenant_org_id: tenantId,
          branch_id: orderWithBranch.branch_id ?? null,
          order_id: orderId,
          receipt_type_code: receiptTypeCode,
          delivery_channel_code: 'app', // Default, will be updated on send
          delivery_status_code: 'pending',
          content_text: contentText,
          content_html: contentHtml,
          qr_code: qrCode,
          recipient_phone: (order.customer as { phone?: string })?.phone || null,
          recipient_email: (order.customer as { email?: string })?.email || null,
        })
        .select('id')
        .single();

      if (receiptError || !receipt) {
        logger.error('Failed to create receipt record', receiptError as Error, {
          tenantId,
          orderId,
        });
        throw new ReceiptGenerationError('Failed to create receipt record');
      }

      logger.info('Receipt generated successfully', {
        tenantId,
        orderId,
        receiptId: receipt.id,
      });

      return {
        success: true,
        receiptId: receipt.id,
        contentText,
        contentHtml,
        qrCode,
      };
    } catch (error) {
      logger.error('Failed to generate receipt', error as Error, {
        tenantId: params.tenantId,
        orderId: params.orderId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send receipt via specified channels
   */
  static async sendReceipt(
    params: SendReceiptParams
  ): Promise<SendReceiptResult> {
    try {
      const {
        orderId,
        tenantId,
        receiptTypeCode,
        deliveryChannels,
        language = 'en',
      } = params;

      logger.info('Sending receipt', {
        tenantId,
        orderId,
        receiptTypeCode,
        deliveryChannels,
        feature: 'receipts',
        action: 'send',
      });

      // Generate receipt if not exists
      const generateResult = await this.generateReceipt({
        orderId,
        tenantId,
        receiptTypeCode,
        language,
      });

      if (!generateResult.success || !generateResult.receiptId) {
        throw new ReceiptGenerationError(
          generateResult.error || 'Failed to generate receipt'
        );
      }

      const receiptIds: string[] = [];

      // Send via each channel
      for (const channel of deliveryChannels) {
        try {
          if (channel === 'whatsapp') {
            await this.sendViaWhatsApp(
              generateResult.receiptId,
              tenantId,
              generateResult.contentText || '',
              generateResult.qrCode
            );
          } else if (channel === 'email') {
            await this.sendViaEmail(
              generateResult.receiptId,
              tenantId,
              generateResult.contentHtml || '',
              generateResult.qrCode
            );
          } else if (channel === 'app') {
            // In-app receipts are already available
            await this.updateReceiptStatus(
              generateResult.receiptId,
              tenantId,
              'delivered'
            );
          }

          receiptIds.push(generateResult.receiptId);
        } catch (channelError) {
          logger.error(`Failed to send via ${channel}`, channelError as Error, {
            tenantId,
            orderId,
            channel,
          });
          // Continue with other channels
        }
      }

      return {
        success: true,
        receiptIds,
      };
    } catch (error) {
      logger.error('Failed to send receipt', error as Error, {
        tenantId: params.tenantId,
        orderId: params.orderId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all receipts for an order
   */
  static async getReceipts(
    params: GetReceiptsParams
  ): Promise<ReceiptRecord[]> {
    try {
      const { orderId, tenantId } = params;
      const supabase = await createClient();

      const { data: receipts, error } = await supabase
        .from('org_rcpt_receipts_mst')
        .select('*')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .eq('rec_status', 1)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch receipts', error as Error, {
          tenantId,
          orderId,
        });
        return [];
      }

      return (
        receipts?.map((r) => ({
          id: r.id,
          receiptTypeCode: r.receipt_type_code,
          deliveryChannelCode: r.delivery_channel_code,
          deliveryStatusCode: r.delivery_status_code,
          sentAt: r.sent_at || undefined,
          deliveredAt: r.delivered_at || undefined,
          retryCount: r.retry_count || 0,
        })) || []
      );
    } catch (error) {
      logger.error('Failed to get receipts', error as Error, {
        tenantId: params.tenantId,
        orderId: params.orderId,
      });
      return [];
    }
  }

  /**
   * Replace template placeholders with order data
   */
  private static replaceTemplatePlaceholders(
    template: string,
    order: any,
    language: string
  ): string {
    const customer = order.customer || {};
    const items = order.items || [];

    const replacements: Record<string, string> = {
      '{{orderNumber}}': order.order_no || '',
      '{{customerName}}':
        language === 'ar'
          ? customer.customer_name2 || customer.customer_name || ''
          : customer.customer_name || '',
      '{{orderDate}}': new Date(order.created_at).toLocaleDateString(),
      '{{total}}': order.total?.toString() || '0',
      '{{items}}': this.formatItemsList(items, language),
    };

    let content = template;
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    return content;
  }

  /**
   * Format items list for receipt
   */
  private static formatItemsList(items: any[], language: string): string {
    return items
      .map((item) => {
        const name =
          language === 'ar'
            ? item.product_name2 || item.product_name || ''
            : item.product_name || '';
        return `${name} x${item.quantity} - ${item.total_price}`;
      })
      .join('\n');
  }

  /**
   * Generate HTML receipt
   */
  private static generateHtmlReceipt(order: any, language: string): string {
    const customer = order.customer || {};
    const items = order.items || [];
    const isRTL = language === 'ar';

    return `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${language}">
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${order.order_no}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .order-info { margin-bottom: 20px; }
          .items { margin-bottom: 20px; }
          .total { font-weight: bold; font-size: 1.2em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isRTL ? 'إيصال' : 'Receipt'}</h1>
        </div>
        <div class="order-info">
          <p><strong>${isRTL ? 'رقم الطلب' : 'Order Number'}:</strong> ${order.order_no}</p>
          <p><strong>${isRTL ? 'التاريخ' : 'Date'}:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
          <p><strong>${isRTL ? 'العميل' : 'Customer'}:</strong> ${isRTL ? customer.customer_name2 || customer.customer_name : customer.customer_name}</p>
        </div>
        <div class="items">
          <h3>${isRTL ? 'العناصر' : 'Items'}</h3>
          ${items.map((item: any) => `
            <p>${isRTL ? item.product_name2 || item.product_name : item.product_name} x${item.quantity} - ${item.total_price}</p>
          `).join('')}
        </div>
        <div class="total">
          <p>${isRTL ? 'المجموع' : 'Total'}: ${order.total}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate QR code for order tracking
   */
  private static async generateQRCode(
    orderNumber: string,
    tenantId: string
  ): Promise<string> {
    const { generateQRCode } = await import('@/lib/utils/qr-code-generator');
    return generateQRCode(orderNumber, tenantId);
  }

  /**
   * Send receipt via WhatsApp
   */
  private static async sendViaWhatsApp(
    receiptId: string,
    tenantId: string,
    content: string,
    qrCode?: string
  ): Promise<void> {
    try {
      const { createWhatsAppClient } = await import('@/lib/integrations/whatsapp-client');
      const { createClient } = await import('@/lib/supabase/server');
      
      const supabase = await createClient();
      
      // Get receipt with order and customer
      const { data: receipt, error: receiptError } = await supabase
        .from('org_rcpt_receipts_mst')
        .select(
          `
          *,
          order:org_orders_mst(
            customer:org_customers_mst(phone)
          )
        `
        )
        .eq('id', receiptId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (receiptError || !receipt) {
        throw new Error('Receipt not found');
      }

      const phoneNumber = (receipt.order as any)?.customer?.phone;
      if (!phoneNumber) {
        throw new WhatsAppDeliveryError('Customer phone number not found', {
          tenantId,
          receiptId,
        });
      }

      const client = createWhatsAppClient(tenantId);
      if (!client) {
        throw new WhatsAppDeliveryError('WhatsApp client not configured', {
          tenantId,
        });
      }

      // Send text message with receipt content
      if (qrCode) {
        // Send image if QR code available
        await client.sendWithRetry(() =>
          client.sendImageMessage({
            to: phoneNumber,
            imageUrl: qrCode,
            caption: content,
            tenantId,
          })
        );
      } else {
        // Send text only
        await client.sendWithRetry(() =>
          client.sendTextMessage({
            to: phoneNumber,
            message: content,
            tenantId,
          })
        );
      }

      // Update receipt status
      await this.updateReceiptStatus(receiptId, tenantId, 'sent');

      logger.info('Receipt sent via WhatsApp successfully', {
        tenantId,
        receiptId,
        phoneNumber: client['maskPhoneNumber'](phoneNumber),
      });
    } catch (error) {
      logger.error('Failed to send receipt via WhatsApp', error as Error, {
        tenantId,
        receiptId,
      });
      
      // Update receipt status to failed
      await this.updateReceiptStatus(receiptId, tenantId, 'failed');
      
      throw error instanceof WhatsAppDeliveryError
        ? error
        : new WhatsAppDeliveryError('Failed to send WhatsApp message', {
            tenantId,
            receiptId,
            originalError: (error as Error).message,
          });
    }
  }

  /**
   * Send receipt via Email
   */
  private static async sendViaEmail(
    receiptId: string,
    tenantId: string,
    htmlContent: string,
    qrCode?: string
  ): Promise<void> {
    try {
      const { sendEmail } = await import('@/lib/notifications/email-sender');
      const { createClient } = await import('@/lib/supabase/server');

      const supabase = await createClient();
      const { data: receipt, error: receiptError } = await supabase
        .from('org_rcpt_receipts_mst')
        .select('recipient_email, order:org_orders_mst(customer:org_customers_mst(email))')
        .eq('id', receiptId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (receiptError || !receipt) {
        throw new Error('Receipt not found');
      }

      const r = receipt as {
        recipient_email?: string | null;
        order?: { customer?: { email?: string | null } } | null;
      };
      const recipientEmail =
        r.recipient_email ||
        r.order?.customer?.email;
      if (!recipientEmail) {
        throw new Error('Customer email not found for receipt');
      }

      const sent = await sendEmail({
        to: recipientEmail,
        subject: 'Your CleanMateX Receipt',
        html: htmlContent,
      });

      if (!sent) {
        throw new Error('Failed to send email');
      }

      await this.updateReceiptStatus(receiptId, tenantId, 'sent');
      logger.info('Receipt sent via Email successfully', {
        tenantId,
        receiptId,
        recipient: recipientEmail.slice(0, 3) + '***',
      });
    } catch (error) {
      logger.error('Failed to send receipt via Email', error as Error, {
        tenantId,
        receiptId,
      });
      await this.updateReceiptStatus(receiptId, tenantId, 'failed');
      throw error;
    }
  }

  /**
   * Update receipt delivery status
   */
  private static async updateReceiptStatus(
    receiptId: string,
    tenantId: string,
    status: string
  ): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from('org_rcpt_receipts_mst')
      .update({
        delivery_status_code: status,
        sent_at: status === 'sent' ? new Date().toISOString() : undefined,
        delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId)
      .eq('tenant_org_id', tenantId);
  }
}

