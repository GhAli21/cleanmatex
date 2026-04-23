import 'package:customer_app/features/booking/providers/customer_order_booking_provider.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('advances through the booking flow and stores submission success',
      () async {
    final provider = CustomerOrderBookingProvider();

    await provider.load();

    expect(provider.services, isNotEmpty);
    expect(provider.addresses, isNotEmpty);
    expect(provider.slots, isNotEmpty);

    provider.chooseService(provider.services.first);
    expect(provider.canProceed(), isTrue);

    provider.goNext();
    expect(provider.stepIndex, 1);
    expect(provider.draft.address, isNotNull);
    expect(provider.canProceed(), isTrue);

    provider.goNext();
    expect(provider.stepIndex, 2);

    provider.chooseSlot(provider.slots.first);
    expect(provider.canProceed(), isTrue);

    provider.goNext();
    provider.updateNotes('Leave at the front desk.');

    await provider.submit();

    expect(provider.hasSubmissionSuccess, isTrue);
    expect(provider.submittedOrderNumber, 'CMX-20001');
  });
}
