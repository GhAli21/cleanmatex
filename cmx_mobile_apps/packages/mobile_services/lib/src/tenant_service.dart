import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class TenantServiceException extends AppException {
  const TenantServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}

class TenantService {
  TenantService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  Future<List<TenantModel>> listTenantsForPhone(String phoneNumber) async {
    if (!RegExp(r'^\+?[0-9]{4,15}$').hasMatch(phoneNumber.trim())) {
      throw const TenantServiceException(
        code: 'tenant_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
      );
    }

    if (!_httpClient.config.hasApiBaseUrl) {
      return const [
        TenantModel(
          tenantOrgId: 'demo-tenant-org-id',
          name: 'Demo Laundry',
          name2: 'مغسلة تجريبية',
          primaryColor: '#1A73E8',
        ),
      ];
    }

    try {
      final payload = await _httpClient.getJson(
        '/api/v1/public/customer/tenants',
        queryParameters: {'phone': phoneNumber.trim()},
      );
      final data = payload['data'];
      if (data is! List) {
        return const [];
      }

      return data
          .whereType<Map<String, Object?>>()
          .map(TenantModel.fromJson)
          .toList(growable: false);
    } on MobileHttpException catch (error) {
      throw TenantServiceException(
        code: error.code,
        messageKey: 'tenant.listError',
        originalError: error,
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
