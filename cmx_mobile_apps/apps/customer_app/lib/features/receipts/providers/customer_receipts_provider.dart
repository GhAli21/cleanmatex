import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/customer_api_client_providers.dart';
import '../../tenant/providers/tenant_provider.dart';

final customerReceiptsProvider =
    FutureProvider<List<DigitalReceiptSummaryModel>>((ref) async {
  final session =
      ref.watch(customerSessionFlowProvider.select((f) => f.session));
  final token = session?.verificationToken;
  if (session == null || session.isGuest || token == null || token.isEmpty) {
    return const [];
  }
  final tenant = ref.watch(tenantProvider).valueOrNull;
  final tenantId = tenant?.tenantOrgId ?? session.tenantOrgId;
  if (tenantId == null || tenantId.isEmpty) {
    return const [];
  }
  return ref.read(digitalReceiptServiceProvider).listReceipts(
        tenantId: tenantId,
        bearerToken: token,
      );
});

final customerReceiptDetailProvider =
    FutureProvider.family<DigitalReceiptDetailModel, String>(
        (ref, orderNo) async {
  final session =
      ref.watch(customerSessionFlowProvider.select((f) => f.session));
  final token = session?.verificationToken ?? '';
  final tenantId = token.isNotEmpty
      ? (ref.watch(tenantProvider).valueOrNull?.tenantOrgId ??
          session?.tenantOrgId ??
          '')
      : '';
  return ref.read(digitalReceiptServiceProvider).getReceiptDetail(
        tenantId: tenantId,
        bearerToken: token,
        orderNo: orderNo,
      );
});
