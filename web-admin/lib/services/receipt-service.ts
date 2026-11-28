/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */
/**
 * ReceiptService
 * Core business logic for Digital Receipts operations
 * PRD-006: Digital Receipts
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { formatMoneyAmountWithCode, formatUnitPriceWithCode } from '@/lib/money/format-money';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { getPublicTrackingPathForOrderId } from '@/lib/services/public-order-tracking.service';
import { buildAbsolutePublicTrackingUrl } from '@/lib/utils/public-order-tracking';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/errors/base-errors';
import { catalogReadClient } from '@/lib/supabase/catalog-read'
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { renderChannelTemplate } from '@/lib/notifications/template-renderer';
import { IMMEDIATE_SEND_PRIORITY, queueImmediateSendTx } from '@/lib/notifications/immediate-send.service';
import { orderLineQualifiers, qualifierInputOfRow } from '@/lib/orders/line-qualifier';
import { formatLineQualifier, type LineQualifierTranslator } from '@/lib/orders/line-qualifier-format';
import { createTranslator } from 'next-intl';
import { loadLocaleMessages } from '@/lib/i18n/load-locale-messages';
import { loadSpeedNames } from '@/lib/orders/line-qualifier-speed';

/** Notification event of a sent receipt (sys_ntf_events_cd, 0820). */
const RECEIPT_EVENT_CODE = 'order.receipt_sent';
/** A second send of the same order and channel within this window returns the first one (double click). */
const RECEIPT_DEDUPE_MS = 30_000;

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
  /** What the receipt message needs: template variables and the customer's addresses. */
  notify?: ReceiptNotifyData;
  error?: string;
}

export interface ReceiptNotifyData {
  orderNumber: string;
  customerName: string;
  totalAmount: string;
  trackingUrl: string;
  phone: string | null;
  email: string | null;
}

export interface SendReceiptParams {
  orderId: string;
  tenantId: string;
  receiptTypeCode: string;
  deliveryChannels: string[];
  language?: string;
}

export interface ReceiptChannelSend {
  channel: string;
  /** Outbox row of the message (email / WhatsApp); follow it with GET /api/v1/notifications/outbox/[id]/status. */
  outboxId?: string;
  /** Why nothing was queued, e.g. NO_RECIPIENT_ADDRESS. */
  error?: string;
}

export interface SendReceiptResult {
  success: boolean;
  receiptIds?: string[];
  sends?: ReceiptChannelSend[];
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

