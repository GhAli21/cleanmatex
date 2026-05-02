import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/customer_order_booking_provider.dart';
import '../widgets/customer_booking_step_header_widget.dart';

const _kPackingKindCode = 'packing_prefs';
const _kColorKindCode = 'color';
const _kNotesMaxLength = 200;

class CustomerBookingStep2PreferencesVw extends ConsumerStatefulWidget {
  const CustomerBookingStep2PreferencesVw({super.key});

  @override
  ConsumerState<CustomerBookingStep2PreferencesVw> createState() =>
      _CustomerBookingStep2PreferencesVwState();
}

class _CustomerBookingStep2PreferencesVwState
    extends ConsumerState<CustomerBookingStep2PreferencesVw> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final booking = ref.watch(customerOrderBookingProvider);
    final notifier = ref.read(customerOrderBookingProvider.notifier);

    AppLogger.info(
      'booking_step2.render cartItems=${booking.draft.cartItems.length} '
      'kinds=${booking.visiblePreferenceKinds.length}',
    );

    // Lazily init per-piece state for any cart item not yet tracked.
    for (final entry in booking.draft.cartItems.entries) {
      if (!booking.piecePreferences.containsKey(entry.key)) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) notifier.initPiecePreferences(entry.key, entry.value);
        });
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomerBookingStepHeaderWidget(
          title: l10n.text('booking.step2Title'),
          description: l10n.text('booking.step2.perPieceTitle'),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (booking.isLoading)
          const AppLoadingIndicator()
        else if (!booking.hasCartItems)
          AppCardWidget(
            child: Text(
              l10n.text('booking.step2.emptyCart'),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: booking.draft.cartItems.length,
            separatorBuilder: (_, __) =>
                const SizedBox(height: AppSpacing.md),
            itemBuilder: (context, index) {
              final entry =
                  booking.draft.cartItems.entries.elementAt(index);
              final item = _findItem(booking.categories, entry.key);
              final itemName = item != null
                  ? _localizedLabel(l10n, item.name, item.name2)
                  : entry.key;
              final pieces =
                  booking.piecePreferences[entry.key] ?? const [];

              return _ItemPiecesSection(
                itemId: entry.key,
                itemName: itemName,
                qty: entry.value,
                pieces: pieces,
                visibleKinds: booking.visiblePreferenceKinds,
                optionsForKind: booking.preferenceOptionsForKind,
                l10n: l10n,
                localizeLabel: (opt) =>
                    _localizedLabel(l10n, opt.label, opt.label2),
                onToggleServicePref: notifier.togglePieceServicePref,
                onSetPacking: notifier.setPiecePacking,
                onSetColor: notifier.setPieceColor,
                onSetNotes: notifier.setPieceNotes,
              );
            },
          ),
      ],
    );
  }

  String _localizedLabel(
    AppLocalizations l10n,
    String label,
    String? label2,
  ) {
    if (l10n.locale.languageCode == 'ar' &&
        label2 != null &&
        label2.trim().isNotEmpty) {
      return label2;
    }
    return label;
  }

  BookingCatalogItemModel? _findItem(
    List<BookingCatalogCategoryModel> categories,
    String itemId,
  ) {
    for (final cat in categories) {
      for (final item in cat.items) {
        if (item.id == itemId) return item;
      }
    }
    return null;
  }
}

// ── Item section ───────────────────────────────────────────────────────────

class _ItemPiecesSection extends StatelessWidget {
  const _ItemPiecesSection({
    required this.itemId,
    required this.itemName,
    required this.qty,
    required this.pieces,
    required this.visibleKinds,
    required this.optionsForKind,
    required this.l10n,
    required this.localizeLabel,
    required this.onToggleServicePref,
    required this.onSetPacking,
    required this.onSetColor,
    required this.onSetNotes,
  });

