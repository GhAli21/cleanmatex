/**
 * Delivery Domain Errors
 * Error classes specific to Delivery Management & POD
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { AppError } from './base-errors';

export class RouteNotFoundError extends AppError {
  constructor(routeId: string) {
    super(
      `Delivery route with ID ${routeId} not found`,
      'DELIVERY_ROUTE_NOT_FOUND',
      404,
      { routeId }
    );
  }
}

export class InvalidOTPError extends AppError {
  constructor(orderId: string) {
    super(
      `Invalid OTP for order ${orderId}`,
      'INVALID_OTP',
      400,
      { orderId }
    );
  }
}

export class PODCaptureError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POD_CAPTURE_ERROR', 400, details);
  }
}

export class StopNotFoundError extends AppError {
  constructor(stopId: string) {
    super(
      `Delivery stop with ID ${stopId} not found`,
      'DELIVERY_STOP_NOT_FOUND',
      404,
      { stopId }
    );
  }
}

