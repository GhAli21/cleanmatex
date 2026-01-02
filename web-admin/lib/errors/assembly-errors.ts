/**
 * Assembly Domain Errors
 * Error classes specific to Assembly & QA workflow
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { AppError } from './base-errors';

export class AssemblyTaskNotFoundError extends AppError {
  constructor(taskId: string) {
    super(
      `Assembly task with ID ${taskId} not found`,
      'ASSEMBLY_TASK_NOT_FOUND',
      404,
      { taskId }
    );
  }
}

export class InvalidScanError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INVALID_SCAN', 400, details);
  }
}

export class ExceptionNotResolvedError extends AppError {
  constructor(exceptionId: string) {
    super(
      `Exception ${exceptionId} must be resolved before proceeding`,
      'EXCEPTION_NOT_RESOLVED',
      400,
      { exceptionId }
    );
  }
}

export class AssemblyNotCompleteError extends AppError {
  constructor(orderId: string, details?: Record<string, unknown>) {
    super(
      `Assembly not complete for order ${orderId}`,
      'ASSEMBLY_NOT_COMPLETE',
      400,
      { orderId, ...details }
    );
  }
}

export class QANotPassedError extends AppError {
  constructor(orderId: string) {
    super(
      `QA not passed for order ${orderId}`,
      'QA_NOT_PASSED',
      400,
      { orderId }
    );
  }
}

export class LocationNotFoundError extends AppError {
  constructor(locationId: string) {
    super(
      `Assembly location with ID ${locationId} not found`,
      'ASSEMBLY_LOCATION_NOT_FOUND',
      404,
      { locationId }
    );
  }
}

export class LocationCapacityExceededError extends AppError {
  constructor(locationId: string, currentLoad: number, capacity: number) {
    super(
      `Location capacity exceeded: ${currentLoad}/${capacity}`,
      'LOCATION_CAPACITY_EXCEEDED',
      400,
      { locationId, currentLoad, capacity }
    );
  }
}

