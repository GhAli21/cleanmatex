import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

/// Authenticated tenant list split into active and recoverable hidden laundries.
class CustomerTenantsResult {
  const CustomerTenantsResult({
    required this.activeTenants,
    required this.hiddenTenants,
  });

  final List<TenantModel> activeTenants;
  final List<TenantModel> hiddenTenants;
}

/// Service contract for Customer App full profile, dual-scope addresses,
/// preferences, saved order notes, and My Laundries hide/unhide + last branch.
class CustomerProfileService {
  CustomerProfileService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<CustomerProfileModel> fetchProfile({
    required String tenantId,
    required String bearerToken,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl ||
        tenantId.isEmpty ||
        bearerToken.isEmpty) {
      return _demoProfile();
    }

    final payload = await _httpClient.getJson(
      '/api/v1/public/customer/profile',
      queryParameters: {'tenantId': tenantId},
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return CustomerProfileModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_profile_payload',
      messageKey: 'common.remoteRequestError',
    );
  }

  Future<CustomerProfileModel> updateProfile({
    required String tenantId,
    required String bearerToken,
    String? name,
    String? mobile,
    String? email,
    String? preferredLanguage,
    Map<String, Object?>? preferences,
    String? defaultOrderNote,
    bool? autoApplyOrderDefaultNote,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl) {
      return _demoProfile().copyWith(
        name: name,
        mobile: mobile,
        email: email,
        preferences: preferences,
        defaultOrderNote: defaultOrderNote,
        autoApplyOrderDefaultNote: autoApplyOrderDefaultNote,
      );
    }

    final payload = await _httpClient.patchJson(
      '/api/v1/public/customer/profile',
      headers: {'Authorization': 'Bearer $bearerToken'},
      body: {
        'tenantId': tenantId,
        if (name != null) 'name': name,
        if (mobile != null) 'mobile': mobile,
        if (email != null) 'email': email,
        if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
        if (preferences != null) 'preferences': preferences,
        if (defaultOrderNote != null) 'defaultOrderNote': defaultOrderNote,
        if (autoApplyOrderDefaultNote != null)
          'autoApplyOrderDefaultNote': autoApplyOrderDefaultNote,
      },
    );
    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return CustomerProfileModel.fromJson(data);
    }
    throw const MobileHttpException(
      code: 'invalid_profile_payload',
      messageKey: 'common.remoteRequestError',
    );
  }

  Future<AddressOptionModel> createAddress({
    required String tenantId,
    required String bearerToken,
    required String label,
    String addressType = 'home',
    String? building,
    String? floor,
    String? apartment,
    String? street,
    String? area,
    String? city,
    String? deliveryNotes,
    bool isDefault = false,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl) {
      return AddressOptionModel(
        id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
        label: label,
        description: [building, area, city]
            .whereType<String>()
            .where((s) => s.trim().isNotEmpty)
            .join(', '),
        isDefault: isDefault,
      );
    }

    final payload = await _httpClient.postJson(
      '/api/v1/public/customer/addresses',
      headers: {'Authorization': 'Bearer $bearerToken'},
      body: {
        'tenantId': tenantId,
        'addressType': addressType,
        'label': label,
        if (building != null) 'building': building,
        if (floor != null) 'floor': floor,
        if (apartment != null) 'apartment': apartment,
        if (street != null) 'street': street,
        if (area != null) 'area': area,
        if (city != null) 'city': city,
        if (deliveryNotes != null) 'deliveryNotes': deliveryNotes,
        'isDefault': isDefault,
      },
    );
    final data = payload['data'];
    if (data is Map<String, Object?>) {
      return AddressOptionModel(
        id: data['id'] as String? ?? '',
        label: data['label'] as String? ?? label,
        description: data['description'] as String? ?? '',
        isDefault: data['isDefault'] == true,
      );
    }
    throw const MobileHttpException(
      code: 'invalid_address_payload',
      messageKey: 'common.remoteRequestError',
    );
  }

  Future<CustomerTenantsResult> listAuthenticatedTenants({
    required String bearerToken,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl) {
      return const CustomerTenantsResult(
        activeTenants: [
          TenantModel(
            tenantOrgId: 'demo-tenant-org-id',
            name: 'Al-Noor Laundry',
            name2: 'مغسلة النور',
            primaryColor: '#0AB6D8',
            lastBranchId: 'demo-main-branch',
            lastBranchName: 'Al Khuwair Main',
            lastBranchName2: 'الفرع الرئيسي - الخوير',
            branches: [
              BranchOptionModel(
                id: 'demo-main-branch',
                name: 'Al Khuwair Main',
                name2: 'الفرع الرئيسي - الخوير',
                isMain: true,
                timeZone: 'Asia/Muscat',
              ),
              BranchOptionModel(
                id: 'demo-qurum-branch',
                name: 'Qurum Express',
                name2: 'فرع القرم السريع',
                timeZone: 'Asia/Muscat',
              ),
            ],
          ),
        ],
        hiddenTenants: [],
      );
    }

    final payload = await _httpClient.getJson(
      '/api/v1/public/customer/tenants',
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    List<TenantModel> parseList(Object? raw) => (raw as List? ?? const [])
        .whereType<Map<String, Object?>>()
        .map(TenantModel.fromJson)
        .where((t) => t.tenantOrgId.isNotEmpty)
        .toList(growable: false);

    return CustomerTenantsResult(
      activeTenants: parseList(payload['activeTenants'] ?? payload['data']),
      hiddenTenants: parseList(payload['hiddenTenants']),
    );
  }

  Future<void> updateTenantPreference({
    required String tenantId,
    required String bearerToken,
    bool? isHiddenByCustomer,
    String? lastBranchId,
  }) async {
    if (!_httpClient.config.hasApiBaseUrl) return;
    await _httpClient.patchJson(
      '/api/v1/public/customer/tenants',
      headers: {'Authorization': 'Bearer $bearerToken'},
      body: {
        'tenantId': tenantId,
        if (isHiddenByCustomer != null)
          'isHiddenByCustomer': isHiddenByCustomer,
        if (lastBranchId != null) 'lastBranchId': lastBranchId,
      },
    );
  }

  CustomerProfileModel _demoProfile() {
    return const CustomerProfileModel(
      orgCustomerId: 'demo-org-customer',
      sysCustomerId: 'demo-sys-customer',
      hasSysCustomerId: true,
      customerCode: 'CUST-004821',
      name: 'Ahmed Al-Harthi',
      name2: 'أحمد الحارثي',
      displayName: 'Ahmed Al-Harthi',
      mobile: '+96891234567',
      mobileVerified: true,
      email: 'ahmed.alharthi@example.om',
      emailVerified: true,
      profileStatus: 'full',
      loyaltyPoints: 840,
      memberSince: '2025-01-12T00:00:00Z',
      preferredLanguage: 'en',
      preferences: {
        'finishing': 'hanger',
        'starch': 'light',
        'detergent': 'standard',
        'fragrance': true,
      },
      defaultOrderNote: 'Please call 10 mins before arriving at Villa gate #14.',
      autoApplyOrderDefaultNote: true,
      lastBranchId: 'demo-main-branch',
      lastBranchName: 'Al Khuwair Main',
      lastBranchName2: 'الفرع الرئيسي - الخوير',
      addresses: [
        AddressOptionModel(
          id: 'demo-addr-home',
          label: 'Home (Villa 14)',
          description: 'Way 3322, Al Khuwair, Muscat',
          isDefault: true,
        ),
      ],
    );
  }
}
