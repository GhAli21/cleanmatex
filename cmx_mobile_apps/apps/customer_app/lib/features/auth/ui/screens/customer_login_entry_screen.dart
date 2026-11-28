import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../../core/providers/network_providers.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';
import '../../../tenant/providers/tenant_provider.dart';

const _gccDialCodes = <String>[
  '+968',
  '+966',
  '+971',
  '+974',
  '+973',
  '+965',
];

class CustomerLoginEntryScreen extends ConsumerStatefulWidget {
  const CustomerLoginEntryScreen({super.key, this.initialPhoneNumber = ''});

  final String initialPhoneNumber;

  @override
  ConsumerState<CustomerLoginEntryScreen> createState() =>
      _CustomerLoginEntryScreenState();
}

class _CustomerLoginEntryScreenState
    extends ConsumerState<CustomerLoginEntryScreen> {
  late final TextEditingController _textController;
  final TextEditingController _emailController = TextEditingController();
  String _selectedDialCode = '+968';
  String _otpChannel = 'SMS'; // 'SMS' | 'EMAIL'
  bool _isSubmitting = false;
  String? _errorMessageKey;
  String? _emailErrorKey;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialPhoneNumber);
    AppLogger.info('login_entry_screen.opened');
  }

  @override
  void dispose() {
    AppLogger.info('login_entry_screen.disposed');
    _textController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  /// Combines the selected GCC dial code with local numbers, while keeping
  /// full international numbers (`+...`) untouched.
  String? _resolveFullPhone() {
    final raw = _textController.text.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    if (raw.isEmpty) return null;
    if (raw.startsWith('+')) {
      return RegExp(r'^\+[0-9]{8,15}$').hasMatch(raw) ? raw : null;
    }
    final digits = raw.replaceFirst(RegExp(r'^0+'), '');
    if (digits.length < 7 ||
        digits.length > 15 ||
        !RegExp(r'^[0-9]+$').hasMatch(digits)) {
      return null;
    }
    for (final code in _gccDialCodes) {
      final bare = code.substring(1);
      if (digits.startsWith(bare) && digits.length >= bare.length + 7) {
        return '+$digits';
      }
    }
    return '$_selectedDialCode$digits';
  }

  String? _resolveValidEmail() {
    final raw = _emailController.text.trim().toLowerCase();
    if (raw.isEmpty) return null;
    final valid = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(raw);
    return valid ? raw : null;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final ext = CmxStatusThemeExtension.of(context);

    return AppResponsiveScrollScaffold(
      appBar: AppBar(
        title: Text(localizations.text('loginEntry.title')),
        actions: const [
          CustomerLocaleSwitchWidget(),
        ],
      ),
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppHeaderWidget(
              title: localizations.text('tenant.listTitle'),
              subtitle: localizations.text('tenant.listBody'),
            ),
            const SizedBox(height: AppSpacing.lg),
            Directionality(
              textDirection: TextDirection.ltr,
              child: TextFormField(
                controller: _textController,
                keyboardType: TextInputType.phone,
                textInputAction: _otpChannel == 'EMAIL'
                    ? TextInputAction.next
                    : TextInputAction.done,
                onChanged: (_) {
                  if (_errorMessageKey != null) {
                    setState(() => _errorMessageKey = null);
                  }
                },
                onFieldSubmitted: (_) {
                  if (!_isSubmitting && _otpChannel != 'EMAIL') {
                    _submit(context);
                  }
                },
                decoration: InputDecoration(
                  labelText: localizations.text('loginEntry.phoneLabel'),
                  hintText: localizations.text('loginEntry.phoneHint'),
                  errorText: _errorMessageKey == null
                      ? null
                      : localizations.text(_errorMessageKey!),
                  prefixIconConstraints: const BoxConstraints(minWidth: 0),
                  prefixIcon: Padding(
                    padding: const EdgeInsetsDirectional.only(
                      start: AppSpacing.sm,
                      end: AppSpacing.xs,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedDialCode,
                            isDense: true,
                            onChanged: (v) {
                              if (v != null) {
                                setState(() => _selectedDialCode = v);
                              }
                            },
                            items: _gccDialCodes
                                .map(
                                  (code) => DropdownMenuItem<String>(
                                    value: code,
                                    child: Text(
                                      code,
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                        ),
                        const SizedBox(
                          height: 22,
                          child: VerticalDivider(width: 1),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              localizations.text('loginEntry.otpChannelLabel'),
              style:
                  theme.textTheme.labelMedium?.copyWith(color: ext.textMuted),
            ),
            const SizedBox(height: AppSpacing.xs),
            AppSegmentedControlWidget<String>(
              selectedValue: _otpChannel,
              onChanged: (next) {
                setState(() {
                  _otpChannel = next;
                  _emailErrorKey = null;
                });
              },
              options: [
                AppSegmentOption(
                  value: 'SMS',
                  label: localizations.text('loginEntry.channelSms'),
                ),
                AppSegmentOption(
                  value: 'EMAIL',
                  label: localizations.text('loginEntry.channelEmail'),
                ),
              ],
            ),
            if (_otpChannel == 'EMAIL') ...[
              const SizedBox(height: AppSpacing.md),
              Directionality(
                textDirection: TextDirection.ltr,
                child: TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onChanged: (_) {
                    if (_emailErrorKey != null) {
                      setState(() => _emailErrorKey = null);
                    }
                  },
                  onFieldSubmitted: (_) {
                    if (!_isSubmitting) _submit(context);
                  },
                  decoration: InputDecoration(
                    labelText: localizations.text('loginEntry.emailLabel'),
                    hintText: localizations.text('loginEntry.emailHint'),
                    prefixIcon: const Icon(Icons.email_outlined),
                    errorText: _emailErrorKey == null
                        ? null
                        : localizations.text(_emailErrorKey!),
                  ),
                ),
              ),
            ],
            const Spacer(),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('tenant.findAction'),
                onPressed: _isSubmitting ? null : () => _submit(context),
                isPrimary: true,
                isLoading: _isSubmitting,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('auth.passwordLoginTitle'),
                onPressed: _isSubmitting ? null : () => _goToPassword(context),
                isPrimary: false,
                icon: Icons.lock_outline_rounded,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _goToPassword(BuildContext context) {
    final fullPhone = _resolveFullPhone();
    if (fullPhone == null) {
      setState(() => _errorMessageKey = 'loginEntry.phoneValidationError');
      return;
    }
    Navigator.of(context).pushNamed(
      AppRoute.passwordLogin,
      arguments: fullPhone,
    );
  }

  Future<void> _submit(BuildContext context) async {
    final fullPhone = _resolveFullPhone();
    AppLogger.info(
      'login_entry_screen.submit_attempted channel=$_otpChannel valid=${fullPhone != null}',
    );

    if (fullPhone == null) {
      AppLogger.warning('login_entry_screen.submit_rejected_invalid_phone');
      setState(() => _errorMessageKey = 'loginEntry.phoneValidationError');
      return;
    }

    String? email;
    if (_otpChannel == 'EMAIL') {
      final rawEmail = _emailController.text.trim();
      if (rawEmail.isNotEmpty) {
        email = _resolveValidEmail();
        if (email == null) {
          setState(() => _emailErrorKey = 'loginEntry.emailValidationError');
          return;
        }
      }
    }

    setState(() {
      _isSubmitting = true;
      _errorMessageKey = null;
      _emailErrorKey = null;
    });

    try {
      final tenantId = ref.read(tenantProvider).valueOrNull?.tenantOrgId ?? '';
      if (tenantId.isNotEmpty) {
        final hasPassword = await ref
            .read(customerAuthRepositoryProvider)
            .checkHasPassword(phoneNumber: fullPhone, tenantId: tenantId);
        if (hasPassword && context.mounted) {
          AppLogger.info('login_entry_screen.routing_to_password_login');
          Navigator.of(context).pushNamed(
            AppRoute.passwordLogin,
            arguments: fullPhone,
          );
          return;
        }
      }

      await ref.read(customerSessionFlowProvider.notifier).signInWithPhone(
            phoneNumber: fullPhone,
            channel: _otpChannel,
            email: email,
          );
      AppLogger.info('login_entry_screen.submit_succeeded channel=$_otpChannel');
      if (!context.mounted) return;
      Navigator.of(context).pushNamed(AppRoute.otpVerify);
    } catch (error, stackTrace) {
      AppLogger.error(
        'login_entry_screen.submit_failed',
        error: error,
        stackTrace: stackTrace,
      );
      if (!context.mounted) return;
      setState(() => _errorMessageKey = 'loginEntry.genericError');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