  final String itemId;
  final String itemName;
  final int qty;
  final List<BookingPiecePreferenceModel> pieces;
  final List<BookingPreferenceKindModel> visibleKinds;
  final List<BookingPreferenceOptionModel> Function(String kindCode)
      optionsForKind;
  final AppLocalizations l10n;
  final String Function(BookingPreferenceOptionModel) localizeLabel;
  final void Function(String itemId, int pieceSeq, String prefId)
      onToggleServicePref;
  final void Function(String itemId, int pieceSeq, String? code) onSetPacking;
  final void Function(String itemId, int pieceSeq, String? colorCode)
      onSetColor;
  final void Function(String itemId, int pieceSeq, String notes) onSetNotes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Theme(
      // Remove the divider that ExpansionTile draws between header and children.
      data: theme.copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        initiallyExpanded: true,
        tilePadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                itemName,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '×$qty',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        children: [
          if (pieces.isEmpty)
            const Padding(
              padding: EdgeInsetsDirectional.all(AppSpacing.md),
              child: AppLoadingIndicator(),
            )
          else
            Padding(
              padding: const EdgeInsetsDirectional.only(
                start: AppSpacing.md,
                end: AppSpacing.md,
                bottom: AppSpacing.md,
              ),
              child: Column(
                children: [
                  for (final piece in pieces) ...[
                    if (piece.pieceSeq > 1)
                      const SizedBox(height: AppSpacing.sm),
                    _PiecePreferenceCard(
                      itemId: itemId,
                      piece: piece,
                      visibleKinds: visibleKinds,
                      optionsForKind: optionsForKind,
                      l10n: l10n,
                      localizeLabel: localizeLabel,
                      onToggleServicePref: onToggleServicePref,
                      onSetPacking: onSetPacking,
                      onSetColor: onSetColor,
                      onSetNotes: onSetNotes,
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Piece card ─────────────────────────────────────────────────────────────

class _PiecePreferenceCard extends StatelessWidget {
  const _PiecePreferenceCard({
    required this.itemId,
    required this.piece,
    required this.visibleKinds,
    required this.optionsForKind,
    required this.l10n,
    required this.localizeLabel,
    required this.onToggleServicePref,
    required this.onSetPacking,
    required this.onSetColor,
    required this.onSetNotes,
  });

  final String itemId;
  final BookingPiecePreferenceModel piece;
  final List<BookingPreferenceKindModel> visibleKinds;
  final List<BookingPreferenceOptionModel> Function(String kindCode)
      optionsForKind;
  final AppLocalizations l10n;
  final String Function(BookingPreferenceOptionModel) localizeLabel;
  final void Function(String itemId, int pieceSeq, String prefId)
      onToggleServicePref;
  final void Function(String itemId, int pieceSeq, String? code) onSetPacking;
  final void Function(String itemId, int pieceSeq, String? colorCode)
      onSetColor;
  final void Function(String itemId, int pieceSeq, String notes) onSetNotes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.textWithArg(
              'booking.step2.pieceLabel',
              piece.pieceSeq.toString(),
            ),
            style: theme.textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: theme.colorScheme.primary,
            ),
          ),
          for (final kind in visibleKinds) ...[
            const SizedBox(height: AppSpacing.md),
            if (kind.kindCode == _kPackingKindCode)
              _PackingSection(
                itemId: itemId,
                piece: piece,
                options: optionsForKind(kind.kindCode),
                l10n: l10n,
                localizeLabel: localizeLabel,
                onSetPacking: onSetPacking,
              )
            else if (kind.kindCode == _kColorKindCode)
              _ColorSection(
                itemId: itemId,
                piece: piece,
                options: optionsForKind(kind.kindCode),
                l10n: l10n,
                localizeLabel: localizeLabel,
                onSetColor: onSetColor,
              )
            else
              _ServicePrefsSection(
                itemId: itemId,
                piece: piece,
                kind: kind,
                options: optionsForKind(kind.kindCode),
                l10n: l10n,
                localizeLabel: localizeLabel,
                onToggle: onToggleServicePref,
              ),
          ],
          const SizedBox(height: AppSpacing.md),
          _PieceNotesField(
            itemId: itemId,
            pieceSeq: piece.pieceSeq,
            initialNotes: piece.notes,
            l10n: l10n,
            onChanged: onSetNotes,
          ),
        ],
      ),
    );
  }
}

// ── Service prefs section (multi-select chips) ─────────────────────────────

class _ServicePrefsSection extends StatelessWidget {
  const _ServicePrefsSection({
    required this.itemId,
    required this.piece,
    required this.kind,
    required this.options,
    required this.l10n,
    required this.localizeLabel,
    required this.onToggle,
  });

  final String itemId;
  final BookingPiecePreferenceModel piece;
  final BookingPreferenceKindModel kind;
  final List<BookingPreferenceOptionModel> options;
  final AppLocalizations l10n;
  final String Function(BookingPreferenceOptionModel) localizeLabel;
  final void Function(String itemId, int pieceSeq, String prefId) onToggle;

  String _kindLabel() {
    final ar = l10n.locale.languageCode == 'ar';
    final configured =
        ar && (kind.name2?.trim().isNotEmpty ?? false) ? kind.name2! : kind.name;
    if (configured.trim().isNotEmpty) return configured;
    return l10n.text('booking.step2.servicePrefsSection');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _kindLabel(),
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: options.map((opt) {
            final isSelected =
                piece.servicePreferenceIds.contains(opt.id);
            return FilterChip(
              label: Text(localizeLabel(opt)),
              selected: isSelected,
              showCheckmark: false,
              onSelected: (_) => onToggle(itemId, piece.pieceSeq, opt.id),
            );
          }).toList(growable: false),
        ),
      ],
    );
  }
}

