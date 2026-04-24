import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_core/mobile_core.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../../../core/app_shell_controller.dart';
import '../../../core/providers/app_dependencies.dart';

/// Order detail for a given [orderNumber] — autoDispose when the screen is popped.
final customerOrderDetailProvider = AsyncNotifierProvider.autoDispose
    .family<CustomerOrderDetailNotifier, OrderDetailModel, String>(
  CustomerOrderDetailNotifier.new,
);

class CustomerOrderDetailNotifier
    extends AutoDisposeFamilyAsyncNotifier<OrderDetailModel, String> {
  @override
  Future<OrderDetailModel> build(String orderNumber) async {
    final session = ref.watch(
      customerSessionFlowProvider.select((f) => f.session),
    );
    final repository = ref.read(customerOrdersRepositoryProvider);
    try {
      return await repository.fetchOrderDetail(
        session: session,
        orderNumber: orderNumber,
      );
    } catch (e) {
      throw UnexpectedAppException(
        code: 'order_detail',
        messageKey: 'orders.detailErrorBody',
        originalError: e,
      );
    }
  }
}
