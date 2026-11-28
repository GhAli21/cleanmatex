import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../../core/providers/theme_mode_provider.dart';
import '../../../tenant/providers/tenant_provider.dart';
import '../../../tenant/ui/widgets/customer_tenant_switcher_sheet_widget.dart';
import '../../providers/customer_profile_provider.dart';

/// Complete CleanMateX Customer Account & Profile screen:
/// - Customer Code + all registered CleanMateX details
/// - Editable Mobile & Email (dual-scope `sys` vs `org`)
/// - Saved Addresses + Add Address modal (dual-scope `sys` vs `org`)
/// - Interactive Default Care Preferences
/// - Saved General Order Note + `autoApplyOrderDefaultNote` toggle
/// - My Laundries Switcher (active + unhide hidden)
/// - Language (EN/AR) & ThemeMode (System/Light/Dark)
class CustomerProfileScreen extends ConsumerStatefulWidget {
  const CustomerProfileScreen({super.key});

  @override
  ConsumerState<CustomerProfileScreen> createState() =>
      _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends ConsumerState<CustomerProfileScreen> {
  final TextEditingController _defaultNoteController = TextEditingController();
  bool _noteSynced = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    AppLogger.info('profile_screen.opened');
  }

  @override
  void dispose() {
    _defaultNoteController.dispose();
    AppLogger.info('profile_screen.disposed');
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session =
        ref.watch(customerSessionFlowProvider.select((f) => f.session));
    final tenant = ref.watch(tenantProvider).valueOrNull;
    final profileAsync = ref.watch(customerProfileProvider);
    final themeMode = ref.watch(customerThemeModeProvider);
    final currentLocale = ref.watch(customerLocaleProvider);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.text('profile.title')),
      ),
      body: SafeArea(
        child: profileAsync.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: const [
              AppSkeletonWidget(height: 140),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 140),
              SizedBox(height: AppSpacing.md),
              AppSkeletonWidget(height: 120),
            ],
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              AppErrorWidget(
                title: l10n.text('profile.loadErrorTitle'),
                message: error is AppException
                    ? l10n.text(error.messageKey)
                    : l10n.text('common.remoteRequestError'),
                retryLabel: l10n.text('common.retry'),
                onRetry: () => ref.invalidate(customerProfileProvider),
              ),
            ],
          ),
          data: (profile) {
            if (profile != null && !_noteSynced) {
              _noteSynced = true;
              _defaultNoteController.text = profile.defaultOrderNote ?? '';
            }

            final isAr = l10n.locale.languageCode == 'ar';
            final tenantName = tenant == null
                ? l10n.text('profile.noLaundrySelected')
                : (isAr && (tenant.name2?.isNotEmpty ?? false)
                    ? tenant.name2!
                    : tenant.name);
            final branchName = isAr &&
                    (profile?.lastBranchName2?.isNotEmpty ?? false)
                ? profile!.lastBranchName2!
                : (profile?.lastBranchName ?? tenant?.lastBranchName);

            return RefreshIndicator(
              onRefresh: () => ref.refresh(customerProfileProvider.future),
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  // 1. Registered Identity Card (Customer Code + all CleanMateX info)
                  AppCardWidget(
                    accentColor: theme.colorScheme.primary,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 26,
                              backgroundColor: ext.brand.background,
                              child: Icon(
                                Icons.person_rounded,
                                size: 28,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    profile?.displayName ??
                                        profile?.name ??
                                        session?.displayName ??
                                        l10n.text('profile.customerFallback'),
                                    style: theme.textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  if ((profile?.customerCode ?? '').isNotEmpty)
                                    AppCodeChipWidget(
                                      code: ltrCode(profile!.customerCode!),
                                      copiedFeedbackMessage: l10n
                                          .text('common.copiedToClipboard'),
                                    ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: profile == null
                                  ? null
                                  : () => _openEditContactSheet(
                                        context,
                                        profile,
                                        l10n,
                                      ),
                              icon: const Icon(Icons.edit_outlined),
                              tooltip: l10n.text('profile.editContactAction'),
                            ),
                          ],
                        ),
                        const Divider(height: AppSpacing.lg),
                        _ProfileInfoRow(
                          icon: Icons.phone_outlined,
                          label: l10n.text('profile.phoneLabel'),
                          value: ltrCode(
                            profile?.mobile ?? session?.phoneNumber ?? '-',
                          ),
                          verified: profile?.mobileVerified == true,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ProfileInfoRow(
                          icon: Icons.email_outlined,
                          label: l10n.text('profile.emailLabel'),
                          value: (profile?.email ?? '').isNotEmpty
                              ? profile!.email!
                              : l10n.text('profile.notProvided'),
                          verified: profile?.emailVerified == true,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            AppStatusBadgeWidget(
                              label:
                                  '${l10n.text('profile.loyaltyPointsLabel')}: ${profile?.loyaltyPoints ?? 0}',
                              tone: CmxSemanticTone.brand,
                              icon: Icons.stars_rounded,
                            ),
                            AppStatusBadgeWidget(
                              label: profile?.hasSysCustomerId == true
                                  ? l10n.text('profile.globalAccountBadge')
                                  : l10n.text('profile.localAccountBadge'),
                              tone: CmxSemanticTone.neutral,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // 2. Active Laundry & Last Branch + My Laundries Switcher
                  AppCardWidget(
                    child: Row(
                      children: [
                        Icon(Icons.storefront_rounded,
                            color: theme.colorScheme.primary),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.text('profile.laundryLabel'),
                                style: theme.textTheme.labelMedium
                                    ?.copyWith(color: ext.textMuted),
                              ),
                              Text(tenantName,
                                  style: theme.textTheme.titleSmall),
                              if (branchName != null && branchName.isNotEmpty)
                                Text(
                                  branchName,
                                  style: theme.textTheme.bodySmall
                                      ?.copyWith(color: ext.textMuted),
                                ),
                            ],
                          ),
                        ),
                        FilledButton.tonal(
                          onPressed: () =>
                              CustomerTenantSwitcherSheetWidget.show(context),
                          child: Text(l10n.text('tenantSwitcher.switchAction')),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // 3. Saved Addresses + Add Address (dual-scope sys/org)
                  AppCardWidget(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                l10n.text('profile.savedAddressesTitle'),
                                style: theme.textTheme.titleMedium,
                              ),
                            ),
                            TextButton.icon(
                              onPressed: profile == null
                                  ? null
                                  : () => _openAddAddressSheet(context, l10n),
                              icon: const Icon(Icons.add_location_alt_outlined,
                                  size: 18),
                              label: Text(l10n.text('profile.addAddressAction')),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        if ((profile?.addresses ?? const []).isEmpty)
                          Text(
                            l10n.text('booking.addressesEmptyBody'),
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: ext.textMuted),
                          )
                        else
                          for (final addr in profile!.addresses) ...[
                            ListTile(
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              leading: Icon(
                                Icons.location_on_outlined,
                                color: addr.isDefault
                                    ? theme.colorScheme.primary
                                    : ext.textMuted,
                              ),
                              title: Text(addr.label),
                              subtitle: addr.description.isNotEmpty
                                  ? Text(addr.description)
                                  : null,
                              trailing: addr.isDefault
                                  ? AppStatusBadgeWidget(
                                      label: l10n
                                          .text('booking.addressDefaultLabel'),
                                      tone: CmxSemanticTone.brand,
                                    )
                                  : null,
                            ),
                          ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // 4. Default Care Preferences (interactive)
                  if (profile != null) ...[
                    _buildCarePreferencesCard(context, l10n, profile, theme),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  // 5. Saved General Order Note + auto_apply_order_default_note toggle
                  if (profile != null) ...[
                    AppCardWidget(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.text('profile.defaultOrderNoteTitle'),
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            l10n.text('profile.defaultOrderNoteSubtitle'),
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: ext.textMuted),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          TextField(
                            controller: _defaultNoteController,
                            maxLines: 3,
                            maxLength: 500,
                            decoration: InputDecoration(
                              hintText: l10n.text('booking.notesHint'),
                            ),
                          ),
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              l10n.text('profile.autoApplyDefaultNoteLabel'),
                              style: theme.textTheme.titleSmall,
                            ),
                            value: profile.autoApplyOrderDefaultNote,
                            onChanged: _isSaving
                                ? null
                                : (val) => _saveDefaultNote(
                                      context,
                                      l10n,
                                      _defaultNoteController.text,
                                      val,
                                    ),
                          ),
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: FilledButton.tonal(
                              onPressed: _isSaving
                                  ? null
                                  : () => _saveDefaultNote(
                                        context,
                                        l10n,
                                        _defaultNoteController.text,
                                        profile.autoApplyOrderDefaultNote,
                                      ),
                              child: Text(l10n.text('common.save')),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],

                  // 6. Language & Appearance (Light / Dark / System)
                  AppCardWidget(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.text('profile.appPreferencesTitle'),
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          l10n.text('profile.languageLabel'),
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: ext.textMuted),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        AppSegmentedControlWidget<String>(
                          selectedValue: currentLocale.languageCode,
                          onChanged: (lang) => ref
                              .read(customerLocaleProvider.notifier)
                              .setLocale(Locale(lang)),
                          options: const [
                            AppSegmentOption(value: 'en', label: 'English'),
                            AppSegmentOption(value: 'ar', label: 'العربية'),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          l10n.text('profile.appearanceLabel'),
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: ext.textMuted),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        AppSegmentedControlWidget<ThemeMode>(
                          selectedValue: themeMode,
                          onChanged: (mode) => ref
                              .read(customerThemeModeProvider.notifier)
                              .setThemeMode(mode),
                          options: [
                            AppSegmentOption(
                              value: ThemeMode.system,
                              label: l10n.text('profile.themeSystem'),
                            ),
                            AppSegmentOption(
                              value: ThemeMode.light,
                              label: l10n.text('profile.themeLight'),
                            ),
                            AppSegmentOption(
                              value: ThemeMode.dark,
                              label: l10n.text('profile.themeDark'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // 7. Password & Sign Out
                  AppCardWidget(
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            session?.hasPassword == true
                                ? l10n.text('profile.passwordStatusEnabled')
                                : l10n.text('profile.passwordStatusNotSet'),
                            style: theme.textTheme.bodyMedium,
                          ),
                        ),
                        if (session?.verificationToken?.isNotEmpty == true)
                          TextButton(
                            onPressed: () {
                              Navigator.of(context).pushNamed(
                                AppRoute.setPassword,
                                arguments: session!.verificationToken,
                              );
                            },
                            child: Text(
                              l10n.text('profile.changePasswordAction'),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SizedBox(
                    width: double.infinity,
                    child: AppCustomButtonWidget(
                      label: l10n.text('profile.signOutAction'),
                      onPressed: () => _confirmSignOut(context, l10n),
                      isPrimary: false,
                      icon: Icons.logout_rounded,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildCarePreferencesCard(
    BuildContext context,
    AppLocalizations l10n,
    CustomerProfileModel profile,
    ThemeData theme,
  ) {
    final ext = CmxStatusThemeExtension.of(context);

    Future<void> updateKey(String key, Object value) async {
      HapticFeedback.selectionClick();
      final next = Map<String, Object?>.from(profile.preferences);
      next[key] = value;
      try {
        await ref
            .read(customerProfileProvider.notifier)
            .updatePreferences(next);
      } catch (_) {
        if (context.mounted) _showError(context, l10n);
      }
    }

    return AppCardWidget(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.text('profile.carePreferencesTitle'),
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.text('profile.prefFinishingLabel'),
            style:
                theme.textTheme.labelMedium?.copyWith(color: ext.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              for (final opt in ['hanger', 'folded'])
                ChoiceChip(
                  label: Text(l10n.text('profile.prefOption.$opt')),
                  selected: profile.finishingPref == opt,
                  onSelected: (_) => updateKey('finishing', opt),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.text('profile.prefStarchLabel'),
            style:
                theme.textTheme.labelMedium?.copyWith(color: ext.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              for (final opt in ['none', 'light', 'medium', 'heavy'])
                ChoiceChip(
                  label: Text(l10n.text('profile.prefOption.$opt')),
                  selected: profile.starchPref == opt,
                  onSelected: (_) => updateKey('starch', opt),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.text('profile.prefDetergentLabel'),
            style:
                theme.textTheme.labelMedium?.copyWith(color: ext.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              for (final opt in ['standard', 'sensitive', 'eco'])
                ChoiceChip(
                  label: Text(l10n.text('profile.prefOption.$opt')),
                  selected: profile.detergentPref == opt,
                  onSelected: (_) => updateKey('detergent', opt),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: Text(
              l10n.text('profile.prefFragranceLabel'),
              style: theme.textTheme.titleSmall,
            ),
            value: profile.fragrancePref,
            onChanged: (v) => updateKey('fragrance', v),
          ),
        ],
      ),
    );
  }

  Future<void> _saveDefaultNote(
    BuildContext context,
    AppLocalizations l10n,
    String note,
    bool autoApply,
  ) async {
    setState(() => _isSaving = true);
    try {
      await ref.read(customerProfileProvider.notifier).updateDefaultOrderNote(
            defaultOrderNote: note.trim(),
            autoApplyOrderDefaultNote: autoApply,
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.text('profile.savedFeedback'))),
        );
      }
    } catch (_) {
      if (context.mounted) _showError(context, l10n);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _openEditContactSheet(
    BuildContext context,
    CustomerProfileModel profile,
    AppLocalizations l10n,
  ) async {
    final nameCtrl = TextEditingController(text: profile.name ?? '');
    final mobileCtrl = TextEditingController(text: profile.mobile ?? '');
    final emailCtrl = TextEditingController(text: profile.email ?? '');
    String? inlineError;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(ctx).bottom,
          ),
          child: AppBottomSheetShellWidget(
            title: l10n.text('profile.editContactAction'),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: InputDecoration(
                    labelText: l10n.text('profile.nameLabel'),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: mobileCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: l10n.text('profile.phoneLabel'),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: l10n.text('profile.emailLabel'),
                  ),
                ),
                if (inlineError != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    inlineError!,
                    style: Theme.of(ctx)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppColors.error),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                AppCustomButtonWidget(
                  label: l10n.text('common.save'),
                  isLoading: saving,
                  onPressed: saving
                      ? null
                      : () async {
                          setSheetState(() {
                            saving = true;
                            inlineError = null;
                          });
                          try {
                            await ref
                                .read(customerProfileProvider.notifier)
                                .updateContact(
                                  name: nameCtrl.text.trim(),
                                  mobile: mobileCtrl.text.trim(),
                                  email: emailCtrl.text.trim(),
                                );
                            if (ctx.mounted) Navigator.of(ctx).pop();
                          } catch (err) {
                            setSheetState(() {
                              saving = false;
                              inlineError = err is AppException
                                  ? l10n.text(err.messageKey)
                                  : l10n.text('common.remoteRequestError');
                            });
                          }
                        },
                ),
              ],
            ),
          ),
        ),
      ),
    );
    nameCtrl.dispose();
    mobileCtrl.dispose();
    emailCtrl.dispose();
  }

  Future<void> _openAddAddressSheet(
    BuildContext context,
    AppLocalizations l10n,
  ) async {
    final labelCtrl = TextEditingController();
    final buildingCtrl = TextEditingController();
    final areaCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    var isDefault = false;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(ctx).bottom,
          ),
          child: AppBottomSheetShellWidget(
            title: l10n.text('profile.addAddressAction'),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: labelCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.text('booking.addressLabelField'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: buildingCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.text('profile.addressBuildingLabel'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: areaCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.text('booking.addressAreaField'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: cityCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.text('booking.addressCityField'),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: notesCtrl,
                    decoration: InputDecoration(
                      labelText: l10n.text('profile.addressNotesLabel'),
                    ),
                  ),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.text('profile.setAsDefaultAddress')),
                    value: isDefault,
                    onChanged: (v) => setSheetState(() => isDefault = v),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppCustomButtonWidget(
                    label: l10n.text('common.save'),
                    isLoading: saving,
                    onPressed: saving
                        ? null
                        : () async {
                            if (labelCtrl.text.trim().isEmpty) return;
                            setSheetState(() => saving = true);
                            try {
                              await ref
                                  .read(customerProfileProvider.notifier)
                                  .addAddress(
                                    label: labelCtrl.text.trim(),
                                    building: buildingCtrl.text.trim(),
                                    area: areaCtrl.text.trim(),
                                    city: cityCtrl.text.trim(),
                                    deliveryNotes: notesCtrl.text.trim(),
                                    isDefault: isDefault,
                                  );
                              if (ctx.mounted) Navigator.of(ctx).pop();
                            } catch (_) {
                              setSheetState(() => saving = false);
                              if (ctx.mounted) _showError(ctx, l10n);
                            }
                          },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    labelCtrl.dispose();
    buildingCtrl.dispose();
    areaCtrl.dispose();
    cityCtrl.dispose();
    notesCtrl.dispose();
  }

  Future<void> _confirmSignOut(
    BuildContext context,
    AppLocalizations localizations,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(localizations.text('home.signOutConfirmTitle')),
        content: Text(localizations.text('home.signOutConfirmBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(localizations.text('home.signOutCancelAction')),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(localizations.text('home.signOutConfirmAction')),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;
    await ref.read(customerSessionFlowProvider.notifier).clearSession();
    if (!context.mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoute.entry,
      (route) => false,
    );
  }

  void _showError(BuildContext context, AppLocalizations l10n) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.text('common.remoteRequestError'))),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.verified = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: ext.textMuted),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: ext.textMuted)),
              Text(value, style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
        if (verified)
          Icon(
            Icons.verified_rounded,
            size: 18,
            color: ext.success.foreground,
          ),
      ],
    );
  }
}
