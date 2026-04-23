import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../data/repositories/customer_orders_repository.dart';

class CustomerOrderDetailProvider extends ChangeNotifier {
  CustomerOrderDetailProvider({
    CustomerOrdersRepository? repository,
  }) : _repository = repository ?? CustomerOrdersRepository();

  final CustomerOrdersRepository _repository;

  bool _isLoading = false;
  String? _errorMessageKey;
  OrderDetailModel? _order;

  bool get isLoading => _isLoading;
  String? get errorMessageKey => _errorMessageKey;
  OrderDetailModel? get order => _order;

  Future<void> load({
    required CustomerSessionModel? session,
    required String orderNumber,
  }) async {
    _isLoading = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      _order = await _repository.fetchOrderDetail(
        session: session,
        orderNumber: orderNumber,
      );
    } catch (_) {
      _errorMessageKey = 'orders.detailErrorBody';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
