import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

class CustomerOrdersRepository {
  CustomerOrdersRepository({
    OrderTrackingService? trackingService,
  }) : _trackingService = trackingService ?? OrderTrackingService();

  final OrderTrackingService _trackingService;

  Future<List<OrderSummaryModel>> fetchOrders(CustomerSessionModel? session) {
    return _trackingService.fetchOrderSummaries(session);
  }

  Future<OrderDetailModel> fetchOrderDetail({
    required CustomerSessionModel? session,
    required String orderNumber,
  }) {
    return _trackingService.fetchOrderDetail(
      session: session,
      orderNumber: orderNumber,
    );
  }
}
