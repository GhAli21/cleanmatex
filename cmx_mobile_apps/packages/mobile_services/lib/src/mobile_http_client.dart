import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:mobile_core/mobile_core.dart';

class MobileHttpException extends AppException {
  const MobileHttpException({
    required super.code,
    required super.messageKey,
    super.originalError,
    this.statusCode,
  });

  final int? statusCode;
}

class MobileHttpClient {
  MobileHttpClient({
    http.Client? client,
    AppConfig? config,
  })  : _client = client ?? http.Client(),
        _config = config ?? AppConfig.fromEnvironment();

  final http.Client _client;
  final AppConfig _config;

  AppConfig get config => _config;

  Future<Map<String, Object?>> getJson(
    String path, {
    Map<String, String>? headers,
    Map<String, String>? queryParameters,
  }) async {
    return _sendJson(
      method: 'GET',
      path: path,
      headers: headers,
      queryParameters: queryParameters,
    );
  }

  Future<Map<String, Object?>> postJson(
    String path, {
    Map<String, String>? headers,
    Object? body,
    Map<String, String>? queryParameters,
  }) async {
    return _sendJson(
      method: 'POST',
      path: path,
      headers: headers,
      body: body,
      queryParameters: queryParameters,
    );
  }

  Future<Map<String, Object?>> _sendJson({
    required String method,
    required String path,
    Map<String, String>? headers,
    Object? body,
    Map<String, String>? queryParameters,
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

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MobileHttpException(
        code: 'remote_request_failed',
        messageKey: 'common.remoteRequestError',
        originalError: payload['error'] ?? response.body,
        statusCode: response.statusCode,
      );
    }

    return payload;
  }
}
