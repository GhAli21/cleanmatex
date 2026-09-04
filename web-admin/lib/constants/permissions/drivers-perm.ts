export const DRIVERS_PERMISSIONS = {
  READ: 'drivers:read',
  CREATE: 'drivers:create',
  UPDATE: 'drivers:update',
  DELETE: 'drivers:delete',
} as const;

export type DriversPermission = (typeof DRIVERS_PERMISSIONS)[keyof typeof DRIVERS_PERMISSIONS];

export const DELIVERY_PERMISSIONS = {
  ROUTES: 'delivery:routes',
  ASSIGN: 'delivery:assign',
  TRACK: 'delivery:track',
  POD: 'delivery:pod',
} as const;

export type DeliveryPermission = (typeof DELIVERY_PERMISSIONS)[keyof typeof DELIVERY_PERMISSIONS];
