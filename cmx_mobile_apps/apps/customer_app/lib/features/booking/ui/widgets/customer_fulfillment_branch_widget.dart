import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

/// Shared 2×2 Fulfillment & Branch selector used in BOTH Fast Quick Drop
/// (`isBranchMandatory: false`) and Detailed Order (`isBranchMandatory: true`).
class CustomerFulfillmentBranchWidget extends StatelessWidget {
  const CustomerFulfillmentBranchWidget({
    super.key,
    required this.branches,
    required this.selectedBranchId,
    required this.onBranchChanged,
    required this.pickupMode,
    required this.onPickupModeChanged,
    required this.deliveryMode,
    required this.onDeliveryModeChanged,
    this.isBranchMandatory = true,
    this.lastBranchId,
    this.addresses = const [],
    this.selectedPickupAddressId,
    this.onPickupAddressChanged,
    this.selectedDeliveryAddressId,
    this.onDeliveryAddressChanged,
    this.onAddAddressTapped,
  });

  final List<BranchOptionModel> branches;
  final String? selectedBranchId;
  final ValueChanged<String?> onBranchChanged;
  final CustomerPickupMode pickupMode;
  final ValueChanged<CustomerPickupMode> onPickupModeChanged;
  final CustomerDeliveryMode deliveryMode;
  final ValueChanged<CustomerDeliveryMode> onDeliveryModeChanged;
  final bool isBranchMandatory;
  final String? lastBranchId;
  final List<AddressOptionModel> addresses;
  final String? selectedPickupAddressId;
  final ValueChanged<AddressOptionModel>? onPickupAddressChanged;
  final String? selectedDeliveryAddressId;
  final ValueChanged<AddressOptionModel>? onDeliveryAddressChanged;
  final VoidCallback? onAddAddressTapped;

  String _localizedBranchName(AppLocalizations l10n, BranchOptionModel branch) {
    final isAr = l10n.locale.languageCode == 'ar';
    if (isAr && (branch.name2?.trim().isNotEmpty ?? false)) {
      return branch.name2!;
    }
    return branch.name;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Branch Selection
        Row(
          children: [
            Expanded(
              child: Text(
                isBranchMandatory
                    ? l10n.text('fulfillment.branchMandatoryTitle')
                    : l10n.text('fulfillment.branchOptionalTitle'),
                style: theme.textTheme.titleMedium,
              ),
            ),
            if (isBranchMandatory)
              AppStatusBadgeWidget(
                label: l10n.text('fulfillment.requiredBadge'),
                tone: selectedBranchId != null
                    ? CmxSemanticTone.success
                    : CmxSemanticTone.warning,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          isBranchMandatory
              ? l10n.text('fulfillment.branchMandatoryHint')
              : l10n.text('fulfillment.branchOptionalHint'),
          style: theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (branches.isEmpty)
          AppCardWidget(
            child: Text(
              l10n.text('fulfillment.noBranchesAvailable'),
              style: theme.textTheme.bodyMedium?.copyWith(color: ext.textMuted),
            ),
          )
        else
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (!isBranchMandatory)
                _SelectablePill(
                  label: l10n.text('fulfillment.branchAnyOption'),
                  icon: Icons.auto_awesome_outlined,
                  isSelected: selectedBranchId == null,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onBranchChanged(null);
                  },
                ),
              for (final branch in branches)
                _SelectablePill(
                  label: _localizedBranchName(l10n, branch),
                  subtitle: branch.id == lastBranchId
                      ? l10n.text('tenantSwitcher.lastUsedBadge')
                      : null,
                  icon: Icons.storefront_outlined,
                  isSelected: selectedBranchId == branch.id,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onBranchChanged(branch.id);
                  },
                ),
            ],
          ),

        const SizedBox(height: AppSpacing.xl),

