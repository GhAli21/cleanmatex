import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';

class CustomerBookingAddressFormWidget extends ConsumerStatefulWidget {
  const CustomerBookingAddressFormWidget({super.key});

  @override
  ConsumerState<CustomerBookingAddressFormWidget> createState() =>
      _CustomerBookingAddressFormWidgetState();
}

class _CustomerBookingAddressFormWidgetState
    extends ConsumerState<CustomerBookingAddressFormWidget> {
  final _labelController = TextEditingController();
  final _streetController = TextEditingController();
  final _areaController = TextEditingController();
  final _cityController = TextEditingController();

  bool _isValid() {
    return _labelController.text.trim().isNotEmpty &&
        _streetController.text.trim().isNotEmpty &&
        _areaController.text.trim().isNotEmpty &&
        _cityController.text.trim().isNotEmpty;
  }

  @override
  void dispose() {
    _labelController.dispose();
    _streetController.dispose();
    _areaController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _save(AppLocalizations l10n) async {
    if (!_isValid()) return;
    final input = NewAddressInputModel(
      label: _labelController.text.trim(),
      street: _streetController.text.trim(),
      area: _areaController.text.trim(),
      city: _cityController.text.trim(),
    );
    await ref
        .read(customerOrderBookingProvider.notifier)
        .saveNewAddress(input);
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final isSaving = ref.watch(
      customerOrderBookingProvider.select((s) => s.isSavingAddress),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.sm),
        _buildField(
          controller: _labelController,
          label: localizations.text('booking.addressLabelField'),
          enabled: !isSaving,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildField(
          controller: _streetController,
          label: localizations.text('booking.addressStreetField'),
          enabled: !isSaving,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildField(
          controller: _areaController,
          label: localizations.text('booking.addressAreaField'),
          enabled: !isSaving,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildField(
          controller: _cityController,
          label: localizations.text('booking.addressCityField'),
          enabled: !isSaving,
        ),
        const SizedBox(height: AppSpacing.md),
        AppCustomButtonWidget(
          label: isSaving
              ? localizations.text('booking.savingAddressLabel')
              : localizations.text('booking.saveAddressAction'),
          isLoading: isSaving,
          onPressed: isSaving ? null : () => _save(localizations),
        ),
      ],
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required bool enabled,
  }) {
    return TextField(
      controller: controller,
      enabled: enabled,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }
}