      // Get order with customer and items (include service prefs for receipt placeholders)
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
            id,
            product_id,
            uom_code,
            uom_dimension,
            uom_symbol,
            uom_symbol2,
            uom_qty_decimals,
            measured_qty,
            billed_qty,
            min_billable_qty,
            billing_increment,
            price_per_unit,
            service_speed,
            product_name,
            product_name2,
            quantity,
            total_price,
            line_total_amount,
            packing_pref_code,
            service_pref_charge,
            service_prefs:org_order_preferences_dtl(
              preference_code,
              extra_price
            )
          )
        `
        )
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (orderError || !order) {
        throw new Error('Order not found');
      }

      // Line qualifier (measure, own speed, ordinal) tells same-name lines apart; formatted once, in the receipt language.
      const speedNames = await loadSpeedNames((order.items ?? []).map((i: { service_speed?: string | null }) => i.service_speed), supabase);
      const qualifiers = orderLineQualifiers((order.items ?? []).map(qualifierInputOfRow), order.service_speed, speedNames);
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

      // Compute eco score (requires DB lookup)
      const ecoScore = await this.getOrderEcoScore(supabase, order);

      const tenantSettings = createTenantSettingsService(supabase);
      const orderBranch = (order as { branch_id?: string | null }).branch_id ?? undefined;
      const moneyCfg = await tenantSettings.getCurrencyConfig(tenantId, orderBranch, null);
      const decimalPlaces =
        Number.isFinite(moneyCfg.decimalPlaces) && moneyCfg.decimalPlaces >= 0
          ? moneyCfg.decimalPlaces
          : ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
      // B15: getCurrencyConfig fails loudly when unconfigured — no fallback.
      const currencyCode = moneyCfg.currencyCode;
      const moneyOpts = { ecoScore, decimalPlaces, currencyCode };

      // Wording of the line qualifier follows the receipt language, not the staff member's screen.
      const textLocale = language === 'ar' ? 'ar' : 'en';
      const tUom = createTranslator({ locale: textLocale, messages: await loadLocaleMessages(textLocale), namespace: 'uom' });
      order.items = (order.items ?? []).map((item) => ({
        ...item,
        qualifier_text: formatLineQualifier(qualifiers.get(item.id), {
          locale: textLocale,
          t: tUom as unknown as LineQualifierTranslator,
          formatUnitPrice: (price) => formatUnitPriceWithCode(price, { currencyCode, decimalPlaces, locale: textLocale }),
        }),
      }));

      // Replace template placeholders
      const contentText = this.replaceTemplatePlaceholders(
        template.template_content,
        order,
        language,
        moneyOpts
      );

      // Generate HTML version (basic)
      const contentHtml = this.generateHtmlReceipt(order, language, {
        decimalPlaces,
        currencyCode,
      });

      const publicTrackingPath = await getPublicTrackingPathForOrderId({
        tenantId,
        orderId,
      });
      const publicTrackingUrl = buildAbsolutePublicTrackingUrl(
        process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleanmatex.com',
        publicTrackingPath || '/',
      );

      // Generate QR code
      const qrCode = await this.generateQRCode(publicTrackingUrl, tenantId);

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

      const customer = (order.customer ?? {}) as { customer_name?: string | null; customer_name2?: string | null; phone?: string | null; email?: string | null };
      return {
        success: true,
        receiptId: receipt.id,
        contentText,
        contentHtml,
        qrCode,
        notify: {
          orderNumber: order.order_no || '',
          customerName: (language === 'ar' ? customer.customer_name2 || customer.customer_name : customer.customer_name) || '',
          // The order snapshot total, in the order's own currency (order-fin-rules §1).
          totalAmount: formatMoneyAmountWithCode(Number(order.total_amount ?? 0), {
            currencyCode: order.currency_code ?? currencyCode, decimalPlaces, locale: language === 'ar' ? 'ar' : 'en',
          }),
          trackingUrl: publicTrackingUrl,
          phone: customer.phone || null,
          email: customer.email || null,
        },
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

      const receiptId = generateResult.receiptId;
      const sends: ReceiptChannelSend[] = [];
      for (const channel of deliveryChannels) {
        if (channel === 'app') {
          // In-app receipts are already available
          await this.updateReceiptStatus(receiptId, tenantId, 'delivered');
          sends.push({ channel });
          continue;
        }
        if (channel !== 'whatsapp' && channel !== 'email') {
          sends.push({ channel, error: 'UNSUPPORTED_CHANNEL' });
          continue;
        }
        try {
          const outboxId = await this.queueReceiptMessage(tenantId, orderId, receiptId, channel, language, generateResult);
          sends.push(outboxId ? { channel, outboxId } : { channel, error: 'NO_RECIPIENT_ADDRESS' });
        } catch (channelError) {
          logger.error(`Failed to queue receipt via ${channel}`, channelError as Error, { tenantId, orderId, channel });
          sends.push({ channel, error: 'QUEUE_FAILED' });
        }
      }
      if (sends.some((x) => x.outboxId)) await this.updateReceiptStatus(receiptId, tenantId, 'queued');

      return {
        success: true,
        receiptIds: [receiptId],
        sends,
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
    language: string,
    opts: { ecoScore: number; decimalPlaces: number; currencyCode: string }
  ): string {
    const customer = order.customer || {};
    const items = order.items || [];

    const preferencesSummary = this.formatPreferencesSummary(items);
    const servicePrefCharge = this.calculateServicePrefCharge(items);
    const moneyLocale = language === 'ar' ? 'ar' : 'en';

    const replacements: Record<string, string> = {
      '{{orderNumber}}': order.order_no || '',
      '{{customerName}}':
        language === 'ar'
          ? customer.customer_name2 || customer.customer_name || ''
          : customer.customer_name || '',
      '{{orderDate}}': new Date(order.created_at).toLocaleDateString(),
      '{{total}}': order.total_amount?.toString() ?? '0',
      '{{items}}': this.formatItemsList(items, language, opts),
      '{{preferences_summary}}': preferencesSummary,
      '{{service_pref_charge}}': formatMoneyAmountWithCode(servicePrefCharge, {
        currencyCode: opts.currencyCode,
        decimalPlaces: opts.decimalPlaces,
        locale: moneyLocale,
      }),
      '{{eco_score}}': opts.ecoScore.toString(),
    };

    let content = template;
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    return content;
  }

  /**
   * Format preferences summary for receipt (service prefs + packing)
   */
  private static formatPreferencesSummary(items: any[]): string {
    const parts: string[] = [];
    for (const item of items) {
      const prefs = item.service_prefs as Array<{ preference_code: string }> | undefined;
      if (prefs && prefs.length > 0) {
        parts.push(...prefs.map((p) => p.preference_code));
      }
      if (item.packing_pref_code) {
        parts.push(`Packing: ${item.packing_pref_code}`);
      }
    }
    return [...new Set(parts)].join(', ') || '—';
  }

  /**
   * Calculate total service preference charge from items
   */
  private static calculateServicePrefCharge(items: any[]): number {
    return items.reduce(
      (sum, item) => sum + (Number(item.service_pref_charge) || 0),
      0
    );
  }

  /**
   * Get eco/sustainability score from order prefs (service + packing).
   * Sums sustainability_score from sys_service_preference_cd and sys_packing_preference_cd.
   */
  private static async getOrderEcoScore(
    supabase: Awaited<ReturnType<typeof createClient>>,
    order: any
  ): Promise<number> {
    const items = order.items || [];
    const servicePrefCodes = new Set<string>();
    const packingPrefCodes = new Set<string>();
    for (const item of items) {
      const prefs = item.service_prefs as Array<{ preference_code: string }> | undefined;
      if (prefs) {
        prefs.forEach((p) => servicePrefCodes.add(p.preference_code));
      }
      if (item.packing_pref_code) {
        packingPrefCodes.add(item.packing_pref_code);
      }
    }
    let total = 0;
    if (servicePrefCodes.size > 0) {
      const { data: servicePrefs } = await catalogReadClient(supabase)
        .from('sys_service_preference_cd')
        .select('sustainability_score')
        .in('code', Array.from(servicePrefCodes));
      total += (servicePrefs ?? []).reduce((s, p) => s + (Number(p.sustainability_score) || 0), 0);
    }
    if (packingPrefCodes.size > 0) {
      const { data: packingPrefs } = await catalogReadClient(supabase)
        .from('sys_packing_preference_cd')
        .select('sustainability_score')
        .in('code', Array.from(packingPrefCodes));
      total += (packingPrefs ?? []).reduce((s, p) => s + (Number(p.sustainability_score) || 0), 0);
    }
    return total;
  }

  /**
   * Format items list for receipt
   */
  private static formatItemsList(items: any[], language: string, money: { decimalPlaces: number; currencyCode: string }): string {
    return items
      .map((item) => {
        const name =
          language === 'ar'
            ? item.product_name2 || item.product_name || ''
            : item.product_name || '';
        return `${name}${item.qualifier_text ? ` · ${item.qualifier_text}` : ''} x${item.quantity} - ${this.formatLineAmount(item, language, money)}`;
      })
      .join('\n');
  }

  /**
   * What the customer pays for a line: after its discounts and with its tax.
   * An older line with no stored total shows its gross.
   */
  private static formatLineAmount(item: any, language: string, money: { decimalPlaces: number; currencyCode: string }): string {
    return formatMoneyAmountWithCode(Number(item.line_total_amount ?? item.total_price ?? 0), {
      currencyCode: money.currencyCode,
      decimalPlaces: money.decimalPlaces,
      locale: language === 'ar' ? 'ar' : 'en',
    });
  }

  /**
   * Generate HTML receipt
   */
  private static generateHtmlReceipt(
    order: any,
    language: string,
    money: { decimalPlaces: number; currencyCode: string }
  ): string {
    const customer = order.customer || {};
    const items = order.items || [];
    const isRTL = language === 'ar';
    const moneyLocale = language === 'ar' ? 'ar' : 'en';
    const prefChargeFmt = formatMoneyAmountWithCode(this.calculateServicePrefCharge(items), {
      currencyCode: money.currencyCode,
      decimalPlaces: money.decimalPlaces,
      locale: moneyLocale,
    });

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
            <p>${isRTL ? item.product_name2 || item.product_name : item.product_name}${item.qualifier_text ? ` · ${item.qualifier_text}` : ''} x${item.quantity} - ${this.formatLineAmount(item, language, money)}</p>
          `).join('')}
        </div>
        ${this.formatPreferencesSummary(items) !== '—' ? `
        <div class="preferences">
          <p><strong>${isRTL ? 'التفضيلات' : 'Preferences'}:</strong> ${this.formatPreferencesSummary(items)}</p>
        </div>
        ` : ''}
        ${this.calculateServicePrefCharge(items) > 0 ? `
        <div class="service-pref-charge">
          <p><strong>${isRTL ? 'خدمات إضافية' : 'Additional Services'}:</strong> ${prefChargeFmt}</p>
        </div>
        ` : ''}
        <div class="total">
          <p>${isRTL ? 'المجموع' : 'Total'}: ${order.total_amount}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate QR code for order tracking
   */
  private static async generateQRCode(
    trackingUrl: string,
    tenantId: string
  ): Promise<string> {
    const { generateQRCode } = await import('@/lib/utils/qr-code-generator');
    return generateQRCode(trackingUrl, tenantId);
  }

  /**
   * Queues one receipt message (email or WhatsApp) through the notification outbox; HQ API sends it.
   * The outbox source is the order, so WhatsApp uses the order customer's opt-in and an HQ route of
   * order.receipt_sent (approved template; text only, no QR image). Returns null when the customer
   * has no address for the channel.
   */
  private static async queueReceiptMessage(
    tenantId: string,
    orderId: string,
    receiptId: string,
    channel: 'whatsapp' | 'email',
    language: string,
    generated: GenerateReceiptResult,
  ): Promise<string | null> {
    const notify = generated.notify;
    const channelCode = channel === 'email' ? 'EMAIL' : 'WHATSAPP';
    const address = channelCode === 'EMAIL' ? notify?.email : notify?.phone;
    if (!notify || !address) return null;

    const vars = {
      order_number: notify.orderNumber,
      customer_name: notify.customerName,
      total_amount: notify.totalAmount,
      tracking_url: notify.trackingUrl,
    };
    const rendered = await renderChannelTemplate(RECEIPT_EVENT_CODE, channelCode, vars);
    const arabic = language === 'ar';

    return withTenantContext(tenantId, () => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`receipt:${tenantId}:${orderId}:${channelCode}`}::text, 0))`;
      const recent = await tx.org_ntf_outbox_dtl.findFirst({
        where: {
          tenant_org_id: tenantId,
          event_code: RECEIPT_EVENT_CODE,
          source_entity_type: 'order',
          source_entity_id: orderId,
          channel_code: channelCode,
          scheduled_at: { gt: new Date(Date.now() - RECEIPT_DEDUPE_MS) },
        },
        orderBy: { scheduled_at: 'desc' },
        select: { id: true },
      });
      if (recent) return recent.id;
      return queueImmediateSendTx(tx, {
        tenantOrgId: tenantId,
        channel: channelCode,
        recipientAddress: address,
        eventCode: RECEIPT_EVENT_CODE,
        sourceEntityType: 'order',
        sourceEntityId: orderId,
        idempotencyKey: `receipt:${receiptId}:${channelCode}`,
        subject: (arabic && rendered.title2) || rendered.title,
        // Email carries the receipt itself; WhatsApp is sent from the HQ template with `metadata`.
        body: channelCode === 'EMAIL' ? generated.contentHtml || '' : (arabic && rendered.body2) || rendered.body,
        metadata: { variables: vars, receipt_id: receiptId },
        maxRetries: 3,
        createdBy: 'receipts',
      }, IMMEDIATE_SEND_PRIORITY.RECEIPT);
    }));
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

