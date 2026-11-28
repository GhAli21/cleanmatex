import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../tenant/providers/tenant_provider.dart';
import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_address_form_widget.dart';
import '../widgets/customer_booking_step_header_widget.dart';
import '../widgets/customer_fulfillment_branch_widget.dart';

/// Step 1/6 of Detailed Order: Mandatory Branch + 2×2 Pickup & Delivery Selector.
class CustomerBookingStep0FulfillmentVw extends ConsumerStatefulWidget {
  const CustomerBookingStep0FulfillmentVw({super.key});

  @override
  ConsumerState<CustomerBookingStep0FulfillmentVw> createState() =>
      _CustomerBookingStep0FulfillmentVwState();
}

class _CustomerBookingStep0FulfillmentVwState
    extends ConsumerState<CustomerBookingStep0FulfillmentVw> {
  bool _showAddressForm = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final tenant = ref.watch(tenantProvider).valueOrNull;

    ref.listen(
      customerOrderBookingProvider.select(
        (s) => (s.isSavingAddress, s.draft.address?.id),
      ),
      (prev, next) {
        if (prev?.$1 == true && next.$1 == false && next.$2 != null) {
          setState(() => _showAddressForm = false);
        }
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: l10n.text('booking.step0Title'),
          description: l10n.text('booking.step0Description'),
        ),
        const SizedBox(height: AppSpacing.lg),
        CustomerFulfillmentBranchWidget(
          branches: tenant?.branches ?? const [],
          selectedBranchId: booking.draft.branchId,
          lastBranchId:
              booking.customerProfile?.lastBranchId ?? tenant?.lastBranchId,
          isBranchMandatory: true,
          onBranchChanged: notifier.chooseBranch,
          pickupMode: booking.draft.pickupMode,
          onPickupModeChanged: notifier.setPickupMode,
          deliveryMode: booking.draft.deliveryMode,
          onDeliveryModeChanged: notifier.setDeliveryMode,
          addresses: booking.addresses,
          selectedPickupAddressId: booking.draft.address?.id,
          onPickupAddressChanged: notifier.chooseAddress,
          selectedDeliveryAddressId:
              (booking.draft.deliveryAddress ?? booking.draft.address)?.id,
          onDeliveryAddressChanged: notifier.chooseDeliveryAddress,
          onAddAddressTapped: () =>
              setState(() => _showAddressForm = !_showAddressForm),
        ),
        if (_showAddressForm) ...[
          const SizedBox(height: AppSpacing.md),
          const AppCardWidget(
            child: CustomerBookingAddressFormWidget(),
          ),
        ],
      ],
    );
  }
}
