import 'package:mobile_domain/mobile_domain.dart';

import 'session_storage.dart';

class SessionManager {
  SessionManager({
    SessionStorage? storage,
  }) : _storage = storage ?? InMemorySessionStorage();

  final SessionStorage _storage;

  Future<CustomerSessionModel?> restoreSession() async {
    return _storage.read();
  }

  Future<void> saveSession(CustomerSessionModel session) async {
    await _storage.write(session);
  }

  Future<void> clearSession() async {
    await _storage.clear();
  }
}
