import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/app_dependencies.dart';

/// Customer orders list — reloads when [customerSessionFlowProvider] session changes.
final customerOrdersProvider =
    AsyncNotifierProvider<CustomerOrdersNotifier, List<OrderSummaryModel>>(
  CustomerOrdersNotifier.new,
);

class CustomerOrdersNotifier extends AsyncNotifier<List<OrderSummaryModel>> {
  @override
  Future<List<OrderSummaryModel>> build() async {
    final session = ref.watch(
      customerSessionFlowProvider.select((f) => f.session),
    );
    final repository = ref.read(customerOrdersRepositoryProvider);
    try {
      return await repository.fetchOrders(session);
    } catch (e) {
      throw UnexpectedAppException(
        code: 'orders_list',
        messageKey: 'orders.errorBody',
        originalError: e,
      );
    }
  }
}
