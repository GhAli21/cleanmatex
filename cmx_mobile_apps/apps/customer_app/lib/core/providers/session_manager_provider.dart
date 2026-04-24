import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_services/mobile_services.dart';

/// Single [SessionManager] for customer app — shared by tenant persistence and
/// [CustomerSessionModel] so secure storage and tenant JSON stay in sync.
final sessionManagerProvider = Provider<SessionManager>(
  (ref) => SessionManager(
    storage: FlutterSecureStorageSessionStorage(),
  ),
);