        // 2. Pickup (1 of 2)
        Text(
          l10n.text('fulfillment.pickupSectionTitle'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _FulfillmentTile(
                icon: Icons.local_shipping_outlined,
                title: l10n.text('fulfillment.pickupCollectTitle'),
                subtitle: l10n.text('fulfillment.pickupCollectSubtitle'),
                isSelected: pickupMode == CustomerPickupMode.collectAddress,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onPickupModeChanged(CustomerPickupMode.collectAddress);
                },
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _FulfillmentTile(
                icon: Icons.store_outlined,
                title: l10n.text('fulfillment.pickupDropoffTitle'),
                subtitle: l10n.text('fulfillment.pickupDropoffSubtitle'),
                isSelected: pickupMode == CustomerPickupMode.storeDropoff,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onPickupModeChanged(CustomerPickupMode.storeDropoff);
                },
              ),
            ),
          ],
        ),

        if (pickupMode == CustomerPickupMode.collectAddress &&
            onPickupAddressChanged != null) ...[
          const SizedBox(height: AppSpacing.md),
          _AddressSelectorBlock(
            title: l10n.text('fulfillment.pickupAddressLabel'),
            addresses: addresses,
            selectedAddressId: selectedPickupAddressId,
            onSelected: onPickupAddressChanged!,
            onAddAddressTapped: onAddAddressTapped,
          ),
        ],

        const SizedBox(height: AppSpacing.xl),

        // 3. Delivery (2 of 2)
        Text(
          l10n.text('fulfillment.deliverySectionTitle'),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _FulfillmentTile(
                icon: Icons.delivery_dining_outlined,
                title: l10n.text('fulfillment.deliveryAddressTitle'),
                subtitle: l10n.text('fulfillment.deliveryAddressSubtitle'),
                isSelected: deliveryMode == CustomerDeliveryMode.deliverAddress,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onDeliveryModeChanged(CustomerDeliveryMode.deliverAddress);
                },
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _FulfillmentTile(
                icon: Icons.shopping_bag_outlined,
                title: l10n.text('fulfillment.deliveryStorePickupTitle'),
                subtitle: l10n.text('fulfillment.deliveryStorePickupSubtitle'),
                isSelected: deliveryMode == CustomerDeliveryMode.storePickup,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onDeliveryModeChanged(CustomerDeliveryMode.storePickup);
                },
              ),
            ),
          ],
        ),

        if (deliveryMode == CustomerDeliveryMode.deliverAddress &&
            onDeliveryAddressChanged != null) ...[
          const SizedBox(height: AppSpacing.md),
          _AddressSelectorBlock(
            title: l10n.text('fulfillment.deliveryAddressLabel'),
            addresses: addresses,
            selectedAddressId: selectedDeliveryAddressId,
            onSelected: onDeliveryAddressChanged!,
            onAddAddressTapped: onAddAddressTapped,
          ),
        ],
      ],
    );
  }
}

class _FulfillmentTile extends StatelessWidget {
  const _FulfillmentTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Semantics(
      button: true,
      selected: isSelected,
      label: '$title. $subtitle',
      child: Material(
        color: isSelected ? ext.brand.background : theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 112),
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(
                color: isSelected ? theme.colorScheme.primary : ext.border,
                width: isSelected ? 1.8 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      icon,
                      size: 22,
                      color: isSelected
                          ? theme.colorScheme.primary
                          : ext.textMuted,
                    ),
                    const Spacer(),
                    Icon(
                      isSelected
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      size: 20,
                      color: isSelected
                          ? theme.colorScheme.primary
                          : ext.textMuted,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: isSelected ? ext.brandText : null,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: ext.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SelectablePill extends StatelessWidget {
  const _SelectablePill({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: isSelected ? ext.brand.background : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(AppRadii.md),
            border: Border.all(
              color: isSelected ? theme.colorScheme.primary : ext.border,
              width: isSelected ? 1.6 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color:
                    isSelected ? theme.colorScheme.primary : ext.textMuted,
              ),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: isSelected ? ext.brandText : null,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: ext.textMuted,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddressSelectorBlock extends StatelessWidget {
  const _AddressSelectorBlock({
    required this.title,
    required this.addresses,
    required this.selectedAddressId,
    required this.onSelected,
    this.onAddAddressTapped,
  });

  final String title;
  final List<AddressOptionModel> addresses;
  final String? selectedAddressId;
  final ValueChanged<AddressOptionModel> onSelected;
  final VoidCallback? onAddAddressTapped;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.location_on_outlined,
                  size: 18, color: theme.colorScheme.primary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(title, style: theme.textTheme.titleSmall),
              ),
              if (onAddAddressTapped != null)
                TextButton.icon(
                  onPressed: onAddAddressTapped,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(l10n.text('profile.addAddressAction')),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (addresses.isEmpty)
            Text(
              l10n.text('booking.addressesEmptyBody'),
              style: theme.textTheme.bodySmall?.copyWith(color: ext.textMuted),
            )
          else
            Column(
              children: [
                for (final addr in addresses) ...[
                  InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onSelected(addr);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: addr.id == selectedAddressId
                            ? ext.brand.background
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                        border: Border.all(
                          color: addr.id == selectedAddressId
                              ? theme.colorScheme.primary
                              : ext.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            addr.id == selectedAddressId
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            size: 18,
                            color: addr.id == selectedAddressId
                                ? theme.colorScheme.primary
                                : ext.textMuted,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(addr.label,
                                    style: theme.textTheme.labelLarge),
                                if (addr.description.isNotEmpty)
                                  Text(
                                    addr.description,
                                    style: theme.textTheme.bodySmall
                                        ?.copyWith(color: ext.textMuted),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                ],
              ],
            ),
        ],
      ),
    );
  }
}
