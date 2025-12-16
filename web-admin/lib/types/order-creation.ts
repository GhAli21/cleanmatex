/**
 * Order Creation Types
 * Centralized type definitions for the new order POS interface
 * Re-Design: PRD-010 Advanced Orders
 */

export interface OrderLineItem {
  id: string; // Unique identifier for this line item
  productId: string;
  productName: string;
  productName2?: string; // Arabic name
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  serviceCategoryCode?: string;

  // Item details
  color?: string;
  brand?: string;
  notes?: string;

  // Condition flags
  conditions: string[]; // Array of condition codes like 'coffee_stain', 'button_broken'
  hasStain: boolean;
  hasDamage: boolean;
  stainNotes?: string;
  damageNotes?: string;
}

export interface OrderCreationState {
  // Customer
  customer: {
    id: string;
    name: string;
    name2?: string;
    phone?: string;
    email?: string;
  } | null;

  // Items in cart
  items: OrderLineItem[];

  // Settings
  settings: {
    express: boolean;
    quickDrop: boolean;
    quickDropQuantity: number;
    retail: boolean;
  };

  // Notes
  notes: string;

  // Ready-by date/time
  readyByDate: Date | null;
  readyByTime: string | null;
  readyByAt: string; // ISO string for API

  // Calculated totals
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}

export interface StainCondition {
  code: string;
  label: string;
  label2?: string; // Arabic label
  icon?: string;
  category: 'stain' | 'damage' | 'special';
}

export const STAIN_CONDITIONS: StainCondition[] = [
  // Stains
  { code: 'bubble', label: 'Bubble', category: 'stain' },
  { code: 'coffee', label: 'Coffee', category: 'stain' },
  { code: 'ink', label: 'Ink', category: 'stain' },
  { code: 'grease', label: 'Grease', category: 'stain' },
  { code: 'bleach', label: 'Bleach', category: 'stain' },
  { code: 'wine', label: 'Wine', category: 'stain' },
  { code: 'blood', label: 'Blood', category: 'stain' },
  { code: 'mud', label: 'Mud', category: 'stain' },
  { code: 'oil', label: 'Oil', category: 'stain' },

  // Damages
  { code: 'button_broken', label: 'Button Broken', category: 'damage' },
  { code: 'button_missing', label: 'Button Missing', category: 'damage' },
  { code: 'collar_torn', label: 'Collar Torn', category: 'damage' },
  { code: 'zipper_broken', label: 'Zipper Broken', category: 'damage' },
  { code: 'hole', label: 'Hole', category: 'damage' },
  { code: 'tear', label: 'Tear', category: 'damage' },
  { code: 'seam_open', label: 'Seam Open', category: 'damage' },

  // Special
  { code: 'special_care', label: 'Special Care', category: 'special' },
  { code: 'delicate', label: 'Delicate', category: 'special' },
];

export interface PaymentOption {
  id: string;
  label: string;
  label2?: string;
  icon?: string;
  isDefault?: boolean;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'pay_on_collection', label: 'Pay on Collection', isDefault: true, icon: '📦' },
  { id: 'check', label: 'Check', icon: '🏦' },
  { id: 'invoice', label: 'Invoice', icon: '📄' },
];
