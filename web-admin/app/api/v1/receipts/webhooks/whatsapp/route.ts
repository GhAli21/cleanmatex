/**
 * Receipts API - WhatsApp Webhook
 * POST /api/v1/receipts/webhooks/whatsapp
 * Handles WhatsApp delivery status webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * Verify webhook signature (for production)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // TODO: Implement webhook signature verification
  // For now, return true (should verify in production)
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-hub-signature-256') || '';

    // Verify webhook (in production, verify signature)
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET || '';
    if (webhookSecret && !verifyWebhookSignature(JSON.stringify(body), signature, webhookSecret)) {
      logger.warn('Invalid webhook signature', {
        feature: 'whatsapp',
        action: 'webhook_verification',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Handle webhook verification challenge
    if (body.object === 'whatsapp_business_account') {
      const mode = request.nextUrl.searchParams.get('hub.mode');
      const token = request.nextUrl.searchParams.get('hub.verify_token');
      const challenge = request.nextUrl.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === webhookSecret) {
        logger.info('Webhook verified', {
          feature: 'whatsapp',
          action: 'webhook_verification',
        });
        return NextResponse.json(challenge, { status: 200 });
      }

      return NextResponse.json(
        { success: false, error: 'Verification failed' },
        { status: 403 }
      );
    }

    // Process webhook events
    const entries = body.entry || [];
    const supabase = await createClient();

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field === 'messages') {
          const value = change.value;

          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const messageId = status.id;
              const statusType = status.status; // sent, delivered, read, failed
              const recipientId = status.recipient_id;

              logger.info('WhatsApp message status update', {
                messageId,
                statusType,
                recipientId: recipientId?.substring(0, 4) + '****',
                feature: 'whatsapp',
                action: 'status_update',
              });

              // Find receipt by message ID in metadata
              const { data: receipts } = await supabase
                .from('org_rcpt_receipts_mst')
                .select('id, tenant_org_id')
                .eq('delivery_channel_code', 'whatsapp')
                .contains('metadata', { messageId });

              for (const receipt of receipts || []) {
                let deliveryStatus = 'sent';
                if (statusType === 'delivered') {
                  deliveryStatus = 'delivered';
                } else if (statusType === 'failed') {
                  deliveryStatus = 'failed';
                }

                await supabase
                  .from('org_rcpt_receipts_mst')
                  .update({
                    delivery_status_code: deliveryStatus,
                    sent_at:
                      statusType === 'sent'
                        ? new Date(status.timestamp * 1000).toISOString()
                        : undefined,
                    delivered_at:
                      statusType === 'delivered'
                        ? new Date(status.timestamp * 1000).toISOString()
                        : undefined,
                    updated_at: new Date().toISOString(),
                    metadata: {
                      ...(receipt.metadata || {}),
                      lastStatus: statusType,
                      lastStatusUpdate: new Date().toISOString(),
                    },
                  })
                  .eq('id', receipt.id);
              }
            }
          }

          // Handle incoming messages (if needed)
          if (value.messages) {
            // Process incoming messages if needed
            logger.info('Incoming WhatsApp message received', {
              messageCount: value.messages.length,
              feature: 'whatsapp',
              action: 'incoming_message',
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('WhatsApp webhook processing failed', error as Error, {
      feature: 'whatsapp',
      action: 'webhook',
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/receipts/webhooks/whatsapp
 * Webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET || '';

  if (mode === 'subscribe' && token === webhookSecret) {
    logger.info('Webhook verification successful', {
      feature: 'whatsapp',
      action: 'webhook_verification',
    });
    return NextResponse.json(challenge, { status: 200 });
  }

  return NextResponse.json(
    { success: false, error: 'Verification failed' },
    { status: 403 }
  );
}

