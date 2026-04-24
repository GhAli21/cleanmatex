import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

const Duration _secureStorageReadTimeout = Duration(milliseconds: 1200);

abstract class SessionStorage {
  Future<CustomerSessionModel?> read();

  Future<void> write(CustomerSessionModel session);

  Future<void> clear();
}

class InMemorySessionStorage implements SessionStorage {
  static CustomerSessionModel? _storedSession;

  @override
  Future<void> clear() async {
    _storedSession = null;
  }

  @override
  Future<CustomerSessionModel?> read() async {
    return _storedSession;
  }

  @override
  Future<void> write(CustomerSessionModel session) async {
    _storedSession = session;
  }
}

class FlutterSecureStorageSessionStorage implements SessionStorage {
  FlutterSecureStorageSessionStorage({
    FlutterSecureStorage? storage,
  }) : _storage = storage ?? const FlutterSecureStorage();

  static const _sessionKey = 'cmx_customer_session';

  final FlutterSecureStorage _storage;

  @override
  Future<void> clear() async {
    await _storage.delete(key: _sessionKey);
  }

  @override
  Future<CustomerSessionModel?> read() async {
    final rawSession = await _storage.read(key: _sessionKey).timeout(
      _secureStorageReadTimeout,
      onTimeout: () {
        AppLogger.warning(
          'Session storage read timed out; continuing without persisted session.',
        );
        return null;
      },
    );
    if (rawSession == null || rawSession.isEmpty) {
      return null;
    }

    final decoded = jsonDecode(rawSession);
    if (decoded is! Map<String, Object?>) {
      return null;
    }

    return CustomerSessionModel.fromJson(decoded);
  }

  @override
  Future<void> write(CustomerSessionModel session) async {
    await _storage.write(
      key: _sessionKey,
      value: jsonEncode(session.toJson()),
    );
  }
}
