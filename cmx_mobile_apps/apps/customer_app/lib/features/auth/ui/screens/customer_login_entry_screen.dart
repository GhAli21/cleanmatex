import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../../../core/app_shell_controller.dart';
import '../../../../core/navigation/app_route.dart';
import '../../../common/ui/widgets/customer_locale_switch_widget.dart';

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
  bool _isSubmitting = false;
  String? _errorMessageKey;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialPhoneNumber);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

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
                textInputAction: TextInputAction.done,
                onChanged: (_) {
                  if (_errorMessageKey != null) {
                    setState(() => _errorMessageKey = null);
                  }
                },
                onFieldSubmitted: (_) {
                  if (!_isSubmitting) {
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
                      start: AppSpacing.md,
                      end: AppSpacing.sm,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+968',
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        const SizedBox(
                          height: 22,
                          child: VerticalDivider(width: 1),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: AppCustomButtonWidget(
                label: localizations.text('tenant.findAction'),
                onPressed: _isSubmitting ? null : () => _submit(context),
                isPrimary: true,
                isLoading: _isSubmitting,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit(BuildContext context) async {
    final normalized = _textController.text.replaceAll(RegExp(r'\s+'), '');

    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(normalized)) {
      setState(() => _errorMessageKey = 'loginEntry.phoneValidationError');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessageKey = null;
    });

    try {
      await ref
          .read(customerSessionFlowProvider.notifier)
          .signInWithPhone(phoneNumber: normalized);
      if (!context.mounted) return;
      Navigator.of(context).pushNamed(AppRoute.otpVerify);
    } catch (_) {
      if (!context.mounted) return;
      setState(() => _errorMessageKey = 'loginEntry.genericError');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
