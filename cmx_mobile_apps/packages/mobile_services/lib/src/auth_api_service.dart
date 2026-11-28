import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'mobile_http_client.dart';

class AuthServiceException extends AppException {
  const AuthServiceException({
    required super.code,
    required super.messageKey,
    super.originalError,
  });
}

class AuthApiService {
  AuthApiService({MobileHttpClient? httpClient, AppConfig? config})
      : _httpClient = httpClient ?? MobileHttpClient(config: config);

  final MobileHttpClient _httpClient;

  bool get _hasRemoteConfig => _httpClient.config.hasApiBaseUrl;

  Future<CustomerAuthChallengeModel> requestOtp({
    required String phoneNumber,
    String? tenantId,
    String channel = 'SMS',
    String? email,
  }) async {
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phoneNumber.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
      );
    }

    if (!_hasRemoteConfig) {
      return CustomerAuthChallengeModel(
        phoneNumber: phoneNumber,
        challengeId: 'challenge-$phoneNumber',
      );
    }

    try {
      await _httpClient.postJson(
        '/api/v1/public/customer/auth/request-otp',
        body: {
          'phone': phoneNumber,
          if (tenantId != null && tenantId.isNotEmpty) 'tenantId': tenantId,
          'channel': channel,
          if (email != null && email.trim().isNotEmpty)
            'email': email.trim().toLowerCase(),
        },
      );
    } on MobileHttpException catch (error) {
      AppLogger.error(
        'auth_api.request_otp_failed status=${error.statusCode} code=${error.code} channel=$channel',
        error: error,
      );
      throw AuthServiceException(
        code: error.code,
        messageKey: 'loginEntry.genericError',
        originalError: error,
      );
    }

    return CustomerAuthChallengeModel(
      phoneNumber: phoneNumber,
      challengeId: 'challenge-$phoneNumber',
    );
  }

  Future<CustomerSessionModel> verifyOtp({
    required CustomerAuthChallengeModel challenge,
    required String otpCode,
    required String tenantOrgId,
    BranchOptionModel? branch,
  }) async {
    if (!RegExp(r'^[0-9]{6}$').hasMatch(otpCode.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_otp',
        messageKey: 'otpEntry.codeValidationError',
      );
    }

    if (!_hasRemoteConfig) {
      return CustomerSessionModel(
        customerId: 'customer-${challenge.phoneNumber}',
        phoneNumber: challenge.phoneNumber,
        isGuest: false,
        tenantOrgId: tenantOrgId,
        branchId: branch?.id,
        branchName: branch?.name,
        branchName2: branch?.name2,
      );
    }

    try {
      final verificationResponse = await _httpClient.postJson(
        '/api/v1/customers/verify-otp',
        body: {'phone': challenge.phoneNumber, 'code': otpCode},
      );

      final isVerified = verificationResponse['verified'] == true;
      final verificationToken = verificationResponse['token'] as String?;
      if (!isVerified ||
          verificationToken == null ||
          verificationToken.isEmpty) {
        throw const AuthServiceException(
          code: 'auth_verification_failed',
          messageKey: 'otpEntry.genericError',
        );
      }

      final sessionResponse = await _httpClient.postJson(
        '/api/v1/public/customer/session',
        body: {'tenantId': tenantOrgId, 'verificationToken': verificationToken},
      );

      final data = sessionResponse['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_session_payload',
          messageKey: 'otpEntry.genericError',
        );
      }

      return _sessionWithBranch(CustomerSessionModel.fromJson(data), branch);
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'otpEntry.genericError',
        originalError: error,
      );
    }
  }

  Future<bool> checkHasPassword({
    required String phoneNumber,
    required String tenantId,
  }) async {
    if (!_hasRemoteConfig) {
      return false;
    }

    try {
      final response = await _httpClient.getJson(
        '/api/v1/public/customer/auth-options',
        queryParameters: {'tenantId': tenantId, 'phone': phoneNumber},
      );
      final data = response['data'];
      if (data is Map<String, Object?>) {
        return data['hasPassword'] == true;
      }
      return false;
    } on MobileHttpException {
      return false;
    }
  }

  Future<CustomerSessionModel> loginWithPassword({
    required String phoneNumber,
    required String password,
    required String tenantId,
    BranchOptionModel? branch,
  }) async {
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phoneNumber.trim())) {
      throw const AuthServiceException(
        code: 'auth_invalid_phone',
        messageKey: 'loginEntry.phoneValidationError',
      );
    }

    if (password.length < 6) {
      throw const AuthServiceException(
        code: 'auth_password_too_short',
        messageKey: 'auth.passwordMinLengthError',
      );
    }

    // 1. Try 0854 global Customer App Argon2id login first (issues opaque access token).
    final split = _splitCountryAndMobile(phoneNumber.trim());
    if (split != null) {
      try {
        final globalResponse = await _httpClient.postJson(
          '/api/v1/public/customer/auth/login',
          body: {
            'identity': {
              'kind': 'PHONE',
              'countryCode': split.$1,
              'mobileNumber': split.$2,
            },
            'password': password,
          },
        );
        final data = globalResponse['data'];
        if (data is Map<String, Object?>) {
          final tokens = data['tokens'];
          final accessToken = tokens is Map<String, Object?>
              ? tokens['accessToken'] as String?
              : null;
          if (accessToken != null && accessToken.isNotEmpty) {
            return _sessionWithBranch(
              CustomerSessionModel(
                customerId: data['customerId'] as String? ?? '',
                phoneNumber: data['mobileE164'] as String? ?? phoneNumber,
                isGuest: false,
                tenantOrgId: tenantId,
                displayName: data['displayName'] as String?,
                verificationToken: accessToken,
                hasPassword: true,
              ),
              branch,
            );
          }
        }
      } on MobileHttpException catch (error) {
        AppLogger.info(
          'auth_api.global_login_fallback status=${error.statusCode} code=${error.code}',
        );
      }
    }

    // 2. Fallback to per-tenant scrypt password login (and demo mobile-as-password login).
    try {
      final response = await _httpClient.postJson(
        '/api/v1/public/customer/login',
        body: {
          if (tenantId.trim().isNotEmpty) 'tenantId': tenantId.trim(),
          'phone': phoneNumber,
          'password': password,
        },
      );

      final data = response['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_login_payload',
          messageKey: 'auth.invalidPasswordError',
        );
      }

      return _sessionWithBranch(CustomerSessionModel.fromJson(data), branch);
    } on MobileHttpException catch (error) {
      AppLogger.error(
        'auth_api.password_login_failed status=${error.statusCode} code=${error.code}',
        error: error,
      );
      throw AuthServiceException(
        code: error.code,
        messageKey: 'auth.invalidPasswordError',
        originalError: error,
      );
    }
  }

  /// Splits E.164 phone (`+96891234567`, `+966501234567`) into `(countryCode, mobileNumber)`.
  (String, String)? _splitCountryAndMobile(String raw) {
    final cleaned = raw.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    const gccCodes = ['+968', '+966', '+971', '+974', '+973', '+965', '+962', '+20'];
    for (final code in gccCodes) {
      if (cleaned.startsWith(code) && cleaned.length > code.length + 5) {
        return (code, cleaned.substring(code.length));
      }
      final bare = code.substring(1);
      if (cleaned.startsWith(bare) && cleaned.length > bare.length + 5) {
        return (code, cleaned.substring(bare.length));
      }
    }
    return null;
  }

  Future<void> setPassword({
    required String verificationToken,
    required String tenantId,
    required String newPassword,
  }) async {
    if (!_hasRemoteConfig) {
      return;
    }

    try {
      await _httpClient.postJson(
        '/api/v1/public/customer/password',
        body: {
          'tenantId': tenantId,
          'verificationToken': verificationToken,
          'newPassword': newPassword,
        },
      );
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'common.remoteRequestError',
        originalError: error,
      );
    }
  }

  Future<CustomerSessionModel> refreshSession({
    required CustomerSessionModel session,
  }) async {
    if (!_hasRemoteConfig) {
      return session;
    }

    try {
      final response = await _httpClient.postJson(
        '/api/v1/public/customer/auth/refresh',
        headers: {'Authorization': 'Bearer ${session.verificationToken}'},
        body: {'tenantId': session.tenantOrgId},
      );

      final data = response['data'];
      if (data is! Map<String, Object?>) {
        throw const AuthServiceException(
          code: 'auth_invalid_refresh_payload',
          messageKey: 'common.remoteRequestError',
        );
      }

      return _sessionWithBranch(
        CustomerSessionModel.fromJson(data),
        session.branchId == null
            ? null
            : BranchOptionModel(
                id: session.branchId!,
                name: session.branchName ?? '',
                name2: session.branchName2,
              ),
      );
    } on MobileHttpException catch (error) {
      throw AuthServiceException(
        code: error.code,
        messageKey: 'common.remoteRequestError',
        originalError: error,
      );
    }
  }

  CustomerSessionModel _sessionWithBranch(
    CustomerSessionModel session,
    BranchOptionModel? branch,
  ) {
    if (branch == null) return session;
    return CustomerSessionModel(
      customerId: session.customerId,
      phoneNumber: session.phoneNumber,
      isGuest: session.isGuest,
      tenantOrgId: session.tenantOrgId,
      branchId: branch.id,
      branchName: branch.name,
      branchName2: branch.name2,
      displayName: session.displayName,
      verificationToken: session.verificationToken,
      hasPassword: session.hasPassword,
    );
  }
}
