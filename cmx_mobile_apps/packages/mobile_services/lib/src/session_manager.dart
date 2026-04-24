import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile_domain/mobile_domain.dart';

import 'session_storage.dart';

class SessionManager {
  SessionManager({SessionStorage? storage})
      : _storage = storage ?? InMemorySessionStorage(),
        _secureStorage = const FlutterSecureStorage();

  final SessionStorage _storage;
  final FlutterSecureStorage _secureStorage;

  static const _tenantKey = 'cmx_tenant';

  // ── Session ──────────────────────────────────────────────────────────────

  Future<CustomerSessionModel?> restoreSession() => _storage.read();

  Future<void> saveSession(CustomerSessionModel session) =>
      _storage.write(session);

  Future<void> clearSession() => _storage.clear();

  // ── Tenant ────────────────────────────────────────────────────────────────

  Future<TenantModel?> restoreTenant() async {
    try {
      final raw = await _secureStorage.read(key: _tenantKey);
      return TenantModel.fromJsonString(raw);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveTenant(TenantModel tenant) async {
    await _secureStorage.write(key: _tenantKey, value: tenant.toJsonString());
  }

  Future<void> clearTenant() async {
    await _secureStorage.delete(key: _tenantKey);
  }
}
