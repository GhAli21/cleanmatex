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
    expect(
        state.visiblePreferenceKinds.map((kind) => kind.kindCode),
        containsAll([
          'service_prefs',
          'packing_prefs',
          'condition_special',
        ]));

    final firstItem = state.categories.first.items.first;
    notifier.addItem(firstItem.id);
    state = container.read(customerOrderBookingProvider);
    expect(state.draft.cartItems[firstItem.id], 1);

    notifier.chooseService(state.services.first);
    expect(notifier.canProceed(), isTrue);

    notifier.goNext();
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 1);
    expect(state.draft.address, isNotNull);
    expect(notifier.canProceed(), isTrue);

    final servicePreference =
        state.preferenceOptionsForKind('service_prefs').first;
    final packingPreference =
        state.preferenceOptionsForKind('packing_prefs').first;
    notifier.togglePreferenceForKind('service_prefs', servicePreference.id);
    notifier.togglePreferenceForKind('packing_prefs', packingPreference.id);
    state = container.read(customerOrderBookingProvider);
    expect(state.draft.selectedServicePreferenceIds, [servicePreference.id]);
    expect(state.draft.selectedPickupPreferenceIds, [packingPreference.id]);
    expect(state.selectedPreferenceCount, 2);
    expect(state.estimatedSubtotal,
        firstItem.unitPrice + servicePreference.extraPrice);

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

  test('shows specific missing details before submit', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerOrderBookingProvider.notifier);
    await notifier.load();

    var state = container.read(customerOrderBookingProvider);
    final firstItem = state.categories.first.items.first;
    notifier.addItem(firstItem.id);
    notifier.setIsPickupFromAddress(true);
    notifier.setIsAsap(false);

    await notifier.submit();

    state = container.read(customerOrderBookingProvider);
    expect(state.hasSubmissionSuccess, isFalse);
    expect(state.errorMessageKey, 'booking.validationIncomplete');
    expect(state.validationIssueKeys, ['booking.missingScheduleDetail']);
  });
}
