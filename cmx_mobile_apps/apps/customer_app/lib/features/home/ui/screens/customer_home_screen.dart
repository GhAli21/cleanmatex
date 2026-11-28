import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../orders/providers/customer_orders_provider.dart';
import '../../../tenant/providers/tenant_provider.dart';
import '../../../tenant/ui/widgets/customer_tenant_switcher_sheet_widget.dart';

/// Track-First CleanMateX Go Home screen matching the approved v2 mockup:
/// Active Laundry + Last Branch pill, live active order hero card, dual
/// Quick Drop / Detailed Order launcher, and quick shortcuts.
class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({
    super.key,
    this.onNavigateTab,
  });

  final ValueChanged<int>? onNavigateTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isAr = l10n.locale.languageCode == 'ar';
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final session =
        ref.watch(customerSessionFlowProvider.select((f) => f.session));
    final tenant = ref.watch(tenantProvider).valueOrNull;
    final ordersAsync = ref.watch(customerOrdersProvider);

    final isGuest = session?.isGuest == true;
    final greeting = isGuest
        ? l10n.text('home.greetingGuest')
        : l10n.textWithArg(
            'home.greetingTitle',
            session?.displayName ?? session?.phoneNumber ?? '',
          );

    final orgName = tenant == null
        ? l10n.text('app.title')
        : (isAr && (tenant.name2?.isNotEmpty ?? false)
            ? tenant.name2!
            : tenant.name);
    final lastBranch = tenant?.resolvedLastBranch;
    final branchName = lastBranch == null
        ? null
        : (isAr && (lastBranch.name2?.isNotEmpty ?? false)
            ? lastBranch.name2!
            : lastBranch.name);

    final activeOrders = ordersAsync.valueOrNull
            ?.where((o) =>
                o.statusCode.toLowerCase() != 'completed' &&
                o.statusCode.toLowerCase() != 'delivered' &&
                o.statusCode.toLowerCase() != 'cancelled')
            .toList(growable: false) ??
        const [];

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        titleSpacing: AppSpacing.md,
        title: Semantics(
          button: true,
          label: l10n.text('laundries.title'),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            onTap: () => CustomerTenantSwitcherSheetWidget.show(context),
            child: Container(
              padding: const EdgeInsetsDirectional.fromSTEB(8, 6, 12, 6),
              decoration: BoxDecoration(
                color: ext.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadii.pill),
                border: Border.all(color: ext.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 13,
                    backgroundColor: theme.colorScheme.primary,
                    child: Text(
                      orgName.isNotEmpty ? orgName.substring(0, 1) : 'C',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          orgName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelLarge?.copyWith(
                            fontSize: 13,
                          ),
                        ),
                        if (branchName != null)
                          Text(
                            branchName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: ext.brandText,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
                ],
              ),
            ),
          ),
        ),
        actions: const [
          CustomerLocaleSwitchWidget(),
          SizedBox(width: AppSpacing.sm),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator.adaptive(
          onRefresh: () async {
            ref.invalidate(customerOrdersProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AppHeaderWidget(
                title: greeting,
                subtitle: l10n.text('home.subtitle'),
              ),
              const SizedBox(height: AppSpacing.md),
              if (isGuest) ...[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: ext.brand.background,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    border: Border.all(color: ext.brand.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.text('common.guestUnlockedHint'),
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      FilledButton(
                        onPressed: () {
                          Navigator.of(context).pushNamed(AppRoute.entry);
                        },
                        child: Text(l10n.text('common.signInAction')),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              // ─── Live Active Order Hero OR Skeleton OR Empty ─────────────
              ordersAsync.when(
                loading: () => const AppSkeletonCardWidget(lines: 3),
                error: (_, __) => AppErrorWidget(
                  title: l10n.text('orders.title'),
                  message: l10n.text('common.remoteRequestError'),
                  retryLabel: l10n.text('common.retry'),
                  onRetry: () => ref.invalidate(customerOrdersProvider),
                ),
                data: (_) {
                  if (activeOrders.isEmpty || isGuest) {
                    return AppEmptyStateWidget(
                      title: l10n.text('home.emptyTitle'),
                      description: l10n.text('home.emptyDescription'),
                      actionLabel: l10n.text('home.quickDropTitle'),
                      onAction: () {
                        HapticFeedback.lightImpact();
                        Navigator.of(context).pushNamed(AppRoute.quickDrop);
                      },
                    );
                  }
                  final hero = activeOrders.first;
                  return InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    onTap: () {
                      AppLogger.info(
                        'home_screen.open_hero_order id=${hero.id}',
                      );
                      Navigator.of(context).pushNamed(
                        AppRoute.orderDetail,
                        arguments: hero.id,
                      );
                    },
                    child: AppCardWidget(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              AppStatusBadgeWidget(
                                label: l10n.text(hero.statusLabelKey),
                                tone: CmxSemanticTone.brand,
                                icon: Icons.local_laundry_service_rounded,
                              ),
                              const Spacer(),
                              AppCodeChipWidget(
                                code: hero.orderNumber,
                                copiedFeedbackMessage: l10n.textWithArg(
                                  'common.copied',
                                  hero.orderNumber,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                            child: LinearProgressIndicator(
                              value: _progressForStatus(hero.statusCode),
                              minHeight: 6,
                              backgroundColor: ext.surfaceMuted,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  hero.promisedWindow.isNotEmpty
                                      ? hero.promisedWindow
                                      : l10n.text('home.subtitle'),
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Icon(
                                Icons.arrow_forward_rounded,
                                size: 18,
                                color: ext.brandText,
                              ),
                            ],
                          ),
                          if (activeOrders.length > 1) ...[
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              '+${activeOrders.length - 1} ${l10n.text('orders.tabActive')}',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: ext.brandText,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: AppSpacing.md),

              // ─── Dual Order Launcher (Primary Aqua vs Secondary Navy) ────
              Row(
                children: [
                  Expanded(
                    child: _LauncherCard(
                      title: l10n.text('home.quickDropTitle'),
                      subtitle: l10n.text('home.quickDropSubtitle'),
                      icon: Icons.bolt_rounded,
                      isPrimary: true,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.of(context).pushNamed(AppRoute.quickDrop);
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _LauncherCard(
                      title: l10n.text('home.detailedOrderTitle'),
                      subtitle: l10n.text('home.detailedOrderSubtitle'),
                      icon: Icons.shopping_basket_outlined,
                      isPrimary: false,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.of(context).pushNamed(AppRoute.booking);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),

              // ─── Quick Actions ───────────────────────────────────────────
              Text(
                l10n.text('home.quickActions'),
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.textTheme.bodySmall?.color,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _QuickShortcutTile(
                      icon: Icons.replay_rounded,
                      label: l10n.text('home.reorderLast'),
                      onTap: () =>
                          Navigator.of(context).pushNamed(AppRoute.booking),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _QuickShortcutTile(
                      icon: Icons.receipt_long_outlined,
                      label: l10n.text('home.openReceipts'),
                      onTap: () {
                        if (onNavigateTab != null) {
                          onNavigateTab!(2);
                        } else {
                          Navigator.of(context).pushNamed(AppRoute.receipts);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _QuickShortcutTile(
                      icon: Icons.location_on_outlined,
                      label: l10n.text('home.openAddresses'),
                      onTap: () {
                        if (onNavigateTab != null) {
                          onNavigateTab!(3);
                        } else {
                          Navigator.of(context).pushNamed(AppRoute.profile);
                        }
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static double _progressForStatus(String code) {
    switch (code.toLowerCase()) {
      case 'new':
      case 'intake':
      case 'preparation':
        return 0.2;
      case 'sorting':
      case 'washing':
      case 'drying':
      case 'finishing':
      case 'processing':
        return 0.45;
      case 'assembly':
      case 'qa':
      case 'packing':
        return 0.65;
      case 'ready':
      case 'out_for_delivery':
        return 0.85;
      case 'delivered':
      case 'completed':
        return 1.0;
      default:
        return 0.3;
    }
  }
}

class _LauncherCard extends StatelessWidget {
  const _LauncherCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isPrimary,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool isPrimary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    final bg =
        isPrimary ? theme.colorScheme.primary : theme.colorScheme.surface;
    final fg =
        isPrimary ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface;
    final subFg = isPrimary
        ? theme.colorScheme.onPrimary.withValues(alpha: 0.88)
        : theme.textTheme.bodySmall?.color;

    return Semantics(
      button: true,
      label: title,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: Container(
          constraints: const BoxConstraints(minHeight: 124),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: isPrimary
                ? null
                : Border.all(
                    color: theme.colorScheme.secondary,
                    width: 1.5,
                  ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isPrimary
                      ? Colors.white.withValues(alpha: 0.2)
                      : ext.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(icon, size: 22, color: fg),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(color: fg),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(color: subFg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickShortcutTile extends StatelessWidget {
  const _QuickShortcutTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Container(
        constraints: const BoxConstraints(minHeight: 74),
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: ext.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: ext.brandText),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
