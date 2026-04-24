import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_l10n/mobile_l10n.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:mobile_ui/mobile_ui.dart';

import '../../providers/tenant_provider.dart';
import '../../../../core/navigation/app_route.dart';

class CustomerTenantDiscoveryScreen extends ConsumerStatefulWidget {
  const CustomerTenantDiscoveryScreen({super.key});

  @override
  ConsumerState<CustomerTenantDiscoveryScreen> createState() =>
      _CustomerTenantDiscoveryScreenState();
}

class _CustomerTenantDiscoveryScreenState
    extends ConsumerState<CustomerTenantDiscoveryScreen> {
  final _codeController = TextEditingController();
  bool _showScanner = false;
  bool _scannerUsed = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _resolve(String slug) async {
    if (slug.trim().isEmpty) return;
    await ref.read(tenantProvider.notifier).resolveBySlug(slug.trim());
    if (!mounted) return;
    final tenantState = ref.read(tenantProvider);
    if (tenantState is AsyncData && tenantState.value != null) {
      Navigator.of(context).pushReplacementNamed(AppRoute.tenantConfirm);
    }
  }

  void _onQrDetect(BarcodeCapture capture) {
    if (_scannerUsed) {
      return;
    }
    final first = capture.barcodes.isEmpty ? null : capture.barcodes.first;
    final raw = first?.rawValue ?? '';
    // Expect format: cmx://t/{slug}
    final uri = Uri.tryParse(raw);
    if (uri != null && uri.scheme == 'cmx' && uri.pathSegments.isNotEmpty) {
      _scannerUsed = true;
      setState(() => _showScanner = false);
      _resolve(uri.pathSegments.last);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final tenantState = ref.watch(tenantProvider);
    final isLoading = tenantState is AsyncLoading;
    final errorKey =
        tenantState is AsyncError ? 'tenant.notFoundError' : null;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          l10n.text('tenant.discoveryTitle'),
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ),
      body: _showScanner
          ? _buildScanner(l10n)
          : _buildForm(context, l10n, isLoading, errorKey),
    );
  }

  Widget _buildScanner(AppLocalizations l10n) {
    return Stack(
      children: [
        MobileScanner(onDetect: _onQrDetect),
        Positioned(
          bottom: AppSpacing.xl,
          left: 0,
          right: 0,
          child: Center(
            child: Text(
              l10n.text('tenant.scanningLabel'),
              style: const TextStyle(
                color: AppColors.textPrimaryDark,
                fontWeight: FontWeight.w500,
                shadows: [Shadow(color: AppColors.textPrimary, blurRadius: 8)],
              ),
            ),
          ),
        ),
        Positioned(
          top: AppSpacing.md,
          left: AppSpacing.md,
          child: AppCustomButtonWidget(
            label: l10n.text('common.back'),
            isPrimary: false,
            onPressed: () => setState(() => _showScanner = false),
          ),
        ),
      ],
    );
  }

  Widget _buildForm(
    BuildContext context,
    AppLocalizations l10n,
    bool isLoading,
    String? errorKey,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.xl),
          AppCustomButtonWidget(
            label: l10n.text('tenant.scanQrAction'),
            onPressed: isLoading
                ? null
                : () {
                    _scannerUsed = false;
                    setState(() => _showScanner = true);
                  },
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            controller: _codeController,
            decoration: InputDecoration(
              labelText: l10n.text('tenant.enterCodeAction'),
              hintText: l10n.text('tenant.codeHint'),
            ),
            textInputAction: TextInputAction.done,
            onSubmitted: isLoading ? null : _resolve,
          ),
          if (errorKey != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.text(errorKey),
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: AppColors.error),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          AppCustomButtonWidget(
            label: isLoading
                ? l10n.text('common.loading')
                : l10n.text('tenant.findAction'),
            onPressed: isLoading ? null : () => _resolve(_codeController.text),
          ),
        ],
      ),
    );
  }
}
