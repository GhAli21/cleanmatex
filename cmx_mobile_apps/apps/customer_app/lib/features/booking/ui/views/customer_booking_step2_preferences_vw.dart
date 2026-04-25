import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../cards/customer_booking_preference_chip_card.dart';
import '../widgets/customer_booking_step_header_widget.dart';

class CustomerBookingStep2PreferencesVw extends ConsumerStatefulWidget {
  const CustomerBookingStep2PreferencesVw({super.key});

  @override
  ConsumerState<CustomerBookingStep2PreferencesVw> createState() =>
      _CustomerBookingStep2PreferencesVwState();
}

class _CustomerBookingStep2PreferencesVwState
    extends ConsumerState<CustomerBookingStep2PreferencesVw> {
  String? _activeKindCode;

  String _localizedLabel(AppLocalizations l10n, String label, String? label2) {
    if (l10n.locale.languageCode == 'ar' &&
        label2 != null &&
        label2.trim().isNotEmpty) {
      return label2;
    }
    return label;
  }

  String _localizedKindLabel(
    AppLocalizations l10n,
    BookingPreferenceKindModel kind,
  ) {
    final configuredLabel = _localizedLabel(l10n, kind.name, kind.name2);
    if (configuredLabel.trim().isNotEmpty) return configuredLabel;

    return switch (kind.kindCode) {
      'packing_prefs' => l10n.text('booking.pickupPrefsTitle'),
      'service_prefs' => l10n.text('booking.servicePrefsTitle'),
      _ => kind.kindCode,
    };
  }

  String _formatPrice(
    BuildContext context,
    AppLocalizations l10n,
    double price,
    String currencyCode,
  ) {
    if (price <= 0) return l10n.text('booking.prefIncluded');

    final formatter = NumberFormat.currency(
      locale: Localizations.localeOf(context).toLanguageTag(),
      name: currencyCode,
      symbol: '',
      decimalDigits: 3,
    );
    return '+${formatter.format(price).trim()} $currencyCode';
  }

  List<String> _metadataLabels(
    AppLocalizations l10n,
    BookingPreferenceOptionModel preference,
  ) {
    return [
      if ((preference.extraTurnaroundMinutes ?? 0) > 0)
        l10n.textWithArg(
          'booking.prefExtraTime',
          preference.extraTurnaroundMinutes.toString(),
        ),
      if ((preference.sustainabilityScore ?? 0) > 0)
        l10n.textWithArg(
          'booking.prefSustainability',
          preference.sustainabilityScore.toString(),
        ),
    ];
  }

  Color? _parseHexColor(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final normalized = value.replaceFirst('#', '');
    if (normalized.length != 6) return null;
    final parsed = int.tryParse('FF$normalized', radix: 16);
    if (parsed == null) return null;
    return Color(parsed);
  }

  IconData _iconForKind(String kindCode) {
    return switch (kindCode) {
      'packing_prefs' => Icons.inventory_2_outlined,
      'condition_stain' => Icons.water_drop_outlined,
      'condition_damag' => Icons.report_problem_outlined,
      'condition_special' => Icons.favorite_border,
      'color' => Icons.palette_outlined,
      _ => Icons.tune_outlined,
    };
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);
    final visibleKinds = booking.visiblePreferenceKinds;
    final activeKind = visibleKinds.where((kind) {
          return kind.kindCode == _activeKindCode;
        }).firstOrNull ??
        (visibleKinds.isNotEmpty ? visibleKinds.first : null);
    final activeOptions = activeKind == null
        ? const <BookingPreferenceOptionModel>[]
        : booking.preferenceOptionsForKind(activeKind.kindCode);

    AppLogger.info(
      'booking_step2.render servicePrefs=${booking.servicePreferenceOptions.length} '
      'pickupPrefs=${booking.pickupPreferenceOptions.length} '
      'kinds=${visibleKinds.length} '
      'selectedService=${booking.draft.selectedServicePreferenceIds.length} '
      'selectedPickup=${booking.draft.selectedPickupPreferenceIds.length}',
    );
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: localizations.text('booking.step2Title'),
          description: localizations.text('booking.step2Description'),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (visibleKinds.isEmpty)
          AppCardWidget(
            child: Text(
              localizations.text('booking.noPrefsForKind'),
              style: theme.textTheme.bodyLarge,
            ),
          )
        else ...[
          _PreferenceKindTabs(
            kinds: visibleKinds,
            activeKindCode: activeKind!.kindCode,
            localizeKind: (kind) => _localizedKindLabel(localizations, kind),
            parseColor: _parseHexColor,
            iconForKind: _iconForKind,
            onSelect: (kindCode) {
              setState(() => _activeKindCode = kindCode);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          _PreferenceOptionsGrid(
            options: activeOptions,
            kindCode: activeKind.kindCode,
            booking: booking,
            localizations: localizations,
            formatPrice: (preference) => _formatPrice(
              context,
              localizations,
              preference.extraPrice,
              booking.currencyCode,
            ),
            metadataLabels: (preference) =>
                _metadataLabels(localizations, preference),
            localizedLabel: (preference) => _localizedLabel(
              localizations,
              preference.label,
              preference.label2,
            ),
            localizedDescription: (preference) => _localizedLabel(
              localizations,
              preference.description ?? '',
              preference.description2,
            ),
            onToggle: notifier.togglePreferenceForKind,
          ),
          const SizedBox(height: AppSpacing.lg),
          _SelectedPreferenceSummary(
            booking: booking,
            localizations: localizations,
            localizedLabel: (preference) => _localizedLabel(
              localizations,
              preference.label,
              preference.label2,
            ),
            onRemove: (preference) {
              final kindCode = booking.draft.selectedPickupPreferenceIds
                      .contains(preference.id)
                  ? 'packing_prefs'
                  : preference.preferenceSysKind;
              notifier.togglePreferenceForKind(kindCode, preference.id);
            },
          ),
        ],
      ],
    );
  }
}

