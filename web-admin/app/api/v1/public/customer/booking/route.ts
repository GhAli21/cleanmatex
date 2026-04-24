import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';

import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { canAccess } from '@/lib/services/feature-flags.service';
import { resolveCustomerMobileSession } from '@/lib/services/customer-mobile-session.service';
import { OrderService } from '@/lib/services/order-service';
import { PreferenceCatalogService } from '@/lib/services/preference-catalog.service';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { logger } from '@/lib/utils/logger';

const bookingItemSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.coerce.number().int().min(1).max(99),
});

const submitBookingSchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid().optional().nullable(),
  addressId: z.string().uuid().optional().nullable(),
  slotId: z.string().min(1).optional().nullable(),
  fulfillmentType: z.enum(['pickup', 'delivery', 'bring_in']),
  items: z.array(bookingItemSchema).min(1).max(100),
  servicePreferenceIds: z.array(z.string().min(1).max(120)).optional().default([]),
  pickupPreferenceIds: z.array(z.string().min(1).max(120)).optional().default([]),
  isPickupFromAddress: z.boolean().optional().default(false),
  isAsap: z.boolean().optional().default(true),
  scheduledAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional().default(''),
});

interface BookingSlot {
  id: string;
  label: string;
  label2: string;
  startAt: string;
  endAt: string;
}

type BookingSubmitBody = z.infer<typeof submitBookingSchema>;

function jsonError(
  errorCode: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorCode,
      details,
    },
    { status },
  );
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

function normalizeProductUnit(unit: string | null): string {
  const normalized = (unit ?? '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : 'per_piece';
}

function buildCatalogCategories(
  products: Array<{
    id: string;
    service_category_code: string | null;
    product_group1: string | null;
    product_name: string | null;
    product_name2: string | null;
    hint_text: string | null;
    default_sell_price: number | string | null;
    product_unit: string | null;
    product_image: string | null;
  }>,
  serviceCategories: Array<{
    service_category_code: string;
    name: string | null;
    name2: string | null;
    display_name: string | null;
    rec_order: number | null;
  }>,
) {
  const categoryMap = new Map(
    serviceCategories.map((category) => [
      category.service_category_code,
      category,
    ]),
  );
  const grouped = new Map<
    string,
    {
      id: string;
      name: string;
      name2: string | null;
      items: Array<Record<string, unknown>>;
    }
  >();

  for (const product of products) {
    const categoryId =
      product.service_category_code ?? product.product_group1 ?? 'general';
    const categoryConfig = categoryMap.get(categoryId);
    if (product.service_category_code && !categoryConfig) {
      continue;
    }
    const fallbackName = categoryId.replaceAll('_', ' ').toLowerCase();
    const category = grouped.get(categoryId) ?? {
      id: categoryId,
      name:
        categoryConfig?.display_name ??
        categoryConfig?.name ??
        `${fallbackName[0]?.toUpperCase() ?? ''}${fallbackName.slice(1)}`,
      name2: categoryConfig?.name2 ?? null,
      items: [],
    };

    category.items.push({
      id: product.id,
      categoryId,
      name: product.product_name ?? 'Service item',
      name2: product.product_name2 ?? null,
      description: product.hint_text ?? null,
      description2: null,
      unitPrice: Number(product.default_sell_price ?? 0),
      unit: normalizeProductUnit(product.product_unit),
      imageUrl: product.product_image ?? null,
    });
    grouped.set(categoryId, category);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const leftOrder = categoryMap.get(a.id)?.rec_order ?? 9999;
    const rightOrder = categoryMap.get(b.id)?.rec_order ?? 9999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return a.name.localeCompare(b.name);
  });
}

