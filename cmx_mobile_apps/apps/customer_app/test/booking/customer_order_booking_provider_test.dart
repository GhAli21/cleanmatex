import 'package:customer_app/features/booking/providers/customer_order_booking_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_domain/mobile_domain.dart';

void main() {
  test('advances through the 6-step POS-parity booking flow and submits',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerOrderBookingProvider.notifier);
    await notifier.load();

    var state = container.read(customerOrderBookingProvider);
    expect(state.services, isNotEmpty);
    expect(state.addresses, isNotEmpty);
    expect(state.categories, isNotEmpty);
    expect(state.draft.branchId, 'demo-main-branch');
    expect(state.draft.generalOrderNote, isNotEmpty);
    expect(state.draft.saveGeneralNoteForFuture, isTrue);

    // Step 0: Fulfillment & mandatory Branch
    expect(state.stepIndex, 0);
    notifier.setPickupMode(CustomerPickupMode.collectAddress);
    notifier.setDeliveryMode(CustomerDeliveryMode.deliverAddress);
    expect(notifier.canProceed(), isTrue);
    notifier.goNext();

    // Step 1: Select items + per-item notes + per-piece extra-price prefs
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 1);
    expect(notifier.canProceed(), isFalse);
    final firstItem = state.categories.first.items.first;
    notifier.addItem(firstItem.id);
    notifier.setItemNote(firstItem.id, 'Light press on collar');
    state = container.read(customerOrderBookingProvider);
    expect(state.draft.cartItems[firstItem.id], 1);
    expect(state.draft.itemNotes[firstItem.id], 'Light press on collar');
    expect(notifier.canProceed(), isTrue);
    notifier.goNext();

    // Step 2: Predefined profile preferences + master toggle + preferences note
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 2);
    notifier.setApplyProfilePrefsToAll(true);
    notifier.setPreferencesNote('Extra careful with buttons');
    final servicePreference =
        state.preferenceOptionsForKind('service_prefs').first;
    notifier.togglePreferenceForKind('service_prefs', servicePreference.id);
    state = container.read(customerOrderBookingProvider);
    expect(state.draft.preferencesNote, 'Extra careful with buttons');
    expect(state.estimatedSubtotal,
        firstItem.unitPrice + servicePreference.extraPrice);
    notifier.goNext();

    // Step 3: Schedule & Speed
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 3);
    notifier.chooseServiceSpeed('EXPRESS');
    expect(notifier.canProceed(), isTrue);
    notifier.goNext();

    // Step 4: Promo, Gift Card, Payment Notes & General Order Note
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 4);
    notifier.setPromoCode('WELCOME10');
    notifier.setGiftCardCode('GC-100');
    notifier.setPaymentNotes('Card on delivery');
    notifier.setGeneralOrderNote('Call 10 minutes before arrival');
    notifier.setSaveGeneralNoteForFuture(true);
    notifier.goNext();

    // Step 5: POS-Parity Server-Priced Review + Submit
    state = container.read(customerOrderBookingProvider);
    expect(state.stepIndex, 5);
    await notifier.submit();

    state = container.read(customerOrderBookingProvider);
    expect(state.hasSubmissionSuccess, isTrue);
    expect(state.submittedOrderNumber, 'CMX-20001');
  });

  test('shows specific missing details when scheduled pickup lacks datetime',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerOrderBookingProvider.notifier);
    await notifier.load();

    final state0 = container.read(customerOrderBookingProvider);
    final firstItem = state0.categories.first.items.first;
    notifier.addItem(firstItem.id);
    notifier.setPickupMode(CustomerPickupMode.collectAddress);
    notifier.setIsAsap(false);

    await notifier.submit();

    final state = container.read(customerOrderBookingProvider);
    expect(state.hasSubmissionSuccess, isFalse);
    expect(state.errorMessageKey, 'booking.validationIncomplete');
    expect(state.validationIssueKeys, ['booking.missingScheduleDetail']);
  });

  test('clears a speed no longer offered by the organization on reload',
      () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    final notifier = container.read(customerOrderBookingProvider.notifier);
    notifier.chooseServiceSpeed('NON_EXISTENT_SPEED');
    expect(
      container.read(customerOrderBookingProvider).draft.serviceSpeed,
      'NON_EXISTENT_SPEED',
    );

    await notifier.load();

    expect(
      container.read(customerOrderBookingProvider).draft.serviceSpeed,
      isNull,
    );
  });
}
