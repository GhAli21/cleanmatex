import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_breakpoints.dart';
import 'app_radii.dart';
import 'app_spacing.dart';
import 'cmx_theme_extension.dart';

/// Orientation mode for [AppProgressStepperWidget].
enum AppStepperOrientation { horizontal, vertical }

/// Immutable data model for one stage in [AppProgressStepperWidget].
/// Supports any number of stages (3, 4, 5, 7, 10+ — live tracking or full history).
class AppProgressStepItem {
  const AppProgressStepItem({
    required this.title,
    this.shortLabel,
    this.subtitle,
    this.timestampLabel,
    this.isCompleted = false,
    this.isActive = false,
    this.icon,
  });

  final String title;
  final String? shortLabel;
  final String? subtitle;
  final String? timestampLabel;
  final bool isCompleted;
  final bool isActive;
  final IconData? icon;
}

/// Domain-agnostic, flexible N-stage progress stepper supporting both
/// Horizontal (evenly spaced for <=5 steps, smoothly scrollable for >5) and
/// Vertical timeline layouts, with optional user layout toggle and responsive
/// default (Horizontal on wide, Vertical on compact/high text scale).
class AppProgressStepperWidget extends StatefulWidget {
  const AppProgressStepperWidget({
    super.key,
    required this.steps,
    this.title,
    this.trailingMeta,
    this.initialOrientation,
    this.showOrientationToggle = true,
    this.horizontalLabel = 'Horizontal',
    this.verticalLabel = 'Vertical',
    this.onStepTapped,
  });

  final List<AppProgressStepItem> steps;
  final String? title;
  final String? trailingMeta;
  final AppStepperOrientation? initialOrientation;
  final bool showOrientationToggle;
  final String horizontalLabel;
  final String verticalLabel;
  final ValueChanged<int>? onStepTapped;

  @override
  State<AppProgressStepperWidget> createState() =>
      _AppProgressStepperWidgetState();
}

class _AppProgressStepperWidgetState extends State<AppProgressStepperWidget> {
  AppStepperOrientation? _userOverride;

  AppStepperOrientation _resolveOrientation(
    BuildContext context,
    double maxWidth,
  ) {
    if (_userOverride != null) return _userOverride!;
    if (widget.initialOrientation != null) return widget.initialOrientation!;
    final textScale = MediaQuery.textScalerOf(context).scale(1.0);
    if (AppBreakpoints.isCompact(maxWidth) || textScale >= 1.35) {
      return AppStepperOrientation.vertical;
    }
    return AppStepperOrientation.horizontal;
  }

  void _setOrientation(AppStepperOrientation next) {
    HapticFeedback.selectionClick();
    setState(() => _userOverride = next);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.steps.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final orientation = _resolveOrientation(context, constraints.maxWidth);
        final activeIndex = widget.steps.indexWhere((s) => s.isActive);
        final activeStep =
            activeIndex >= 0 ? widget.steps[activeIndex] : widget.steps.last;

        return Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(color: ext.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.title != null || widget.showOrientationToggle) ...[
                Row(
                  children: [
                    if (widget.title != null)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.title!,
                              style: theme.textTheme.titleMedium,
                            ),
                            if (widget.trailingMeta != null)
                              Text(
                                widget.trailingMeta!,
                                style: theme.textTheme.bodySmall,
                              ),
                          ],
                        ),
                      ),
                    if (widget.showOrientationToggle)
                      _OrientationToggle(
                        current: orientation,
                        horizontalLabel: widget.horizontalLabel,
                        verticalLabel: widget.verticalLabel,
                        onChanged: _setOrientation,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: orientation == AppStepperOrientation.horizontal
                    ? _HorizontalStepper(
                        key: ValueKey('h_${widget.steps.length}'),
                        steps: widget.steps,
                        activeStep: activeStep,
                        onStepTapped: widget.onStepTapped,
                      )
                    : _VerticalStepper(
                        key: ValueKey('v_${widget.steps.length}'),
                        steps: widget.steps,
                        onStepTapped: widget.onStepTapped,
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _OrientationToggle extends StatelessWidget {
  const _OrientationToggle({
    required this.current,
    required this.horizontalLabel,
    required this.verticalLabel,
    required this.onChanged,
  });

  final AppStepperOrientation current;
  final String horizontalLabel;
  final String verticalLabel;
  final ValueChanged<AppStepperOrientation> onChanged;

  @override
  Widget build(BuildContext context) {
    final ext = CmxStatusThemeExtension.of(context);
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: ext.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ToggleChip(
            label: horizontalLabel,
            selected: current == AppStepperOrientation.horizontal,
            onTap: () => onChanged(AppStepperOrientation.horizontal),
          ),
          _ToggleChip(
            label: verticalLabel,
            selected: current == AppStepperOrientation.vertical,
            onTap: () => onChanged(AppStepperOrientation.vertical),
          ),
        ],
      ),
    );
  }
}

class _ToggleChip extends StatelessWidget {
  const _ToggleChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.sm - 2),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 32),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? theme.colorScheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.sm - 2),
          ),
          child: Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: selected
                  ? theme.colorScheme.onPrimary
                  : theme.textTheme.bodySmall?.color,
            ),
          ),
        ),
      ),
    );
  }
}

class _HorizontalStepper extends StatelessWidget {
  const _HorizontalStepper({
    super.key,
    required this.steps,
    required this.activeStep,
    this.onStepTapped,
  });

