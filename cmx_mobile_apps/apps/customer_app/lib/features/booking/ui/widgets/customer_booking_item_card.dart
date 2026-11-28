import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

class CustomerBookingItemCard extends StatefulWidget {
  const CustomerBookingItemCard({
    super.key,
    required this.item,
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
    required this.unitLabel,
    required this.localizedName,
    required this.localizedDescription,
    required this.currencyCode,
    this.itemNote = '',
    this.onItemNoteChanged,
    this.servicePreferenceOptions = const [],
    this.selectedPiecePrefIds = const [],
    this.onToggleQuickPiecePref,
  });

  final BookingCatalogItemModel item;
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final String unitLabel;
  final String localizedName;
  final String? localizedDescription;
  final String currencyCode;
  final String itemNote;
  final ValueChanged<String>? onItemNoteChanged;
  final List<BookingPreferenceOptionModel> servicePreferenceOptions;
  final List<String> selectedPiecePrefIds;
  final ValueChanged<String>? onToggleQuickPiecePref;

  @override
  State<CustomerBookingItemCard> createState() =>
      _CustomerBookingItemCardState();
}

class _CustomerBookingItemCardState extends State<CustomerBookingItemCard> {
  bool _expanded = false;
  late final TextEditingController _noteController;

  @override
  void initState() {
    super.initState();
    _noteController = TextEditingController(text: widget.itemNote);
  }

  @override
  void didUpdateWidget(covariant CustomerBookingItemCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.itemNote != _noteController.text) {
      _noteController.text = widget.itemNote;
    }
    if (widget.quantity == 0 && _expanded) {
      _expanded = false;
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  String _formatPrice(double price) {
    return '${price.toStringAsFixed(3)} ${widget.currencyCode}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final l10n = AppLocalizations.of(context);
    final isAr = l10n.locale.languageCode == 'ar';
    final hasQty = widget.quantity > 0;
    final hasExtras = widget.onItemNoteChanged != null ||
        widget.servicePreferenceOptions.isNotEmpty;

    return Semantics(
      label:
          '${widget.localizedName}, ${_formatPrice(widget.item.unitPrice)} ${widget.unitLabel}',
      child: AppCardWidget(
        accentColor: hasQty ? theme.colorScheme.primary : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.localizedName,
                          style: theme.textTheme.titleMedium),
                      if (widget.localizedDescription != null &&
                          widget.localizedDescription!.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          widget.localizedDescription!,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: ext.textMuted),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '${_formatPrice(widget.item.unitPrice)} · ${widget.unitLabel}',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: ext.brandText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 40,
                      height: 40,
                      child: Semantics(
                        label: 'Remove ${widget.item.name}',
                        button: true,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          iconSize: 22,
                          icon: const Icon(Icons.remove_circle_outline),
                          color: hasQty
                              ? theme.colorScheme.primary
                              : ext.border,
                          onPressed: hasQty ? widget.onRemove : null,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 28,
                      child: Text(
                        '${widget.quantity}',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    SizedBox(
                      width: 40,
                      height: 40,
                      child: Semantics(
                        label: 'Add ${widget.item.name}',
                        button: true,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          iconSize: 22,
                          icon: const Icon(Icons.add_circle_outline),
                          color: theme.colorScheme.primary,
                          onPressed: widget.onAdd,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            if (hasQty && hasExtras) ...[
              const SizedBox(height: AppSpacing.xs),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.xs,
                    ),
                  ),
                  onPressed: () => setState(() => _expanded = !_expanded),
                  icon: Icon(
                    _expanded ? Icons.expand_less : Icons.tune_rounded,
                    size: 16,
                  ),
                  label: Text(
                    _expanded
                        ? l10n.text('booking.itemHideOptionsAction')
                        : l10n.text('booking.itemAddPrefsNoteAction'),
                  ),
                ),
              ),
              if (_expanded) ...[
                const Divider(height: AppSpacing.sm),
                if (widget.servicePreferenceOptions.isNotEmpty &&
                    widget.onToggleQuickPiecePref != null) ...[
                  Text(
                    l10n.text('booking.itemPiecePrefsLabel'),
                    style: theme.textTheme.labelMedium
                        ?.copyWith(color: ext.textMuted),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      for (final opt in widget.servicePreferenceOptions)
                        FilterChip(
                          label: Text(
                            _optionLabelWithExtraPrice(opt, isAr),
                          ),
                          selected:
                              widget.selectedPiecePrefIds.contains(opt.id),
                          onSelected: (_) =>
                              widget.onToggleQuickPiecePref!(opt.id),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                if (widget.onItemNoteChanged != null)
                  TextField(
                    controller: _noteController,
                    onChanged: widget.onItemNoteChanged,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: l10n.text('booking.itemNoteLabel'),
                      hintText: l10n.text('booking.itemNoteHint'),
                      isDense: true,
                    ),
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  String _optionLabelWithExtraPrice(
    BookingPreferenceOptionModel opt,
    bool isAr,
  ) {
    final name =
        isAr && (opt.label2?.trim().isNotEmpty ?? false) ? opt.label2! : opt.label;
    if (opt.extraPrice > 0) {
      return '$name (+${opt.extraPrice.toStringAsFixed(3)} ${widget.currencyCode})';
    }
    return name;
  }
}
