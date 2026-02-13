/**
 * DeliveryService
 * Core business logic for Delivery Management & POD operations
 * PRD-013: Delivery Management & POD
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  RouteNotFoundError,
  InvalidOTPError,
  PODCaptureError,
  StopNotFoundError,
} from '@/lib/errors/delivery-errors';
import { WorkflowService } from './workflow-service';

export interface CreateRouteParams {
  orderIds: string[];
  tenantId: string;
  driverId?: string;
  userId: string;
}

export interface CreateRouteResult {
  success: boolean;
  routeId?: string;
  error?: string;
}

export interface AssignDriverParams {
  routeId: string;
  tenantId: string;
  driverId: string;
  userId: string;
}

export interface AssignDriverResult {
  success: boolean;
  error?: string;
}

export interface GenerateOTPParams {
  orderId: string;
  tenantId: string;
  userId: string;
}

export interface GenerateOTPResult {
  success: boolean;
  otpCode?: string;
  error?: string;
}

export interface VerifyOTPParams {
  orderId: string;
  tenantId: string;
  otpCode: string;
}

export interface VerifyOTPResult {
  success: boolean;
  isValid?: boolean;
  error?: string;
}

export interface CapturePODParams {
  stopId: string;
  tenantId: string;
  podMethodCode: string;
  otpCode?: string;
  signatureUrl?: string;
  photoUrls?: string[];
  userId: string;
}

export interface CapturePODResult {
  success: boolean;
  podId?: string;
  error?: string;
}

export interface DeliveryRouteListItem {
  id: string;
  route_number: string;
  route_status_code: string;
  driver_id: string | null;
  total_stops: number;
  completed_stops: number;
  created_at: string;
}

export interface ListRoutesParams {
  tenantId: string;
  page?: number;
  limit?: number;
  status?: string;
}

export interface ListRoutesResult {
  success: boolean;
  routes?: DeliveryRouteListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export class DeliveryService {
  /**
   * Create delivery route with orders
   */
  static async createRoute(
    params: CreateRouteParams
  ): Promise<CreateRouteResult> {
    try {
      const { orderIds, tenantId, driverId, userId } = params;
      const supabase = await createClient();

      logger.info('Creating delivery route', {
        tenantId,
        userId,
        orderCount: orderIds.length,
        feature: 'delivery',
        action: 'create_route',
      });

      // Generate route number
      const routeNumber = await this.generateRouteNumber(tenantId);

      // Create route
      const { data: route, error: routeError } = await supabase
        .from('org_dlv_routes_mst')
        .insert({
          tenant_org_id: tenantId,
          route_number: routeNumber,
          driver_id: driverId || null,
          route_status_code: 'planned',
          total_stops: orderIds.length,
          completed_stops: 0,
          created_by: userId,
        })
        .select('id')
        .single();

      if (routeError || !route) {
        logger.error('Failed to create route', routeError as Error, {
          tenantId,
          userId,
        });
        throw new Error('Failed to create route');
      }

      // Create stops for each order
      const stops = [];
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];

        // Get order with customer address
        const { data: order, error: orderError } = await supabase
          .from('org_orders_mst')
          .select(
            `
            *,
            customer:org_customers_mst(
              id,
              customer_id,
              customer_name,
              phone
            )
          `
          )
          .eq('id', orderId)
          .eq('tenant_org_id', tenantId)
          .single();

        if (orderError || !order) {
          logger.warn('Order not found, skipping', {
            tenantId,
            orderId,
          });
          continue;
        }

        // Resolve customer's default/most recent address (tenant-scoped)
        const customerRow = order.customer as any;
        const customerIdCandidates = [customerRow?.customer_id, customerRow?.id].filter(Boolean) as string[];

        let address: string | null = null;
        if (customerIdCandidates.length > 0) {
          const { data: addr } = await supabase
            .from('org_customer_addresses')
            .select(
              'label,building,floor,apartment,street,area,city,country,postal_code,delivery_notes,is_default,created_at'
            )
            .eq('tenant_org_id', tenantId)
            .in('customer_id', customerIdCandidates)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (addr) {
            const parts = [
              addr.label,
              addr.building,
              addr.floor ? `Floor ${addr.floor}` : null,
              addr.apartment ? `Apt ${addr.apartment}` : null,
              addr.street,
              addr.area,
              addr.city,
              addr.country,
              addr.postal_code,
            ].filter(Boolean);

            const base = parts.join(', ');
            address = addr.delivery_notes ? `${base}${base ? ' — ' : ''}${addr.delivery_notes}` : base;
          }
        }

        if (!address) {
          logger.warn('No customer address found for delivery stop', {
            tenantId,
            orderId,
            feature: 'delivery',
            action: 'create_route',
          });
        }

        stops.push({
          route_id: route.id,
          order_id: orderId,
          tenant_org_id: tenantId,
          sequence: i + 1,
          address: address || null,
          stop_status_code: 'pending',
          contact_name: (order.customer as any)?.customer_name || null,
          contact_phone: (order.customer as any)?.phone || null,
          created_by: userId,
        });
      }

      if (stops.length > 0) {
        const { error: stopsError } = await supabase
          .from('org_dlv_stops_dtl')
          .insert(stops);

        if (stopsError) {
          logger.error('Failed to create stops', stopsError as Error, {
            tenantId,
            routeId: route.id,
          });
          // Don't fail, log and continue
        }
      }

      logger.info('Delivery route created successfully', {
        tenantId,
        userId,
        routeId: route.id,
        stopCount: stops.length,
      });

      return {
        success: true,
        routeId: route.id,
      };
    } catch (error) {
      logger.error('Failed to create route', error as Error, {
        tenantId: params.tenantId,
        userId: params.userId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Assign driver to route
   */
  static async assignDriver(
    params: AssignDriverParams
  ): Promise<AssignDriverResult> {
    try {
      const { routeId, tenantId, driverId, userId } = params;
      const supabase = await createClient();

      logger.info('Assigning driver to route', {
        tenantId,
        userId,
        routeId,
        driverId,
        feature: 'delivery',
        action: 'assign_driver',
      });

      // Verify route exists
      const { data: route, error: routeError } = await supabase
        .from('org_dlv_routes_mst')
        .select('*')
        .eq('id', routeId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (routeError || !route) {
        throw new RouteNotFoundError(routeId);
      }

      // Update route
      const { error: updateError } = await supabase
        .from('org_dlv_routes_mst')
        .update({
          driver_id: driverId,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', routeId);

      if (updateError) {
        logger.error('Failed to assign driver', updateError as Error, {
          tenantId,
          routeId,
          driverId,
        });
        throw new Error('Failed to assign driver');
      }

      logger.info('Driver assigned successfully', {
        tenantId,
        routeId,
        driverId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to assign driver', error as Error, {
        tenantId: params.tenantId,
        routeId: params.routeId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate OTP for order delivery
   */
  static async generateOTP(
    params: GenerateOTPParams
  ): Promise<GenerateOTPResult> {
    try {
      const { orderId, tenantId, userId } = params;
      const supabase = await createClient();

      logger.info('Generating OTP', {
        tenantId,
        userId,
        orderId,
        feature: 'delivery',
        action: 'generate_otp',
      });

      // Generate 4-digit OTP
      const { generateOTPCode, encryptOTP } = await import('@/lib/utils/otp-encryption');
      const otpCode = generateOTPCode();
      const encryptedOTP = encryptOTP(otpCode, tenantId);

      // Find stop for this order
      const { data: stop, error: stopError } = await supabase
        .from('org_dlv_stops_dtl')
        .select('id')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .eq('stop_status_code', 'pending')
        .single();

      if (stopError || !stop) {
        throw new StopNotFoundError(orderId);
      }

      // Create or update POD record with OTP
      const { data: existingPOD } = await supabase
        .from('org_dlv_pod_tr')
        .select('id')
        .eq('stop_id', stop.id)
        .single();

      if (existingPOD) {
        // Update existing POD
        await supabase
          .from('org_dlv_pod_tr')
          .update({
            otp_code: encryptedOTP,
            otp_verified: false,
            pod_method_code: 'OTP',
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPOD.id);
      } else {
        // Create new POD
        await supabase.from('org_dlv_pod_tr').insert({
          stop_id: stop.id,
          tenant_org_id: tenantId,
          pod_method_code: 'OTP',
          otp_code: encryptedOTP,
          otp_verified: false,
          created_by: userId,
        });
      }

      // Send OTP to customer via SMS
      const { data: orderWithCustomer } = await supabase
        .from('org_orders_mst')
        .select('customer:org_customers_mst(phone)')
        .eq('id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      const customerPhone = (orderWithCustomer as { customer?: { phone?: string } })?.customer?.phone;
      if (customerPhone) {
        const { sendSMS } = await import('@/lib/notifications/sms-sender');
        const message = `Your CleanMateX delivery OTP is: ${otpCode}. Give this code to the driver upon delivery.`;
        await sendSMS(customerPhone, message);
      } else {
        logger.warn('No customer phone for delivery OTP - OTP not sent', {
          tenantId,
          orderId,
        });
      }

      logger.info('OTP generated successfully', {
        tenantId,
        orderId,
        stopId: stop.id,
      });

      return {
        success: true,
        otpCode,
      };
    } catch (error) {
      logger.error('Failed to generate OTP', error as Error, {
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
   * Verify OTP for delivery
   */
  static async verifyOTP(params: VerifyOTPParams): Promise<VerifyOTPResult> {
    try {
      const { orderId, tenantId, otpCode } = params;
      const supabase = await createClient();

      logger.info('Verifying OTP', {
        tenantId,
        orderId,
        feature: 'delivery',
        action: 'verify_otp',
      });

      // Find stop for this order
      const { data: stop, error: stopError } = await supabase
        .from('org_dlv_stops_dtl')
        .select('id')
        .eq('order_id', orderId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (stopError || !stop) {
        throw new StopNotFoundError(orderId);
      }

      // Get POD record
      const { data: pod, error: podError } = await supabase
        .from('org_dlv_pod_tr')
        .select('*')
        .eq('stop_id', stop.id)
        .single();

      if (podError || !pod) {
        throw new InvalidOTPError(orderId);
      }

      // Decrypt and verify OTP
      const { decryptOTP } = await import('@/lib/utils/otp-encryption');
      const decryptedOTP = decryptOTP(pod.otp_code || '', tenantId);
      const isValid = decryptedOTP === otpCode;

      if (isValid) {
        // Update POD as verified
        await supabase
          .from('org_dlv_pod_tr')
          .update({
            otp_verified: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pod.id);
      }

      logger.info('OTP verification completed', {
        tenantId,
        orderId,
        isValid,
      });

      return {
        success: true,
        isValid,
      };
    } catch (error) {
      logger.error('Failed to verify OTP', error as Error, {
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
   * Capture Proof of Delivery
   */
  static async capturePOD(params: CapturePODParams): Promise<CapturePODResult> {
    try {
      const {
        stopId,
        tenantId,
        podMethodCode,
        otpCode,
        signatureUrl,
        photoUrls,
        userId,
      } = params;
      const supabase = await createClient();

      logger.info('Capturing POD', {
        tenantId,
        userId,
        stopId,
        podMethodCode,
        feature: 'delivery',
        action: 'capture_pod',
      });

      // Verify stop exists
      const { data: stop, error: stopError } = await supabase
        .from('org_dlv_stops_dtl')
        .select('*, order:org_orders_mst(id)')
        .eq('id', stopId)
        .eq('tenant_org_id', tenantId)
        .single();

      if (stopError || !stop) {
        throw new StopNotFoundError(stopId);
      }

      // Create or update POD record
      const { data: existingPOD } = await supabase
        .from('org_dlv_pod_tr')
        .select('id')
        .eq('stop_id', stopId)
        .single();

      const podData: any = {
        stop_id: stopId,
        tenant_org_id: tenantId,
        pod_method_code: podMethodCode,
        verified_at: new Date().toISOString(),
        verified_by: userId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      if (otpCode) {
        const { encryptOTP } = await import('@/lib/utils/otp-encryption');
        podData.otp_code = encryptOTP(otpCode, tenantId);
        podData.otp_verified = true;
      }
      if (signatureUrl) {
        podData.signature_url = signatureUrl;
      }
      if (photoUrls && photoUrls.length > 0) {
        podData.photo_urls = photoUrls;
      }

      let podId: string;

      if (existingPOD) {
        // Update existing POD
        await supabase
          .from('org_dlv_pod_tr')
          .update(podData)
          .eq('id', existingPOD.id);
        podId = existingPOD.id;
      } else {
        // Create new POD
        podData.created_by = userId;
        const { data: newPOD, error: podInsertError } = await supabase
          .from('org_dlv_pod_tr')
          .insert(podData)
          .select('id')
          .single();

        if (podInsertError || !newPOD) {
          throw new PODCaptureError('Failed to create POD record');
        }
        podId = newPOD.id;
      }

      // Update stop status to delivered
      await supabase
        .from('org_dlv_stops_dtl')
        .update({
          stop_status_code: 'delivered',
          actual_time: new Date().toISOString(),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stopId);

      // Update order status to DELIVERED
      const orderId = (stop.order as any).id;
      await WorkflowService.changeStatus({
        orderId,
        tenantId,
        fromStatus: 'OUT_FOR_DELIVERY',
        toStatus: 'DELIVERED',
        userId,
        userName: 'Delivery Service',
      });

      logger.info('POD captured successfully', {
        tenantId,
        stopId,
        podId,
        orderId,
      });

      return {
        success: true,
        podId,
      };
    } catch (error) {
      logger.error('Failed to capture POD', error as Error, {
        tenantId: params.tenantId,
        stopId: params.stopId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List delivery routes (paginated)
   */
  static async listRoutes(params: ListRoutesParams): Promise<ListRoutesResult> {
    try {
      const supabase = await createClient();
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('org_dlv_routes_mst')
        .select(
          'id,route_number,route_status_code,driver_id,total_stops,completed_stops,created_at',
          { count: 'exact' }
        )
        .eq('tenant_org_id', params.tenantId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (params.status) {
        query = query.eq('route_status_code', params.status);
      }

      const { data, error, count } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const total = count || 0;
      return {
        success: true,
        routes: (data || []) as DeliveryRouteListItem[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(
        'Failed to list delivery routes',
        error instanceof Error ? error : new Error('Unknown error'),
        { feature: 'delivery', action: 'list_routes', tenantId: params.tenantId }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate route number
   */
  private static async generateRouteNumber(tenantId: string): Promise<string> {
    const supabase = await createClient();
    const year = new Date().getFullYear();
    const prefix = `RT-${year}-`;

    // Get last route number for this year
    const { data: lastRoute } = await supabase
      .from('org_dlv_routes_mst')
      .select('route_number')
      .eq('tenant_org_id', tenantId)
      .like('route_number', `${prefix}%`)
      .order('route_number', { ascending: false })
      .limit(1)
      .single();

    let sequence = 1;
    if (lastRoute?.route_number) {
      const lastSeq = parseInt(
        lastRoute.route_number.replace(prefix, ''),
        10
      );
      sequence = lastSeq + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }
}

