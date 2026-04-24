import 'package:mobile_domain/mobile_domain.dart';
import 'package:mobile_services/mobile_services.dart';

class CustomerOrderBookingRepository {
  CustomerOrderBookingRepository({
    OrderBookingService? bookingService,
  }) : _bookingService = bookingService ?? OrderBookingService();

  final OrderBookingService _bookingService;

  Future<BookingBootstrapModel> loadBootstrap(CustomerSessionModel? session) {
    return _bookingService.loadBootstrap(session);
  }

  Future<BookingConfirmationModel> submit(
    OrderBookingDraftModel draft, {
    required CustomerSessionModel? session,
    required String fulfillmentType,
  }) {
    return _bookingService.submit(
      draft,
      session: session,
      fulfillmentType: fulfillmentType,
    );
  }

  Future<AddressOptionModel> createAddress(
    NewAddressInputModel input, {
    required CustomerSessionModel? session,
  }) {
    return _bookingService.createAddress(input, session: session);
  }
}