class _PreferenceKindTabs extends StatelessWidget {
  const _PreferenceKindTabs({
    required this.kinds,
    required this.activeKindCode,
    required this.localizeKind,
    required this.parseColor,
    required this.iconForKind,
    required this.onSelect,
  });

  final List<BookingPreferenceKindModel> kinds;
  final String activeKindCode;
  final String Function(BookingPreferenceKindModel kind) localizeKind;
  final Color? Function(String? value) parseColor;
  final IconData Function(String kindCode) iconForKind;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: kinds.map((kind) {
          final isActive = kind.kindCode == activeKindCode;
          final kindColor = parseColor(kind.kindBgColor);
          final activeColor = kindColor ?? colorScheme.primary;
          final foregroundColor = isActive ? Colors.white : AppColors.textMuted;

          return Padding(
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
            child: ChoiceChip(
              selected: isActive,
              showCheckmark: false,
              avatar: Icon(
                iconForKind(kind.kindCode),
                size: 18,
                color: foregroundColor,
              ),
              label: Text(localizeKind(kind)),
              labelStyle: theme.textTheme.bodyMedium?.copyWith(
                color: isActive ? Colors.white : AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              selectedColor: activeColor,
              backgroundColor: colorScheme.surface,
              side: BorderSide(
                color: isActive ? activeColor : AppColors.border,
              ),
              onSelected: (_) => onSelect(kind.kindCode),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

class _PreferenceOptionsGrid extends StatelessWidget {
  const _PreferenceOptionsGrid({
    required this.options,
    required this.kindCode,
    required this.booking,
    required this.localizations,
    required this.formatPrice,
    required this.metadataLabels,
    required this.localizedLabel,
    required this.localizedDescription,
    required this.onToggle,
  });

  final List<BookingPreferenceOptionModel> options;
  final String kindCode;
  final BookingState booking;
  final AppLocalizations localizations;
  final String Function(BookingPreferenceOptionModel preference) formatPrice;
  final List<String> Function(BookingPreferenceOptionModel preference)
      metadataLabels;
  final String Function(BookingPreferenceOptionModel preference) localizedLabel;
  final String Function(BookingPreferenceOptionModel preference)
      localizedDescription;
  final void Function(String kindCode, String id) onToggle;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) {
      return AppCardWidget(
        child: Text(
          localizations.text('booking.noPrefsForKind'),
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columnCount = constraints.maxWidth >= 360 ? 2 : 1;

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: options.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columnCount,
            crossAxisSpacing: AppSpacing.sm,
            mainAxisSpacing: AppSpacing.sm,
            mainAxisExtent: columnCount == 1 ? 150 : 184,
          ),
          itemBuilder: (context, index) {
            final preference = options[index];
            final label = localizedLabel(preference);
            final description = localizedDescription(preference);
            final priceLabel = formatPrice(preference);
            final metadata = metadataLabels(preference);
            final semanticParts = [
              label,
              priceLabel,
              ...metadata,
            ].where((part) => part.trim().isNotEmpty).join(', ');

            return CustomerBookingPreferenceChipCard(
              label: label,
              description: description,
              priceLabel: priceLabel,
              metadataLabels: metadata,
              isSelected: booking.isPreferenceSelected(kindCode, preference.id),
              semanticLabel: semanticParts,
              onTap: () => onToggle(kindCode, preference.id),
            );
          },
        );
      },
    );
  }
}

class _SelectedPreferenceSummary extends StatelessWidget {
  const _SelectedPreferenceSummary({
    required this.booking,
    required this.localizations,
    required this.localizedLabel,
    required this.onRemove,
  });

  final BookingState booking;
  final AppLocalizations localizations;
  final String Function(BookingPreferenceOptionModel preference) localizedLabel;
  final ValueChanged<BookingPreferenceOptionModel> onRemove;

  @override
  Widget build(BuildContext context) {
    final selectedOptions = booking.selectedPreferenceOptions;
    if (selectedOptions.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                localizations.text('booking.selectedPrefsTitle'),
                style: theme.textTheme.titleMedium,
              ),
            ),
            Text(
              localizations.textWithArg(
                'booking.selectedPrefsCount',
                booking.selectedPreferenceCount.toString(),
              ),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: selectedOptions.map((preference) {
            final label = localizedLabel(preference);
            return InputChip(
              label: Text(label),
              onDeleted: () => onRemove(preference),
              deleteIcon: const Icon(Icons.close, size: 18),
              deleteButtonTooltipMessage: localizations.textWithArg(
                'booking.removePreferenceLabel',
                label,
              ),
            );
          }).toList(growable: false),
        ),
      ],
    );
  }
}
