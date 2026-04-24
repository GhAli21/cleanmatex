import 'package:customer_app/features/booking/providers/customer_order_booking_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('advances through the booking flow and stores submission success',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerOrderBookingProvider.notifier);
    await notifier.load();

    var state = container.read(customerOrderBookingProvider);
    expect(state.services, isNotEmpty);
    expect(state.addresses, isNotEmpty);
    expect(state.slots, isNotEmpty);

    notifier.chooseService(state.services.first);
    expect(notifier.canProceed(), isTrue);

    notifier.goNext();
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 1);
    expect(state.draft.address, isNotNull);
    expect(notifier.canProceed(), isTrue);

    notifier.goNext();
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 2);

    notifier.chooseSlot(state.slots.first);
    expect(notifier.canProceed(), isTrue);

    notifier.goNext();
    notifier.updateNotes('Leave at the front desk.');

    await notifier.submit();

    state = container.read(customerOrderBookingProvider);
    expect(state.hasSubmissionSuccess, isTrue);
    expect(state.submittedOrderNumber, 'CMX-20001');
  });
}
