import 'dart:async';

import 'package:customer_app/core/app_shell_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_services/mobile_services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restores a saved guest session across controller instances', () async {
    final storage = InMemorySessionStorage();
    final firstController = CustomerAppController(
      sessionManager: SessionManager(storage: storage),
      connectivityService: FakeConnectivityService(initiallyOnline: true),
    );

    await firstController.enterGuestMode();

    final secondController = CustomerAppController(
      sessionManager: SessionManager(storage: storage),
      connectivityService: FakeConnectivityService(initiallyOnline: true),
    );

    await secondController.bootstrap();

    expect(secondController.hasSession, isTrue);
    expect(secondController.session?.isGuest, isTrue);
  });

  test('clearSession removes the saved session', () async {
    final storage = InMemorySessionStorage();
    final controller = CustomerAppController(
      sessionManager: SessionManager(storage: storage),
      connectivityService: FakeConnectivityService(initiallyOnline: true),
    );

    await controller.enterGuestMode();
    await controller.clearSession();

    final restoredController = CustomerAppController(
      sessionManager: SessionManager(storage: storage),
      connectivityService: FakeConnectivityService(initiallyOnline: true),
    );
    await restoredController.bootstrap();

    expect(restoredController.hasSession, isFalse);
    expect(restoredController.session, isNull);
  });

  test('routes into offline mode when connectivity is unavailable', () async {
    final controller = CustomerAppController(
      sessionManager: SessionManager(storage: InMemorySessionStorage()),
      connectivityService: FakeConnectivityService(initiallyOnline: false),
    );

    await controller.bootstrap();

    expect(controller.hasConnectivityIssue, isTrue);
    expect(controller.resolveInitialRoute(), '/offline');
    expect(controller.canAccessRoute('/home'), isFalse);
  });

  test('refreshConnectivityStatus clears offline mode after reconnect',
      () async {
    final connectivityService = FakeConnectivityService(initiallyOnline: false);
    final controller = CustomerAppController(
      sessionManager: SessionManager(storage: InMemorySessionStorage()),
      connectivityService: connectivityService,
    );

    await controller.bootstrap();
    connectivityService.setOnline(true);
    await controller.refreshConnectivityStatus();

    expect(controller.hasConnectivityIssue, isFalse);
    expect(controller.resolveInitialRoute(), '/entry');
  });
}

class FakeConnectivityService extends ConnectivityService {
  FakeConnectivityService({
    required bool initiallyOnline,
  }) : _isOnline = initiallyOnline;

  final StreamController<bool> _controller = StreamController<bool>.broadcast();
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
