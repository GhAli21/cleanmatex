import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class TenantServiceException extends AppException {
  const TenantServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
    this.phoneNumber,
    this.traceId,
  });

  final String? phoneNumber;
  final String? traceId;
}

class TenantService {
  TenantService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<List<TenantModel>> listTenantsForPhone(String phoneNumber) async {
    final normalizedPhone = phoneNumber.trim();
    AppLogger.info(
      'Tenant lookup requested for phone=$normalizedPhone',
    );

    if (!RegExp(r'^\+?[0-9]{4,15}$').hasMatch(normalizedPhone)) {
      throw TenantServiceException(
        code: 'tenant_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
        phoneNumber: normalizedPhone,
      );
    }

    if (!_httpClient.config.hasApiBaseUrl) {
      return const [
        TenantModel(
          tenantOrgId: 'demo-tenant-org-id',
          name: 'Demo Laundry',
          name2: 'مغسلة تجريبية',
          primaryColor: '#1A73E8',
          branches: [
            BranchOptionModel(
              id: 'demo-main-branch',
              name: 'Main Branch',
              name2: 'الفرع الرئيسي',
              isMain: true,
              area: 'Muscat',
              city: 'Muscat',
            ),
          ],
        ),
      ];
    }

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/customer/tenants',
        queryParameters: {'phone': normalizedPhone},
      );
      final traceId = payload['traceId'] as String?;
      AppLogger.info(
        'Tenant lookup response received for phone=$normalizedPhone traceId=${traceId ?? 'none'}',
      );
      final data = payload['data'];
      if (data is! List) {
        AppLogger.warning(
          'Tenant lookup returned non-list payload for phone=$normalizedPhone traceId=${traceId ?? 'none'}',
        );
        return const [];
      }

      final tenants = data
          .whereType<Map<String, Object?>>()
          .map(TenantModel.fromJson)
          .toList(growable: false);
      AppLogger.info(
        'Tenant lookup completed for phone=$normalizedPhone tenants=${tenants.length} traceId=${traceId ?? 'none'}',
      );
      return tenants;
    } on MobileHttpException catch (error) {
      final traceId = error.originalError is Map<String, Object?>
          ? (error.originalError as Map<String, Object?>)['traceId'] as String?
          : null;
      AppLogger.error(
        'Tenant lookup failed for phone=$normalizedPhone traceId=${traceId ?? 'none'}',
        error: error,
      );
      throw TenantServiceException(
        code: error.code,
        messageKey: 'tenant.listErrorWithPhone',
        originalError: error,
        phoneNumber: normalizedPhone,
        traceId: traceId,
      );
    }
  }

  Future<TenantModel> resolveBySlug(String slug) async {
    final trimmed = slug.trim().toLowerCase();
    if (trimmed.isEmpty) {
      throw const TenantServiceException(
        code: 'tenant_invalid_slug',
        messageKey: 'tenant.notFoundError',
      );
    }

    if (!_httpClient.config.hasApiBaseUrl) {
      // Demo mode — return a stub tenant so the app can be developed offline.
      return const TenantModel(
        tenantOrgId: 'demo-tenant-org-id',
        name: 'Demo Laundry',
        name2: 'مغسلة تجريبية',
        primaryColor: '#1A73E8',
        branches: [
          BranchOptionModel(
            id: 'demo-main-branch',
            name: 'Main Branch',
            name2: 'الفرع الرئيسي',
            isMain: true,
            area: 'Muscat',
            city: 'Muscat',
          ),
        ],
      );
    }

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/tenant/resolve',
        queryParameters: {'slug': trimmed},
      );

      if (payload['success'] != true) {
        throw const TenantServiceException(
          code: 'tenant_not_found',
          messageKey: 'tenant.notFoundError',
        );
      }

      final data = payload['data'];
      if (data is! Map<String, Object?>) {
        throw const TenantServiceException(
          code: 'tenant_invalid_payload',
          messageKey: 'tenant.notFoundError',
        );
      }

      return TenantModel.fromJson(data);
    } on MobileHttpException catch (error) {
      if (error.statusCode == 404) {
        throw const TenantServiceException(
          code: 'tenant_not_found',
          messageKey: 'tenant.notFoundError',
        );
      }
      throw TenantServiceException(
        code: error.code,
        messageKey: 'tenant.notFoundError',
        originalError: error,
      );
    }
  }
}
