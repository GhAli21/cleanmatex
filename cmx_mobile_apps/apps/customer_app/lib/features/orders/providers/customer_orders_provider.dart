import 'package:flutter/material.dart';
import 'package:mobile_domain/mobile_domain.dart';

import '../data/repositories/customer_orders_repository.dart';

class CustomerOrdersProvider extends ChangeNotifier {
  CustomerOrdersProvider({
    CustomerOrdersRepository? repository,
  }) : _repository = repository ?? CustomerOrdersRepository();

  final CustomerOrdersRepository _repository;

  bool _isLoading = false;
  String? _errorMessageKey;
  List<OrderSummaryModel> _orders = const [];

  bool get isLoading => _isLoading;
  String? get errorMessageKey => _errorMessageKey;
  List<OrderSummaryModel> get orders => _orders;
  bool get isEmpty =>
      !_isLoading && _errorMessageKey == null && _orders.isEmpty;

  Future<void> load(CustomerSessionModel? session) async {
    _isLoading = true;
    _errorMessageKey = null;
    notifyListeners();

    try {
      _orders = await _repository.fetchOrders(session);
    } catch (_) {
      _errorMessageKey = 'orders.errorBody';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
