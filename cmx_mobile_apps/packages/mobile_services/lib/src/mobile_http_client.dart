import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

class MobileHttpException extends AppException {
  const MobileHttpException({
    required super.code,
    required super.messageKey,
    super.originalError,
    this.statusCode,
  });

  final int? statusCode;
}

/// Public HTTP client with optional 401 → refresh → retry.
///
/// [onSessionRefresh] is invoked once per burst (concurrent 401s share the same
/// [Future]) when a Bearer request returns 401. The refresh call itself must use
/// a [MobileHttpClient] with **no** [onSessionRefresh] to avoid recursion.
class MobileHttpClient {
  MobileHttpClient({
    http.Client? client,
    AppConfig? config,
    this.onSessionRefresh,
  })  : _client = client ?? http.Client(),
        _config = config ?? AppConfig.fromEnvironment();

  final http.Client _client;
  final AppConfig _config;

  /// Returns a new session to retry the request, or `null` to signal logout / failure.
  final Future<CustomerSessionModel?> Function()? onSessionRefresh;

  Future<CustomerSessionModel?>? _refreshInFlight;

  AppConfig get config => _config;

  Future<Map<String, Object?>> getJson(
    String path, {
    Map<String, String>? headers,
    Map<String, String>? queryParameters,
    bool isRetryAfterTokenRefresh = false,
  }) async {
    return _sendJson(
      method: 'GET',
      path: path,
      headers: headers,
      queryParameters: queryParameters,
      isRetryAfterTokenRefresh: isRetryAfterTokenRefresh,
    );
  }

  Future<Map<String, Object?>> postJson(
    String path, {
    Map<String, String>? headers,
    Object? body,
    Map<String, String>? queryParameters,
    bool isRetryAfterTokenRefresh = false,
  }) async {
    return _sendJson(
      method: 'POST',
      path: path,
      headers: headers,
      body: body,
      queryParameters: queryParameters,
      isRetryAfterTokenRefresh: isRetryAfterTokenRefresh,
    );
  }

  Future<CustomerSessionModel?> _coordinatedSessionRefresh() {
    if (_refreshInFlight != null) {
      return _refreshInFlight!;
    }
    _refreshInFlight = onSessionRefresh!().whenComplete(() {
      _refreshInFlight = null;
    });
    return _refreshInFlight!;
  }

  static bool _isTokenRefreshPath(String requestPath) {
    final p = requestPath.toLowerCase();
    return p.contains('auth/refresh') || p.contains('auth%2Frefresh');
  }

  static bool _hasAuthorizationBearer(Map<String, String>? headers) {
    if (headers == null || headers.isEmpty) {
      return false;
    }
    for (final e in headers.entries) {
      if (e.key.toLowerCase() == 'authorization' &&
          e.value.toLowerCase().startsWith('bearer ')) {
        return true;
      }
    }
    return false;
  }

  static Map<String, String> _withBearerReplaced(
    Map<String, String>? headers,
    String token,
  ) {
    final m = <String, String>{...?headers};
    m['Authorization'] = 'Bearer $token';
    return m;
  }

  Future<Map<String, Object?>> _sendJson({
    required String method,
    required String path,
    Map<String, String>? headers,
    Object? body,
    Map<String, String>? queryParameters,
    required bool isRetryAfterTokenRefresh,
  }) async {
    final baseUri = Uri.parse(_config.apiBaseUrl);
    final normalizedBasePath = baseUri.path.endsWith('/')
        ? baseUri.path.substring(0, baseUri.path.length - 1)
        : baseUri.path;
    final normalizedRequestPath = path.startsWith('/') ? path : '/$path';
    final uri = baseUri.replace(
      path: '$normalizedBasePath$normalizedRequestPath',
      queryParameters: queryParameters,
    );

    final requestHeaders = <String, String>{
      'Content-Type': 'application/json',
      ...?headers,
    };

    http.Response response;

    try {
      switch (method) {
        case 'POST':
          response = await _client.post(
            uri,
            headers: requestHeaders,
            body: jsonEncode(body),
          );
          break;
        case 'GET':
        default:
          response = await _client.get(uri, headers: requestHeaders);
          break;
      }
    } catch (error, stackTrace) {
      AppLogger.error(
        'Mobile HTTP request failed: $method $uri',
        error: error,
        stackTrace: stackTrace,
      );
      throw MobileHttpException(
        code: 'network_request_failed',
        messageKey: 'common.networkError',
        originalError: error,
      );
    }

    Map<String, Object?> payload = <String, Object?>{};
    if (response.body.isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, Object?>) {
        payload = decoded;
      }
    }

    if (response.statusCode == 401 &&
        onSessionRefresh != null &&
        !isRetryAfterTokenRefresh &&
        !MobileHttpClient._isTokenRefreshPath(path) &&
        _hasAuthorizationBearer(requestHeaders) &&
        _config.hasApiBaseUrl) {
      final fresh = await _coordinatedSessionRefresh();
      if (fresh == null || !fresh.hasVerificationToken) {
        throw MobileHttpException(
          code: 'session_expired',
          messageKey: 'common.sessionExpired',
          originalError: payload['error'] ?? response.body,
          statusCode: 401,
        );
      }
      return _sendJson(
        method: method,
        path: path,
        headers: _withBearerReplaced(requestHeaders, fresh.verificationToken!),
        body: body,
        queryParameters: queryParameters,
        isRetryAfterTokenRefresh: true,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (isRetryAfterTokenRefresh && response.statusCode == 401) {
        throw MobileHttpException(
          code: 'session_expired',
          messageKey: 'common.sessionExpired',
          originalError: payload['error'] ?? response.body,
          statusCode: 401,
        );
      }
      throw MobileHttpException(
        code: payload['errorCode'] as String? ?? 'remote_request_failed',
        messageKey: 'common.remoteRequestError',
        originalError: payload.isNotEmpty ? payload : response.body,
        statusCode: response.statusCode,
      );
    }

    return payload;
  }
}
