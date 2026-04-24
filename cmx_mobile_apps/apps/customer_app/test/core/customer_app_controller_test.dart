import 'dart:async';

import 'package:customer_app/core/app_shell_controller.dart';
import 'package:customer_app/core/navigation/app_route.dart';
import 'package:customer_app/core/providers/app_dependencies.dart';
import 'package:customer_app/core/providers/session_manager_provider.dart';
import 'package:customer_app/features/tenant/providers/tenant_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restores a saved guest session after bootstrap (shared storage)', () async {
    final storage = InMemorySessionStorage();
    final sm = SessionManager(storage: storage);
    final c1 = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(sm),
        connectivityServiceProvider.overrideWithValue(
          _FakeConnectivityService(initiallyOnline: true),
        ),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c1.dispose);
    await c1.read(tenantProvider.future);

    await c1.read(customerSessionFlowProvider.notifier).enterGuestMode();
    expect(c1.read(customerSessionFlowProvider).hasSession, isTrue);

    final c2 = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(sm),
        connectivityServiceProvider.overrideWithValue(
          _FakeConnectivityService(initiallyOnline: true),
        ),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c2.dispose);
    await c2.read(tenantProvider.future);
    await c2.read(customerSessionFlowProvider.notifier).bootstrap();
    final s = c2.read(customerSessionFlowProvider);
    expect(s.hasSession, isTrue);
    expect(s.session?.isGuest, isTrue);
  });

  test('clearSession removes the saved session', () async {
    final storage = InMemorySessionStorage();
    final sm = SessionManager(storage: storage);
    final c = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(sm),
        connectivityServiceProvider.overrideWithValue(
          _FakeConnectivityService(initiallyOnline: true),
        ),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c.dispose);
    await c.read(tenantProvider.future);
    final n = c.read(customerSessionFlowProvider.notifier);
    await n.enterGuestMode();
    await n.clearSession();
    final c2 = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(sm),
        connectivityServiceProvider.overrideWithValue(
          _FakeConnectivityService(initiallyOnline: true),
        ),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c2.dispose);
    await c2.read(customerSessionFlowProvider.notifier).bootstrap();
    expect(c2.read(customerSessionFlowProvider).hasSession, isFalse);
  });

  test('bootstrap when offline shows connectivity issue', () async {
    final c = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(
          SessionManager(storage: InMemorySessionStorage()),
        ),
        connectivityServiceProvider.overrideWithValue(
          _FakeConnectivityService(initiallyOnline: false),
        ),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c.dispose);
    await c.read(customerSessionFlowProvider.notifier).bootstrap();
    expect(
      c.read(customerSessionFlowProvider).hasConnectivityIssue,
      isTrue,
    );
    final route = resolveGatedDefaultRoute(
      flow: c.read(customerSessionFlowProvider),
      tenantState: c.read(tenantProvider),
    );
    expect(route, AppRoute.offline);
  });

  test('refreshConnectivityStatus clears offline mode after reconnect', () async {
    final connectivity = _FakeConnectivityService(initiallyOnline: false);
    final c = ProviderContainer(
      overrides: [
        sessionManagerProvider.overrideWithValue(
          SessionManager(storage: InMemorySessionStorage()),
        ),
        connectivityServiceProvider.overrideWithValue(connectivity),
        tenantProvider.overrideWith(_FixedTenant.new),
      ],
    );
    addTearDown(c.dispose);
    final n = c.read(customerSessionFlowProvider.notifier);
    await n.bootstrap();
    expect(c.read(customerSessionFlowProvider).hasConnectivityIssue, isTrue);
    connectivity.setOnline(true);
    await n.refreshConnectivityStatus();
    final flow = c.read(customerSessionFlowProvider);
    expect(flow.hasConnectivityIssue, isFalse);
    final route = resolveGatedDefaultRoute(
      flow: c.read(customerSessionFlowProvider),
      tenantState: c.read(tenantProvider),
    );
    expect(route, isNotNull);
  });
}

class _FixedTenant extends TenantNotifier {
  @override
  Future<TenantModel?> build() async {
    return const TenantModel(
      tenantOrgId: 'test-tenant',
      name: 'Test',
    );
  }
}

class _FakeConnectivityService extends ConnectivityService {
  _FakeConnectivityService({required bool initiallyOnline})
      : _isOnline = initiallyOnline;

  final _controller = StreamController<bool>.broadcast();
  bool _isOnline;

  @override
  Stream<bool> connectivityChanges() => _controller.stream;

  @override
  Future<bool> isOnline() async => _isOnline;

  void setOnline(bool isOnline) {
    _isOnline = isOnline;
    _controller.add(isOnline);
  }
}