// ── Packing section (single-select chips) ─────────────────────────────────

class _PackingSection extends StatelessWidget {
  const _PackingSection({
    required this.itemId,
    required this.piece,
    required this.options,
    required this.l10n,
    required this.localizeLabel,
    required this.onSetPacking,
  });

  final String itemId;
  final BookingPiecePreferenceModel piece;
  final List<BookingPreferenceOptionModel> options;
  final AppLocalizations l10n;
  final String Function(BookingPreferenceOptionModel) localizeLabel;
  final void Function(String itemId, int pieceSeq, String? code) onSetPacking;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.text('booking.step2.packingSection'),
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: options.map((opt) {
            final isSelected = piece.packingPrefCode == opt.id;
            return ChoiceChip(
              label: Text(localizeLabel(opt)),
              selected: isSelected,
              showCheckmark: false,
              // Tapping the active chip deselects it.
              onSelected: (_) => onSetPacking(
                itemId,
                piece.pieceSeq,
                isSelected ? null : opt.id,
              ),
            );
          }).toList(growable: false),
        ),
      ],
    );
  }
}

// ── Color section (horizontal dot row) ────────────────────────────────────

class _ColorSection extends StatelessWidget {
  const _ColorSection({
    required this.itemId,
    required this.piece,
    required this.options,
    required this.l10n,
    required this.localizeLabel,
    required this.onSetColor,
  });

  final String itemId;
  final BookingPiecePreferenceModel piece;
  final List<BookingPreferenceOptionModel> options;
  final AppLocalizations l10n;
  final String Function(BookingPreferenceOptionModel) localizeLabel;
  final void Function(String itemId, int pieceSeq, String? colorCode)
      onSetColor;

  Color _resolveColor(String? hex) {
    if (hex == null || hex.trim().isEmpty) return Colors.grey.shade400;
    final normalized = hex.replaceFirst('#', '');
    if (normalized.length != 6) return Colors.grey.shade400;
    final parsed = int.tryParse('FF$normalized', radix: 16);
    return parsed != null ? Color(parsed) : Colors.grey.shade400;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.text('booking.step2.colorSection'),
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: options.map((opt) {
              final isSelected = piece.colorCode == opt.id;
              final dotColor = _resolveColor(opt.colorHex);
              return Padding(
                padding:
                    const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                child: Semantics(
                  label: localizeLabel(opt),
                  selected: isSelected,
                  button: true,
                  child: GestureDetector(
                    onTap: () => onSetColor(
                      itemId,
                      piece.pieceSeq,
                      isSelected ? null : opt.id,
                    ),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: dotColor,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? theme.colorScheme.primary
                              : Colors.transparent,
                          width: 3,
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: theme.colorScheme.primary
                                      // ignore: deprecated_member_use
                                      .withOpacity(0.35),
                                  blurRadius: 6,
                                  spreadRadius: 1,
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(growable: false),
          ),
        ),
      ],
    );
  }
}

// ── Notes field with 300ms debounce ───────────────────────────────────────

class _PieceNotesField extends StatefulWidget {
  const _PieceNotesField({
    required this.itemId,
    required this.pieceSeq,
    required this.initialNotes,
    required this.l10n,
    required this.onChanged,
  });

  final String itemId;
  final int pieceSeq;
  final String initialNotes;
  final AppLocalizations l10n;
  final void Function(String itemId, int pieceSeq, String notes) onChanged;

  @override
  State<_PieceNotesField> createState() => _PieceNotesFieldState();
}

class _PieceNotesFieldState extends State<_PieceNotesField> {
  late final TextEditingController _controller;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialNotes);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      widget.onChanged(widget.itemId, widget.pieceSeq, value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAr = widget.l10n.locale.languageCode == 'ar';

    return TextField(
      controller: _controller,
      onChanged: _onTextChanged,
      maxLength: _kNotesMaxLength,
      maxLines: 2,
      // Explicitly set text direction to match active locale.
      textDirection: isAr ? TextDirection.rtl : TextDirection.ltr,
      style: theme.textTheme.bodyMedium,
      decoration: InputDecoration(
        hintText: widget.l10n.text('booking.step2.notesHint'),
        hintStyle: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
        counterText: '',
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.sm.toDouble()),
          borderSide: BorderSide(color: theme.colorScheme.outline),
        ),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }
}
