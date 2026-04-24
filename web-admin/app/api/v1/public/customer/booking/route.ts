import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/services/feature-flags.service';
import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { OrderService } from '@/lib/services/order-service';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { logger } from '@/lib/utils/logger';

const submitBookingSchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  addressId: z.string().uuid(),
  slotId: z.string().min(1),
  fulfillmentType: z.enum(['pickup', 'delivery']),
  notes: z.string().max(500).optional().default(''),
});

interface BookingSlot {
  id: string;
  label: string;
  label2: string;
  startAt: string;
  endAt: string;
}

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim();
}

function buildSlotWindows(): BookingSlot[] {
  const now = new Date();
  const todayEvening = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    18,
    0,
    0,
    0,
  );
  const tomorrowMorning = new Date(todayEvening.getTime() + 16 * 60 * 60 * 1000);
  const tomorrowEvening = new Date(todayEvening.getTime() + 24 * 60 * 60 * 1000);

  return [
    {
      id: 'slot-1',
      label: 'Today, 6:00 PM - 8:00 PM',
      label2: 'اليوم، 6:00 م - 8:00 م',
      startAt: todayEvening.toISOString(),
      endAt: new Date(todayEvening.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'slot-2',
      label: 'Tomorrow, 10:00 AM - 12:00 PM',
      label2: 'غداً، 10:00 ص - 12:00 م',
      startAt: tomorrowMorning.toISOString(),
      endAt: new Date(tomorrowMorning.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'slot-3',
      label: 'Tomorrow, 5:00 PM - 7:00 PM',
      label2: 'غداً، 5:00 م - 7:00 م',
      startAt: tomorrowEvening.toISOString(),
      endAt: new Date(tomorrowEvening.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function buildAddressDescription(address: {
  street: string | null;
  area: string | null;
  city: string | null;
  building: string | null;
  floor: string | null;
}): string {
  return [
    address.street,
    address.area,
    address.city,
    address.building ? `Building ${address.building}` : null,
    address.floor ? `Floor ${address.floor}` : null,
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(', ');
}

function buildServiceDescription(params: {
  serviceCategoryCode: string | null;
  turnaroundHh: number | null;
}): { description: string; description2: string } {
  const category = params.serviceCategoryCode?.replaceAll('_', ' ').toLowerCase() ?? 'care';
  const hours = params.turnaroundHh ?? 48;

  return {
    description: `${category[0]?.toUpperCase() ?? ''}${category.slice(1)} service with an estimated ${hours}-hour turnaround.`,
    description2: `خدمة ${category} مع مدة تنفيذ تقديرية ${hours} ساعة.`,
  };
}

/**
 * Returns booking bootstrap payload (services, addresses, slots) for mobile customers.
 *
 * @param request Incoming HTTP request with tenantId query and Bearer token.
 * @returns JSON response with booking bootstrap data or a structured error.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId')?.trim() ?? '';
    const verificationToken = extractBearerToken(request);

    if (!tenantId || !verificationToken) {
      return NextResponse.json(
        { success: false, error: 'tenantId and bearer token are required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId,
      verificationToken,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const bookingEnabled = await canAccess(tenantId, 'online_booking');
    if (!bookingEnabled) {
      return NextResponse.json(
        {
          success: true,
          data: {
            bookingEnabled: false,
            disabledReasonKey: 'booking.disabledBody',
            services: [],
            addresses: [],
            slots: [],
          },
        },
        { status: 200 },
      );
    }

    const supabase = await createAdminSupabaseClient();
    const tenantSettings = createTenantSettingsService(supabase);
    const moneyConfig = await tenantSettings.getCurrencyConfig(tenantId);

    const [{ data: services, error: servicesError }, { data: addresses, error: addressesError }] =
      await Promise.all([
        supabase
          .from('org_product_data_mst')
          .select(
            'id, tenant_org_id, service_category_code, product_name, product_name2, default_sell_price, turnaround_hh',
          )
          .eq('tenant_org_id', tenantId)
          .eq('is_active', true)
          .order('product_order', { ascending: true })
          .limit(8),
        supabase
          .from('org_customer_addresses')
          .select('id, label, street, area, city, building, floor, is_default')
          .eq('tenant_org_id', tenantId)
          .eq('customer_id', session.customerId)
          .eq('is_active', true)
          .order('is_default', { ascending: false }),
      ]);

    if (servicesError) {
      throw servicesError;
    }

    if (addressesError) {
      throw addressesError;
    }

    const durationMs = Date.now() - startedAt;
    logger.info('Public customer booking bootstrap success', {
      feature: 'public_customer_booking',
      action: 'bootstrap',
      tenantId,
      customerId: session.customerId,
      durationMs,
    });

    const response = {
      bookingEnabled: true,
      disabledReasonKey: null,
      services: (services ?? []).map((service) => {
        const price = Number(service.default_sell_price ?? 0);
        const description = buildServiceDescription({
          serviceCategoryCode: service.service_category_code,
          turnaroundHh: service.turnaround_hh ? Number(service.turnaround_hh) : null,
        });

        return {
          id: service.id,
          title: service.product_name ?? 'Service',
          title2: service.product_name2 ?? null,
          description: description.description,
          description2: description.description2,
          priceLabel: formatMoneyAmountWithCode(price, {
            currencyCode: moneyConfig.currencyCode,
            decimalPlaces: moneyConfig.decimalPlaces,
            locale: 'en',
          }),
          priceLabel2: formatMoneyAmountWithCode(price, {
            currencyCode: moneyConfig.currencyCode,
            decimalPlaces: moneyConfig.decimalPlaces,
            locale: 'ar',
          }),
        };
      }),
      addresses: (addresses ?? []).map((address) => ({
        id: address.id,
        label: address.label ?? 'Address',
        description: buildAddressDescription(address),
        isDefault: address.is_default === true,
      })),
      slots: buildSlotWindows(),
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('Public customer booking bootstrap failed', error as Error, {
      feature: 'public_customer_booking',
      action: 'bootstrap',
      durationMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

/**
 * Submits a customer booking request and creates an order.
 *
 * @param request Incoming HTTP request with Bearer token and booking payload body.
 * @returns JSON response containing booking confirmation or a structured error.
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const verificationToken = extractBearerToken(request);
    const body = submitBookingSchema.parse(await request.json());

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: 'Bearer token is required' },
        { status: 400 },
      );
    }

    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken,
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const bookingEnabled = await canAccess(body.tenantId, 'online_booking');
    if (!bookingEnabled) {
      return NextResponse.json(
        { success: false, error: 'Online booking is not enabled for this tenant' },
        { status: 403 },
      );
    }

    const supabase = await createAdminSupabaseClient();
    const bookingSlots = buildSlotWindows();
    const selectedSlot = bookingSlots.find((slot) => slot.id == body.slotId);

    if (!selectedSlot) {
      return NextResponse.json(
        { success: false, error: 'Selected slot is not available' },
        { status: 400 },
      );
    }

    const [{ data: service, error: serviceError }, { data: address, error: addressError }, { data: branch, error: branchError }] =
      await Promise.all([
        supabase
          .from('org_product_data_mst')
          .select(
            'id, tenant_org_id, service_category_code, product_name, product_name2, default_sell_price',
          )
          .eq('tenant_org_id', body.tenantId)
          .eq('id', body.serviceId)
          .eq('is_active', true)
          .single(),
        supabase
          .from('org_customer_addresses')
          .select('id, label, street, area, city, building, floor')
          .eq('tenant_org_id', body.tenantId)
          .eq('id', body.addressId)
          .eq('customer_id', session.customerId)
          .eq('is_active', true)
          .single(),
        supabase
          .from('org_branches_mst')
          .select('id')
          .eq('tenant_org_id', body.tenantId)
          .eq('is_active', true)
          .order('is_main', { ascending: false })
          .limit(1)
          .single(),
      ]);

    if (serviceError || !service) {
      return NextResponse.json(
        { success: false, error: 'Selected service is not available' },
        { status: 404 },
      );
    }

    if (addressError || !address) {
      return NextResponse.json(
        { success: false, error: 'Selected address is not available' },
        { status: 404 },
      );
    }

    if (branchError || !branch) {
      return NextResponse.json(
        { success: false, error: 'No active branch is available for booking' },
        { status: 404 },
      );
    }

    const price = Number(service.default_sell_price ?? 0);
    const addressDescription = buildAddressDescription(address);
    const orderTypeId = body.fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP';
    const paymentTypeCode =
      body.fulfillmentType === 'delivery' ? 'PAY_ON_DELIVERY' : 'PAY_ON_COLLECTION';

    const creationResult = await OrderService.createOrder({
      tenantId: body.tenantId,
      customerId: session.customerId,
      branchId: branch.id,
      orderTypeId,
      items: [
        {
          productId: service.id,
          productName: service.product_name ?? null,
          productName2: service.product_name2 ?? null,
          quantity: 1,
          pricePerUnit: price,
          totalPrice: price,
          serviceCategoryCode: service.service_category_code ?? undefined,
        },
      ],
      customerNotes: body.notes.trim(),
      internalNotes: `Mobile booking | ${body.fulfillmentType} | ${selectedSlot.label}`,
      paymentTypeCode,
      readyByAt: selectedSlot.endAt,
      customerMobile: session.phoneNumber,
      customerName: session.displayName ?? undefined,
      customerDetails: {
        source: 'customer_mobile_app',
        bookingAddressId: address.id,
        bookingAddressLabel: address.label,
        bookingAddressText: addressDescription,
        bookingSlotId: selectedSlot.id,
        bookingSlotLabel: selectedSlot.label,
        fulfillmentType: body.fulfillmentType,
      },
      userId: session.customerId,
      userName: session.displayName ?? 'Customer Mobile App',
    });

    if (!creationResult.success || !creationResult.order) {
      return NextResponse.json(
        { success: false, error: creationResult.error ?? 'Failed to create booking' },
        { status: 400 },
      );
    }

    const durationMs = Date.now() - startedAt;
    logger.info('Public customer booking submit success', {
      feature: 'public_customer_booking',
      action: 'submit',
      tenantId: body.tenantId,
      customerId: session.customerId,
      orderId: creationResult.order.id,
      durationMs,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: creationResult.order.id,
          orderNo: creationResult.order.orderNo,
          promisedWindow: selectedSlot.label,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('Public customer booking submit failed', error as Error, {
      feature: 'public_customer_booking',
      action: 'submit',
      durationMs,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
