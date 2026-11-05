import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/app_dependencies.dart';

/// The order's money statement (Reusable Order Fin View P6-12): the server's
/// public projection. Null when the server has no figures yet (or demo mode).
final customerOrderStatementProvider = AsyncNotifierProvider.autoDispose
    .family<CustomerOrderStatementNotifier, OrderFinancialStatementModel?, String>(
  CustomerOrderStatementNotifier.new,
);

class CustomerOrderStatementNotifier
    extends AutoDisposeFamilyAsyncNotifier<OrderFinancialStatementModel?, String> {
  @override
  Future<OrderFinancialStatementModel?> build(String orderNumber) async {
    final session = ref.watch(
      customerSessionFlowProvider.select((f) => f.session),
    );
    final repository = ref.read(customerOrdersRepositoryProvider);
    try {
      return await repository.fetchOrderFinancialStatement(
        session: session,
        orderNumber: orderNumber,
      );
    } catch (e) {
      AppLogger.error('order_statement_provider.load_failed orderNumber=$orderNumber', error: e);
      throw UnexpectedAppException(
        code: 'order_statement',
        messageKey: 'orders.statement.errorBody',
        originalError: e,
      );
    }
  }
}