function buildBookingSignature(params: {
  tenantId: string;
  customerId: string;
  items: BookingSubmitBody['items'];
  isPickupFromAddress: boolean;
  isAsap: boolean;
  scheduledAt?: string | null;
  addressId?: string | null;
  fulfillmentType: string;
  servicePreferenceIds: string[];
  pickupPreferenceIds: string[];
  notes: string;
}) {
  const normalizedItems = [...params.items]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((item) => `${item.itemId}:${item.qty}`)
    .join('|');
  return createHash('sha256')
    .update(
      [
        params.tenantId,
        params.customerId,
        normalizedItems,
        params.isPickupFromAddress ? 'pickup' : 'dropoff',
        params.fulfillmentType,
        params.isAsap ? 'asap' : params.scheduledAt ?? '',
        params.addressId ?? '',
        [...params.servicePreferenceIds].sort().join('|'),
        [...params.pickupPreferenceIds].sort().join('|'),
        params.notes.trim(),
      ].join('::'),
    )
    .digest('hex');
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
    const requestContext = {
      feature: 'public_customer_booking',
      action: 'bootstrap',
      tenantId,
      hasVerificationToken: Boolean(verificationToken),
      method: request.method,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    logger.info('Public customer booking bootstrap request received', requestContext);

    if (!tenantId || !verificationToken) {
      logger.warn('Public customer booking bootstrap rejected missing inputs', {
        ...requestContext,
        missingTenantId: !tenantId,
        missingVerificationToken: !verificationToken,
      });
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
      logger.warn('Public customer booking bootstrap unauthorized', requestContext);
      return NextResponse.json(
        { success: false, error: 'Unauthorized customer session' },
        { status: 401 },
      );
    }

    const bookingEnabled = await canAccess(tenantId, 'online_booking');
    logger.info('Public customer booking feature flag resolved', {
      ...requestContext,
      customerId: session.customerId,
      bookingEnabled,
    });
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
            categories: [],
            servicePreferences: [],
            pickupPreferences: [],
            vatRate: 0,
            currencyCode: null,
          },
        },
        { status: 200 },
      );
    }

    const supabase = await createAdminSupabaseClient();
    const tenantSettings = createTenantSettingsService(supabase);
    logger.info('Public customer booking resolving settings and preferences', {
      ...requestContext,
      customerId: session.customerId,
    });
    const [moneyConfig, vatSetting, servicePreferences, pickupPreferences] =
      await Promise.all([
        tenantSettings.getCurrencyConfig(tenantId),
        tenantSettings.getSettingValue(tenantId, 'TENANT_VAT_RATE'),
        PreferenceCatalogService.getServicePreferences(supabase, tenantId),
        PreferenceCatalogService.getPackingPreferences(supabase, tenantId),
      ]);
    const vatRate =
      typeof vatSetting === 'number'
        ? vatSetting
        : Number.parseFloat(String(vatSetting ?? '0')) || 0;

    logger.info('Public customer booking executing bootstrap data queries', {
      ...requestContext,
      customerId: session.customerId,
      currencyCode: moneyConfig.currencyCode,
      vatRate,
    });
    const [
      { data: serviceCategories, error: serviceCategoriesError },
      { data: services, error: servicesError },
      { data: addresses, error: addressesError },
    ] = await Promise.all([
      supabase
        .from('org_service_category_cf')
        .select(
          'service_category_code, name, name2, display_name, rec_order, is_enabled, is_active',
        )
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .eq('is_enabled', true)
        .order('rec_order', { ascending: true }),
      supabase
        .from('org_product_data_mst')
        .select(
          'id, tenant_org_id, service_category_code, product_group1, product_name, product_name2, hint_text, default_sell_price, product_unit, product_image, turnaround_hh',
        )
        .eq('tenant_org_id', tenantId)
        .eq('is_active', true)
        .order('product_order', { ascending: true })
        .limit(200),
      supabase
        .from('org_customer_addresses')
        .select('id, label, street, area, city, building, floor, is_default')
        .eq('tenant_org_id', tenantId)
        .eq('customer_id', session.customerId)
        .eq('is_active', true)
        .order('is_default', { ascending: false }),
    ]);

    if (serviceCategoriesError) {
      throw serviceCategoriesError;
    }

    if (servicesError) {
      throw servicesError;
    }

    if (addressesError) {
      throw addressesError;
    }

    logger.info('Public customer booking bootstrap data queries succeeded', {
      ...requestContext,
      customerId: session.customerId,
      categoryCount: serviceCategories?.length ?? 0,
      productCount: services?.length ?? 0,
      addressCount: addresses?.length ?? 0,
      servicePreferenceCount: servicePreferences.length,
      pickupPreferenceCount: pickupPreferences.length,
    });

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
      currencyCode: moneyConfig.currencyCode,
      vatRate,
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
      categories: buildCatalogCategories(services ?? [], serviceCategories ?? []),
      servicePreferences: servicePreferences.map((preference) => ({
        id: preference.code,
        label: preference.name,
        label2: preference.name2 ?? null,
        extraPrice: Number(preference.default_extra_price ?? 0),
      })),
      pickupPreferences: pickupPreferences.map((preference) => ({
        id: preference.code,
        label: preference.name,
        label2: preference.name2 ?? null,
        extraPrice: 0,
      })),
      addresses: (addresses ?? []).map((address) => ({
        id: address.id,
        label: address.label ?? 'Address',
        description: buildAddressDescription(address),
        isDefault: address.is_default === true,
        street: address.street,
        area: address.area,
        city: address.city,
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
        error: 'Internal server error',
        errorCode: 'booking_bootstrap_failed',
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
    const rawBody = await request.json().catch(() => null);
    const parsedBody = submitBookingSchema.safeParse(rawBody);
    const submitBaseContext = {
      feature: 'public_customer_booking',
      action: 'submit',
      hasVerificationToken: Boolean(verificationToken),
      method: request.method,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    };

    if (!parsedBody.success) {
      logger.warn('Public customer booking submit rejected by validation', {
        ...submitBaseContext,
        action: 'submit_validate',
        issues: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      });
      return jsonError(
        'booking_validation_failed',
        'Booking request is invalid',
        400,
        parsedBody.error.flatten(),
      );
    }

    const body = parsedBody.data;
    const submitContext = {
      ...submitBaseContext,
      tenantId: body.tenantId,
      itemLines: body.items.length,
      servicePreferenceCount: body.servicePreferenceIds.length,
      pickupPreferenceCount: body.pickupPreferenceIds.length,
      isPickupFromAddress: body.isPickupFromAddress,
      isAsap: body.isAsap,
      fulfillmentType: body.fulfillmentType,
    };

    logger.info('Public customer booking submit request parsed', submitContext);

    if (!verificationToken) {
      return jsonError('booking_missing_token', 'Bearer token is required', 400);
    }

    const session = await resolveCustomerMobileSession({
      tenantId: body.tenantId,
      verificationToken,
    });

    if (!session) {
      logger.warn('Public customer booking submit unauthorized', submitContext);
      return jsonError(
        'booking_unauthorized',
        'Unauthorized customer session',
        401,
      );
    }

    const bookingEnabled = await canAccess(body.tenantId, 'online_booking');
    logger.info('Public customer booking submit feature flag resolved', {
      ...submitContext,
      customerId: session.customerId,
      bookingEnabled,
    });
    if (!bookingEnabled) {
      return jsonError(
        'booking_disabled',
        'Online booking is not enabled for this tenant',
        403,
      );
    }

    const supabase = await createAdminSupabaseClient();
    const requestedItems = new Map<string, number>();
    for (const item of body.items) {
      requestedItems.set(item.itemId, (requestedItems.get(item.itemId) ?? 0) + item.qty);
    }
    const hasExcessiveQuantity = Array.from(requestedItems.values()).some(
      (quantity) => quantity > 99,
    );
    if (hasExcessiveQuantity) {
      return jsonError(
        'booking_quantity_invalid',
        'Selected item quantity is too high',
        400,
      );
    }
    const requestedItemIds = Array.from(requestedItems.keys());
    const requiresAddress = body.isPickupFromAddress;
    logger.info('Public customer booking submit items normalized', {
      ...submitContext,
      customerId: session.customerId,
      uniqueItemCount: requestedItemIds.length,
      totalQuantity: Array.from(requestedItems.values()).reduce(
        (sum, quantity) => sum + quantity,
        0,
      ),
    });

    if (requiresAddress && !body.addressId) {
      return jsonError(
        'booking_address_required',
        'Address is required for pickup from address',
        400,
      );
    }

    if (requiresAddress && !body.isAsap && !body.scheduledAt) {
      return jsonError(
        'booking_schedule_required',
        'Scheduled pickup time is required',
        400,
      );
    }

    const [
      { data: products, error: productsError },
      { data: address, error: addressError },
      { data: branch, error: branchError },
      servicePreferences,
      pickupPreferences,
    ] =
      await Promise.all([
        supabase
          .from('org_product_data_mst')
          .select(
            'id, tenant_org_id, service_category_code, product_name, product_name2, default_sell_price, default_packing_pref',
          )
          .eq('tenant_org_id', body.tenantId)
          .eq('is_active', true)
          .in('id', requestedItemIds),
        requiresAddress
          ? supabase
              .from('org_customer_addresses')
              .select('id, label, street, area, city, building, floor')
              .eq('tenant_org_id', body.tenantId)
              .eq('id', body.addressId!)
              .eq('customer_id', session.customerId)
              .eq('is_active', true)
              .single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('org_branches_mst')
          .select('id')
          .eq('tenant_org_id', body.tenantId)
          .eq('is_active', true)
          .order('is_main', { ascending: false })
          .limit(1)
          .single(),
        PreferenceCatalogService.getServicePreferences(supabase, body.tenantId),
        PreferenceCatalogService.getPackingPreferences(supabase, body.tenantId),
      ]);

    if (productsError || !products || products.length !== requestedItemIds.length) {
      logger.warn('Public customer booking submit rejected unavailable items', {
        ...submitContext,
        customerId: session.customerId,
        requestedItemCount: requestedItemIds.length,
        foundItemCount: products?.length ?? 0,
      });
      return jsonError(
        'booking_item_unavailable',
        'One or more selected items are not available',
        400,
      );
    }

    if (requiresAddress && (addressError || !address)) {
      logger.warn('Public customer booking submit rejected unavailable address', {
        ...submitContext,
        customerId: session.customerId,
        addressId: body.addressId,
      });
      return jsonError(
        'booking_address_unavailable',
        'Selected address is not available',
        400,
      );
    }

    if (branchError || !branch) {
      logger.warn('Public customer booking submit rejected no active branch', {
        ...submitContext,
        customerId: session.customerId,
      });
      return jsonError(
        'booking_branch_unavailable',
        'No active branch is available for booking',
        400,
      );
    }

    const servicePreferenceMap = new Map<string, (typeof servicePreferences)[number]>(
      servicePreferences.map((preference) => [preference.code, preference]),
    );
    const invalidServicePreferenceIds = body.servicePreferenceIds.filter(
      (id) => !servicePreferenceMap.has(id),
    );
    if (invalidServicePreferenceIds.length > 0) {
      return jsonError(
        'booking_preference_unavailable',
        'One or more selected preferences are not available',
        400,
      );
    }

    const pickupPreferenceCodes = new Set<string>(
      pickupPreferences.map((preference) => preference.code),
    );
    const invalidPickupPreferenceIds = body.pickupPreferenceIds.filter(
      (id) => !pickupPreferenceCodes.has(id),
    );
    if (invalidPickupPreferenceIds.length > 0) {
      return jsonError(
        'booking_preference_unavailable',
        'One or more selected preferences are not available',
        400,
      );
    }

    const tenantSettings = createTenantSettingsService(supabase);
    const [moneyConfig, vatSetting] = await Promise.all([
      tenantSettings.getCurrencyConfig(body.tenantId, branch.id, session.customerId),
      tenantSettings.getSettingValue(body.tenantId, 'TENANT_VAT_RATE', branch.id, session.customerId),
    ]);
    const vatRate =
      typeof vatSetting === 'number'
        ? vatSetting
        : Number.parseFloat(String(vatSetting ?? '0')) || 0;
    logger.info('Public customer booking submit tenant data resolved', {
      ...submitContext,
      customerId: session.customerId,
      productCount: products.length,
      branchId: branch.id,
      hasAddress: Boolean(address),
      currencyCode: moneyConfig.currencyCode,
      vatRate,
    });
    const orderTypeId =
      body.fulfillmentType === 'delivery'
        ? 'DELIVERY'
        : body.fulfillmentType === 'pickup'
          ? 'PICKUP'
          : 'POS';
    const paymentTypeCode =
      body.fulfillmentType === 'delivery' ? 'PAY_ON_DELIVERY' : 'PAY_ON_COLLECTION';
    const addressDescription = address ? buildAddressDescription(address) : null;
    const selectedServicePrefs = body.servicePreferenceIds.map((id) => {
      const preference = servicePreferenceMap.get(id)!;
      return {
        preference_code: preference.code,
        source: 'customer_mobile_app',
        extra_price: Number(preference.default_extra_price ?? 0),
      };
    });
    const preferredPackingCode = body.pickupPreferenceIds[0] ?? null;
    const items = products.map((product) => {
      const quantity = requestedItems.get(product.id) ?? 0;
      const price = Number(product.default_sell_price ?? 0);
      const servicePrefCharge = selectedServicePrefs.reduce(
        (sum, preference) => sum + preference.extra_price * quantity,
        0,
      );
      return {
        productId: product.id,
        productName: product.product_name ?? null,
        productName2: product.product_name2 ?? null,
        quantity,
        pricePerUnit: price,
        totalPrice: price * quantity,
        serviceCategoryCode: product.service_category_code ?? undefined,
        servicePrefs: selectedServicePrefs,
        servicePrefCharge,
        packingPrefCode: preferredPackingCode ?? product.default_packing_pref ?? undefined,
        packingPrefSource: preferredPackingCode ? 'customer_mobile_app' : undefined,
      };
    });
    const subtotal = items.reduce(
      (sum, item) => sum + item.totalPrice + item.servicePrefCharge,
      0,
    );
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;
    const bookingSignature = buildBookingSignature({
      tenantId: body.tenantId,
      customerId: session.customerId,
      items: body.items,
      isPickupFromAddress: body.isPickupFromAddress,
      isAsap: body.isAsap,
      scheduledAt: body.scheduledAt,
      addressId: body.addressId,
      fulfillmentType: body.fulfillmentType,
      servicePreferenceIds: body.servicePreferenceIds,
      pickupPreferenceIds: body.pickupPreferenceIds,
      notes: body.notes,
    });
    const duplicateSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: duplicateOrder } = await supabase
      .from('org_orders_mst')
      .select('id, order_no, ready_by_at_new, ready_by')
      .eq('tenant_org_id', body.tenantId)
      .eq('customer_id', session.customerId)
      .eq('customer_details->>bookingRequestSignature', bookingSignature)
      .gte('created_at', duplicateSince)
      .maybeSingle();

    if (duplicateOrder) {
      logger.warn('Public customer booking duplicate submit resolved idempotently', {
        feature: 'public_customer_booking',
        action: 'submit_duplicate',
        tenantId: body.tenantId,
        customerId: session.customerId,
        orderId: duplicateOrder.id,
      });
      return NextResponse.json(
        {
          success: true,
          data: {
            orderId: duplicateOrder.id,
            orderNo: duplicateOrder.order_no,
            promisedWindow: duplicateOrder.ready_by_at_new ?? duplicateOrder.ready_by ?? null,
          },
        },
        { status: 200 },
      );
    }

    logger.info('Public customer booking submit creating order', {
      ...submitContext,
      customerId: session.customerId,
      branchId: branch.id,
      subtotal,
      vatAmount,
      total,
      currencyCode: moneyConfig.currencyCode,
      bookingSignature,
    });

    const creationResult = await OrderService.createOrder({
      tenantId: body.tenantId,
      customerId: session.customerId,
      branchId: branch.id,
      orderTypeId,
      items,
      totals: {
        subtotal,
        tax: vatAmount,
        total,
        vatRate,
        vatAmount,
      },
      customerNotes: body.notes.trim(),
      internalNotes: `Mobile booking | ${body.isPickupFromAddress ? 'pickup_from_address' : 'bring_in'} | ${body.isAsap ? 'ASAP' : body.scheduledAt ?? 'scheduled'}`,
      paymentTypeCode,
      currencyCode: moneyConfig.currencyCode,
      currencyExRate: 1,
      readyByAt: body.scheduledAt ?? undefined,
      customerMobile: session.phoneNumber,
      customerName: session.displayName ?? undefined,
      customerDetails: {
        source: 'customer_mobile_app',
        bookingRequestSignature: bookingSignature,
        isPickupFromAddress: body.isPickupFromAddress,
        isAsap: body.isAsap,
        scheduledAt: body.scheduledAt ?? null,
        bookingAddressId: address?.id ?? null,
        bookingAddressLabel: address?.label ?? null,
        bookingAddressText: addressDescription,
        selectedServicePreferenceIds: body.servicePreferenceIds,
        selectedPickupPreferenceIds: body.pickupPreferenceIds,
        fulfillmentType: body.fulfillmentType,
      },
      userId: session.customerId,
      userName: session.displayName ?? 'Customer Mobile App',
      useOldWfCodeOrNew: false,
    });

    if (!creationResult.success || !creationResult.order) {
      logger.warn('Public customer booking submit order creation failed', {
        ...submitContext,
        customerId: session.customerId,
        error: creationResult.error,
      });
      return jsonError(
        'booking_create_failed',
        creationResult.error ?? 'Failed to create booking',
        400,
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
          promisedWindow: body.scheduledAt ?? creationResult.order.readyByAt,
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
        error: 'Internal server error',
        errorCode: 'booking_submit_failed',
      },
      { status: 500 },
    );
  }
}