  final List<AppProgressStepItem> steps;
  final AppProgressStepItem activeStep;
  final ValueChanged<int>? onStepTapped;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final isScrollable = steps.length > 5;

    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          if (isScrollable)
            SizedBox(
              width: 78,
              child: _HorizontalNode(
                index: i,
                step: steps[i],
                isFirst: i == 0,
                isLast: i == steps.length - 1,
                previousCompleted: i > 0 && (steps[i - 1].isCompleted || steps[i].isActive),
                onTap: onStepTapped == null ? null : () => onStepTapped!(i),
              ),
            )
          else
            Expanded(
              child: _HorizontalNode(
                index: i,
                step: steps[i],
                isFirst: i == 0,
                isLast: i == steps.length - 1,
                previousCompleted: i > 0 && (steps[i - 1].isCompleted || steps[i].isActive),
                onTap: onStepTapped == null ? null : () => onStepTapped!(i),
              ),
            ),
        ],
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isScrollable)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: row,
          )
        else
          row,
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: ext.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      activeStep.title,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  if (activeStep.timestampLabel != null)
                    Text(
                      activeStep.timestampLabel!,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: ext.brandText,
                      ),
                    ),
                ],
              ),
              if (activeStep.subtitle != null &&
                  activeStep.subtitle!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  activeStep.subtitle!,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _HorizontalNode extends StatelessWidget {
  const _HorizontalNode({
    required this.index,
    required this.step,
    required this.isFirst,
    required this.isLast,
    required this.previousCompleted,
    this.onTap,
  });

  final int index;
  final AppProgressStepItem step;
  final bool isFirst;
  final bool isLast;
  final bool previousCompleted;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final primary = theme.colorScheme.primary;
    final filled = step.isCompleted || step.isActive;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.sm),
      child: Column(
        children: [
          SizedBox(
            height: 36,
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 2,
                    color: isFirst
                        ? Colors.transparent
                        : (previousCompleted ? primary : ext.border),
                  ),
                ),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? primary : theme.colorScheme.surface,
                    border: Border.all(
                      color: filled ? primary : ext.border,
                      width: 2,
                    ),
                    boxShadow: step.isActive
                        ? [
                            BoxShadow(
                              color: primary.withValues(alpha: 0.28),
                              blurRadius: 0,
                              spreadRadius: 4,
                            ),
                          ]
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: step.isCompleted
                      ? Icon(
                          Icons.check_rounded,
                          size: 16,
                          color: theme.colorScheme.onPrimary,
                        )
                      : Text(
                          '${index + 1}',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: filled
                                ? theme.colorScheme.onPrimary
                                : theme.textTheme.bodySmall?.color,
                          ),
                        ),
                ),
                Expanded(
                  child: Container(
                    height: 2,
                    color: isLast
                        ? Colors.transparent
                        : (step.isCompleted ? primary : ext.border),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Text(
              step.shortLabel ?? step.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall?.copyWith(
                color: step.isActive
                    ? ext.brandText
                    : (step.isCompleted
                        ? theme.colorScheme.onSurface
                        : theme.textTheme.bodySmall?.color),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerticalStepper extends StatelessWidget {
  const _VerticalStepper({
    super.key,
    required this.steps,
    this.onStepTapped,
  });

  final List<AppProgressStepItem> steps;
  final ValueChanged<int>? onStepTapped;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final primary = theme.colorScheme.primary;

    return Column(
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          InkWell(
            onTap: onStepTapped == null ? null : () => onStepTapped!(i),
            borderRadius: BorderRadius.circular(AppRadii.sm),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 32,
                    child: Column(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: (steps[i].isCompleted || steps[i].isActive)
                                ? primary
                                : theme.colorScheme.surface,
                            border: Border.all(
                              color: (steps[i].isCompleted || steps[i].isActive)
                                  ? primary
                                  : ext.border,
                              width: 2,
                            ),
                            boxShadow: steps[i].isActive
                                ? [
                                    BoxShadow(
                                      color: primary.withValues(alpha: 0.25),
                                      spreadRadius: 3,
                                    ),
                                  ]
                                : null,
                          ),
                          alignment: Alignment.center,
                          child: steps[i].isCompleted
                              ? Icon(
                                  Icons.check_rounded,
                                  size: 14,
                                  color: theme.colorScheme.onPrimary,
                                )
                              : Text(
                                  '${i + 1}',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: steps[i].isActive
                                        ? theme.colorScheme.onPrimary
                                        : theme.textTheme.bodySmall?.color,
                                  ),
                                ),
                        ),
                        if (i < steps.length - 1)
                          Expanded(
                            child: Container(
                              width: 2,
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              color:
                                  steps[i].isCompleted ? primary : ext.border,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        bottom: i < steps.length - 1 ? AppSpacing.md : 0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  steps[i].title,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                    color: steps[i].isActive
                                        ? ext.brandText
                                        : (steps[i].isCompleted
                                            ? theme.colorScheme.onSurface
                                            : theme.textTheme.bodySmall?.color),
                                  ),
                                ),
                              ),
                              if (steps[i].timestampLabel != null)
                                Text(
                                  steps[i].timestampLabel!,
                                  style: theme.textTheme.labelSmall,
                                ),
                            ],
                          ),
                          if (steps[i].subtitle != null &&
                              steps[i].subtitle!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              steps[i].subtitle!,
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
