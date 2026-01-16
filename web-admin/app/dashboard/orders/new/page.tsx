/**
 * New Order Page - Re-Designed POS Interface
 * PRD-010: Advanced Order Management with category tabs, product grid, and workflow support
 * Re-Design: Modern, touch-friendly Point-of-Sale interface
 */

'use client';
 
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRTL } from '@/lib/hooks/useRTL';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/auth/auth-context';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { cmxMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives/cmx-button';
//import { OrderHeaderNav } from './components/order-header-nav';
import { CategoryTabs } from './components/category-tabs';
import { ProductGrid } from './components/product-grid';
import { OrderSummaryPanel } from './components/order-summary-panel';
import { CustomerPickerModal } from './components/customer-picker-modal';
import { CustomerEditModal } from './components/customer-edit-modal';
import { PaymentModalEnhanced } from './components/payment-modal-enhanced';
import { CategoryTabsSkeleton, ProductGridSkeleton } from './components/loading-skeletons';
import type { Customer } from '@/lib/types/customer';

// Minimal Customer type for order page (matches CustomerPickerModal interface)
interface MinimalCustomer {
  id: string;
  name?: string;
  name2?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string;
  icon?: string;
  color?: string;
}

interface Product {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  service_category_code: string | null;
}

interface PreSubmissionPiece {
  id: string; // Temporary ID: `temp-${itemId}-${pieceSeq}`
  itemId: string;
  pieceSeq: number;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, any>;
}

interface OrderItem {
  productId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  serviceCategoryCode?: string;
  notes?: string;
  pieces?: PreSubmissionPiece[];
}

export default function NewOrderPage() {
  const t = useTranslations('newOrder');
  const tWorkflow = useTranslations('workflow');
  const router = useRouter();
  const isRTL = useRTL();
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  
  // Tenant settings for piece tracking
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');

  // State
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [isQuickDrop, setIsQuickDrop] = useState(false);
  const [quickDropQuantity, setQuickDropQuantity] = useState<number>(0);
  const [express, setExpress] = useState(false);
  const [notes, setNotes] = useState('');
  const [readyByAt, setReadyByAt] = useState<string>('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerEditModalOpen, setCustomerEditModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderStatus, setCreatedOrderStatus] = useState<string | null>(null);
  
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  // Parallel load categories and initial products on mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (!currentTenant) {
        setIsInitialLoading(false);
        return;
      }

      setIsInitialLoading(true);
      setCategoriesLoading(true);
      setProductsLoading(true);

      try {
        // Load categories with retry logic
        const loadCategoriesWithRetry = async (retries = 2): Promise<string | null> => {
          for (let i = 0; i <= retries; i++) {
            try {
              const res = await fetch('/api/v1/categories?enabled=true');
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              }
              const json = await res.json();
              if (json.success && json.data) {
                setCategories(json.data);
                if (json.data.length > 0) {
                  const firstCategory = json.data[0].service_category_code;
                  setSelectedCategory(firstCategory);
                  return firstCategory;
                }
                return null;
              } else {
                throw new Error(json.error || 'Failed to load categories');
              }
            } catch (err) {
              if (i === retries) {
                console.error('Failed to load categories after retries:', err);
                cmxMessage.error(t('errors.failedToLoadCategories') || 'Failed to load categories. Please refresh the page.');
                return null;
              }
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
          return null;
        };

        // Load categories
        const firstCategory = await loadCategoriesWithRetry();
        setCategoriesLoading(false);
        
        if (firstCategory) {
          // Load products for first category with retry logic
          const loadProductsWithRetry = async (retries = 2): Promise<void> => {
            for (let i = 0; i <= retries; i++) {
              try {
                const res = await fetch(`/api/v1/products?category=${firstCategory}&status=active&limit=100`);
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const json = await res.json();
                if (json.success && json.data) {
                  setProducts(json.data);
                  return;
                } else {
                  throw new Error(json.error || 'Failed to load products');
                }
              } catch (err) {
                if (i === retries) {
                  console.error('Failed to load products after retries:', err);
                  cmxMessage.error(t('errors.failedToLoadProducts') || 'Failed to load products. Please try selecting a different category.');
                  return;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
              }
            }
          };
          
          await loadProductsWithRetry();
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        cmxMessage.error(t('errors.failedToLoadData') || 'Failed to load data. Please refresh the page.');
      } finally {
        setProductsLoading(false);
        setIsInitialLoading(false);
      }
    };

    loadInitialData();
  }, [currentTenant, t]);

  // Load products for selected category (when category changes)
  useEffect(() => {
    const loadProducts = async () => {
      if (!selectedCategory || !currentTenant) return;
      
      setProductsLoading(true);
      
      try {
        const res = await fetch(`/api/v1/products?category=${selectedCategory}&status=active&limit=100`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        if (json.success && json.data) {
          setProducts(json.data);
        } else {
          throw new Error(json.error || 'Failed to load products');
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        cmxMessage.error(t('errors.failedToLoadProducts') || `Failed to load products: ${errorMessage}`);
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, [selectedCategory, currentTenant, t]);

  // Debounce items, isQuickDrop, and express for estimateReadyBy
  const debouncedItems = useDebounce(items, 400);
  const debouncedIsQuickDrop = useDebounce(isQuickDrop, 400);
  const debouncedExpress = useDebounce(express, 400);

  // Estimate ready-by when items or settings change (only if items exist)
  useEffect(() => {
    const estimateReadyBy = async () => {
      // Skip if no items or no tenant
      if (!currentTenant || debouncedItems.length === 0) {
        setReadyByAt('');
        return;
      }

      try {
        const res = await fetch('/api/v1/orders/estimate-ready-by', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: debouncedItems.map(item => ({
              serviceCategoryCode: item.serviceCategoryCode,
              quantity: item.quantity,
            })),
            isQuickDrop: debouncedIsQuickDrop,
            express: debouncedExpress,
          }),
        });

        const json = await res.json();
        if (json.success && json.data.readyByAt) {
          setReadyByAt(json.data.readyByAt);
        } else {
          console.error('Failed to estimate ready-by:', json.error);
        }
      } catch (err) {
        console.error('Error estimating ready-by:', err);
        // Don't show error to user for this non-critical feature
      }
    };

    estimateReadyBy();
  }, [debouncedItems, debouncedIsQuickDrop, debouncedExpress, currentTenant]);

  // Calculate total using useMemo for performance
  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  // Helper function to generate pieces for an item
  const generatePiecesForItem = useCallback((itemId: string, quantity: number): PreSubmissionPiece[] => {
    if (!trackByPiece || quantity <= 0) return [];
    
    const pieces: PreSubmissionPiece[] = [];
    for (let i = 1; i <= quantity; i++) {
      pieces.push({
        id: `temp-${itemId}-${i}`,
        itemId,
        pieceSeq: i,
      });
    }
    return pieces;
  }, [trackByPiece]);

  const handleAddItem = useCallback((product: Product) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === product.id);
      const pricePerUnit = express && product.default_express_sell_price
        ? product.default_express_sell_price
        : product.default_sell_price || 0;

      if (existingItem) {
        const newQuantity = existingItem.quantity + 1;
        // If trackByPiece is enabled, add a new piece instead of regenerating all
        let updatedPieces = existingItem.pieces;
        if (trackByPiece) {
          if (existingItem.pieces && existingItem.pieces.length > 0) {
            // Add a new piece to existing pieces
            const maxSeq = Math.max(...existingItem.pieces.map(p => p.pieceSeq));
            const newPiece: PreSubmissionPiece = {
              id: `temp-${product.id}-${maxSeq + 1}`,
              itemId: product.id,
              pieceSeq: maxSeq + 1,
            };
            updatedPieces = [...existingItem.pieces, newPiece];
          } else {
            // Generate all pieces if none exist
            updatedPieces = generatePiecesForItem(product.id, newQuantity);
          }
        }
        return prevItems.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                totalPrice: newQuantity * pricePerUnit,
                pieces: updatedPieces,
              }
            : item
        );
      } else {
        const newItem = {
          productId: product.id,
          quantity: 1,
          pricePerUnit,
          totalPrice: pricePerUnit,
          serviceCategoryCode: product.service_category_code || undefined,
          pieces: trackByPiece ? generatePiecesForItem(product.id, 1) : undefined,
        };
        return [...prevItems, newItem];
      }
    });
  }, [express, trackByPiece, generatePiecesForItem]);

  const handleRemoveItem = useCallback((productId: string) => {
    setItems(prevItems => prevItems.filter(item => item.productId !== productId));
  }, []);

  const handleQuantityChange = useCallback((productId: string, quantity: number) => {
    if (quantity === 0) {
      handleRemoveItem(productId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item => {
        if (item.productId !== productId) return item;
        
        let updatedPieces = item.pieces;
        if (trackByPiece) {
          if (quantity > (item.pieces?.length || 0)) {
            // Quantity increased - add new pieces
            const existingPieces = item.pieces || [];
            const maxSeq = existingPieces.length > 0 
              ? Math.max(...existingPieces.map(p => p.pieceSeq))
              : 0;
            const newPieces: PreSubmissionPiece[] = [];
            for (let i = existingPieces.length + 1; i <= quantity; i++) {
              newPieces.push({
                id: `temp-${productId}-${maxSeq + i - existingPieces.length}`,
                itemId: productId,
                pieceSeq: maxSeq + i - existingPieces.length,
              });
            }
            updatedPieces = [...existingPieces, ...newPieces];
          } else if (quantity < (item.pieces?.length || 0)) {
            // Quantity decreased - remove excess pieces (keep first N pieces)
            updatedPieces = item.pieces?.slice(0, quantity) || [];
            // Re-sequence pieces
            updatedPieces = updatedPieces.map((piece, index) => ({
              ...piece,
              pieceSeq: index + 1,
            }));
          } else if (!item.pieces || item.pieces.length === 0) {
            // No pieces exist - generate them
            updatedPieces = generatePiecesForItem(productId, quantity);
          }
          // If quantity matches existing pieces count, keep existing pieces
        }
        
        return {
          ...item,
          quantity,
          totalPrice: quantity * item.pricePerUnit,
          pieces: updatedPieces,
        };
      })
    );
  }, [handleRemoveItem, trackByPiece, generatePiecesForItem]);

  // Helper functions for piece management
  const updateItemPieces = useCallback((itemId: string, pieces: PreSubmissionPiece[]) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.productId === itemId
          ? { ...item, pieces }
          : item
      )
    );
  }, []);

  const handlePiecesChange = useCallback((itemId: string, pieces: PreSubmissionPiece[]) => {
    updateItemPieces(itemId, pieces);
  }, [updateItemPieces]);

  const handleSubmitOrderClick = useCallback(() => {
    // Validate before showing payment modal
    if (!selectedCustomerId) {
      cmxMessage.error(t('errors.selectCustomer'));
      return;
    }
  
    if (items.length === 0) {
      cmxMessage.error(t('errors.addItems'));
      return;
    }
  
    // Validate customerId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(selectedCustomerId)) {
      console.error('Invalid customer ID format:', selectedCustomerId);
      cmxMessage.error(t('errors.invalidCustomer'));
      return;
    }
  
    // Show payment modal
    setPaymentModalOpen(true);
  }, [selectedCustomerId, items.length, t]);

  const handleOpenEditModal = useCallback(() => {
    if (!selectedCustomerId) return;
    // Open modal immediately - it will handle loading customer data
    setCustomerEditModalOpen(true);
  }, [selectedCustomerId]);

  const handleCustomerUpdateSuccess = useCallback((updatedCustomer: Customer) => {
    // Update customer name display
    const displayName = updatedCustomer.phone 
      ? `${updatedCustomer.phone} - ${updatedCustomer.name || updatedCustomer.name2 || updatedCustomer.displayName || ''}`
      : (updatedCustomer.name || updatedCustomer.name2 || updatedCustomer.displayName || '');
    setCustomerName(displayName);
    setCustomerEditModalOpen(false);
    cmxMessage.success(t('success.customerUpdated') || 'Customer updated successfully');
  }, [t]);
  
  const handlePaymentSubmit = async (paymentData: {
    paymentMethod: string;
    checkNumber?: string;
    percentDiscount: number;
    amountDiscount: number;
    promoCode?: string;
    promoCodeId?: string;
    promoDiscount?: number;
    giftCardNumber?: string;
    giftCardAmount?: number;
    payAllOrders: boolean;
  }) => {
    setLoading(true);

    try {
      // Validate all product IDs are UUIDs
      const invalidProductIds = items.filter(item => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return !uuidRegex.test(item.productId);
      });

      if (invalidProductIds.length > 0) {
        console.error('Invalid product IDs:', invalidProductIds);
        cmxMessage.error(t('errors.invalidProductIds'));
        setLoading(false);
        return;
      }

      // Prepare request body with payment data
      const requestBody = {
        customerId: selectedCustomerId,
        orderTypeId: 'POS',
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          serviceCategoryCode: item.serviceCategoryCode,
          notes: item.notes,
          // Include piece-level data if trackByPiece is enabled and pieces exist
          ...(trackByPiece && item.pieces && item.pieces.length > 0 && {
            pieces: item.pieces.map(piece => ({
              pieceSeq: piece.pieceSeq,
              color: piece.color,
              brand: piece.brand,
              hasStain: piece.hasStain,
              hasDamage: piece.hasDamage,
              notes: piece.notes,
              rackLocation: piece.rackLocation,
              metadata: piece.metadata,
            })),
          }),
        })),
        isQuickDrop: isQuickDrop || false,
        ...(isQuickDrop && quickDropQuantity > 0 && { quickDropQuantity }),
        express: express || false,
        priority: express ? 'express' : 'normal',
        ...(notes && { customerNotes: notes }),
        useOldWfCodeOrNew: !useNewWorkflowSystem, // false = new workflow, true = old workflow
        // Payment data
        paymentMethod: paymentData.paymentMethod,
        ...(paymentData.checkNumber && { checkNumber: paymentData.checkNumber }),
        ...(paymentData.percentDiscount > 0 && { percentDiscount: paymentData.percentDiscount }),
        ...(paymentData.amountDiscount > 0 && { amountDiscount: paymentData.amountDiscount }),
        ...(paymentData.promoCode && {
          promoCode: paymentData.promoCode,
          promoCodeId: paymentData.promoCodeId,
          promoDiscount: paymentData.promoDiscount,
        }),
        ...(paymentData.giftCardNumber && {
          giftCardNumber: paymentData.giftCardNumber,
          giftCardAmount: paymentData.giftCardAmount,
        }),
        payAllOrders: paymentData.payAllOrders,
      };

      console.log('Submitting order with payment:', {
        customerId: selectedCustomerId,
        itemsCount: items.length,
        paymentMethod: paymentData.paymentMethod,
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      console.log('[Jh] handlePaymentSubmit (1) /api/v1/orders: Submitting order with payment')
      
      const res = await fetch('/api/v1/orders', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      console.log('[Jh] handlePaymentSubmit (2) /api/v1/orders: Response status:', res.status, res.statusText, 'ok:', res.ok);
      
      // Check if response is not OK first - handle errors immediately
      if (!res.ok) {
        let errorMessage = '';
        let json: any = {};
        
        try {
          const responseText = await res.text();
          console.log('[Jh] handlePaymentSubmit (3) /api/v1/orders: Response text:', responseText);
          
          if (responseText) {
            try {
              json = JSON.parse(responseText);
              console.log('[Jh] handlePaymentSubmit (4) /api/v1/orders: Parsed JSON:', json);
            } catch (parseError) {
              console.error('[Jh] handlePaymentSubmit: Failed to parse JSON:', parseError);
              // If JSON parse fails, use the raw text or status
              errorMessage = responseText || `Server returned ${res.status} ${res.statusText}`;
            }
          }
        } catch (textError) {
          console.error('[Jh] handlePaymentSubmit: Failed to read response text:', textError);
          errorMessage = `Server returned ${res.status} ${res.statusText}`;
        }
        
        // Extract error message from response
        if (!errorMessage) {
          if (json.error && typeof json.error === 'string') {
            errorMessage = json.error;
          } else if (json.message && typeof json.message === 'string') {
            errorMessage = json.message;
          } else if (typeof json.error === 'object' && json.error !== null) {
            errorMessage = json.error.message || JSON.stringify(json.error);
          }
        }
        
        // Determine error type based on status code
        const isPermissionError = res.status === 403;
        const isValidationError = res.status === 400;
        const isServerError = res.status >= 500;

        // Format permission errors with helpful guidance
        if (isPermissionError) {
          // Extract permission name from error message
          const permissionMatch = errorMessage.match(/Permission denied:\s*([^\s]+)/i);
          const permission = permissionMatch ? permissionMatch[1] : 'orders:create';
          errorMessage = t('errors.permissionDenied', { 
            permission,
            default: `You don't have permission to create orders. Please contact your administrator to grant you the "${permission}" permission.`
          });
        } 
        // Format validation errors with details
        else if (isValidationError) {
          if (json.details && Array.isArray(json.details) && json.details.length > 0) {
            const detailMessages = json.details.map((d: { path?: string; message: string }) =>
              `${d.path ? `${d.path}: ` : ''}${d.message}`
            ).join('; ');
            errorMessage = errorMessage 
              ? `${errorMessage} - ${detailMessages}`
              : detailMessages;
          }
          if (!errorMessage) {
            errorMessage = t('errors.orderCreationFailed') + ' - Validation failed';
          }
        }
        // Format server errors
        else if (isServerError) {
          errorMessage = t('errors.serverError', {
            default: 'A server error occurred. Please try again later or contact support if the problem persists.'
          });
        }
        // Generic error formatting - ensure we always have a message
        else {
          errorMessage = errorMessage || t('errors.orderCreationFailed') || `Request failed with status ${res.status}`;
        }

        console.error('[Jh] handlePaymentSubmit: Order creation failed:', { 
          error: errorMessage, 
          rawError: json.error,
          fullResponse: json, 
          status: res.status,
          statusText: res.statusText,
          isPermissionError,
          isValidationError,
          isServerError
        });
        
        // Show error and keep payment modal open so user can see the error
        cmxMessage.error(errorMessage);
        setLoading(false);
        // Don't close payment modal on error - let user see the error message
        return;
      }

      // If response is OK, parse it normally
      let json: any = {};
      try {
        const responseText = await res.text();
        console.log('[Jh] handlePaymentSubmit (5) /api/v1/orders: Success response text:', responseText);
        json = responseText ? JSON.parse(responseText) : {};
        console.log('[Jh] handlePaymentSubmit (6) /api/v1/orders: Parsed JSON:', json);
      } catch (parseError) {
        console.error('[Jh] handlePaymentSubmit: Failed to parse success response:', parseError);
        cmxMessage.error(t('errors.orderCreationFailed') || 'Failed to parse server response');
        setLoading(false);
        return;
      }

      // Check if response indicates failure even though status is OK
      if (!json.success) {
        const errorMessage = json.error || t('errors.orderCreationFailed') || 'Order creation failed';
        console.error('[Jh] handlePaymentSubmit: Response indicates failure:', json);
        cmxMessage.error(errorMessage);
        setLoading(false);
        return;
      }

      console.log('[Jh] handlePaymentSubmit (7) /api/v1/orders: Order creation successful:', json);

      // Close payment modal only on success
      setPaymentModalOpen(false);

      // Store created order info for navigation
      const orderId = json.data?.id || json.data?.orderId;
      const orderStatus = json.data?.currentStatus || json.data?.status;
      if (orderId) {
        setCreatedOrderId(orderId);
        setCreatedOrderStatus(orderStatus || null);
      }

      // Show success message with optional navigation button
      const orderNo = json.data?.orderNo || json.data?.order_no || '';
      cmxMessage.success(
        tWorkflow('newOrder.orderCreatedSuccess', { orderNo }) || 
        t('success.orderCreated', { orderNo }) || 
        `Order ${orderNo} created successfully`
      );

      // Clear only order-specific data (keep categories and products loaded)
      setItems([]);
      setSelectedCustomerId('');
      setCustomerName('');
      setNotes('');
      setIsQuickDrop(false);
      setQuickDropQuantity(0);
      setExpress(false);
      setReadyByAt('');
    } catch (err: unknown) {
      // Handle network errors, parsing errors, and other exceptions
      const error = err as Error;
      let errorMessage = error.message || t('errors.unknownError');
      
      // Check if it's a network error
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorMessage = t('errors.networkError', {
          default: 'Network error. Please check your internet connection and try again.'
        });
      }
      // Check if it's a timeout error
      else if (error.message.includes('timeout') || error.message.includes('aborted')) {
        errorMessage = t('errors.timeoutError', {
          default: 'Request timed out. Please try again.'
        });
      }
      // Check if it's a permission error (in case it wasn't caught earlier)
      else if (error.message.toLowerCase().includes('permission denied')) {
        const permissionMatch = error.message.match(/Permission denied:\s*([^\s]+)/i);
        const permission = permissionMatch ? permissionMatch[1] : 'orders:create';
        errorMessage = t('errors.permissionDenied', { 
          permission,
          default: `You don't have permission to create orders. Please contact your administrator to grant you the "${permission}" permission.`
        });
      }
      
      cmxMessage.error(errorMessage);
      console.error('Order creation error:', err);
      // Keep payment modal open on error so user can see the error
    } finally {
      setLoading(false);
    }
  };

  // Get unique service categories from items for payment modal (memoized)
  const serviceCategories = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map(item => item.serviceCategoryCode)
          .filter(Boolean)
      )
    ) as string[];
  }, [items]);

  // Memoized callbacks for modals (moved from JSX to fix React hooks rules)
  const handleCustomerModalOpen = useCallback(() => {
    setCustomerModalOpen(true);
  }, []);

  const handleCustomerModalClose = useCallback(() => {
    setCustomerModalOpen(false);
  }, []);

  const handleCustomerEditModalClose = useCallback(() => {
    setCustomerEditModalOpen(false);
  }, []);

  const handlePaymentModalClose = useCallback(() => {
    setPaymentModalOpen(false);
  }, []);

  const handleSelectCustomer = useCallback((customer: MinimalCustomer) => {
    console.log('Selected customer:', customer);
    if (!customer.id) {
      console.error('Customer missing ID:', customer);
      cmxMessage.error(t('errors.invalidCustomer') || 'Invalid customer selected');
      return; 
    }
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.phone ? customer.phone + ' - ' + (customer.name || customer.name2 || customer.displayName || '') : (customer.name || customer.name2 || customer.displayName || ''));
    setCustomerModalOpen(false);
  }, [t]);

  // Get navigation route based on order status
  const getNavigationRoute = useCallback((status: string | null, orderId: string | null): string | null => {
    if (!orderId || !status) return null;
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'preparing' || statusLower === 'intake') {
      return `/dashboard/preparation/${orderId}`;
    }
    if (statusLower === 'processing') {
      return `/dashboard/processing/${orderId}`;
    }
    // Default: go to order detail page
    return `/dashboard/orders/${orderId}`;
  }, []);

  // Get navigation button label based on status
  const getNavigationLabel = useCallback((status: string | null): string => {
    if (!status) return tWorkflow('newOrder.goToOrder') || 'Go to Order';
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'preparing' || statusLower === 'intake') {
      return tWorkflow('newOrder.goToPreparation') || 'Go to Preparation';
    }
    if (statusLower === 'processing') {
      return tWorkflow('newOrder.goToProcessing') || 'Go to Processing';
    }
    return tWorkflow('newOrder.goToOrder') || 'Go to Order';
  }, [tWorkflow]);

  // Handle navigation to workflow screen
  const handleNavigateToOrder = useCallback(() => {
    if (!createdOrderId) return;
    
    const route = getNavigationRoute(createdOrderStatus, createdOrderId);
    if (route) {
      router.push(route);
      // Clear created order state after navigation
      setCreatedOrderId(null);
      setCreatedOrderStatus(null);
    }
  }, [createdOrderId, createdOrderStatus, getNavigationRoute, router]);

  // Memoized order items for OrderSummaryPanel
  const memoizedOrderItems = useMemo(() => 
    items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: item.productId, // Use productId as id for now
        productId: item.productId,
        productName: product?.product_name || 'Unknown Product',
        productName2: product?.product_name2 || undefined,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        totalPrice: item.totalPrice,
        notes: item.notes,
        pieces: item.pieces,
      };
    }), [items, products]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header Navigation - Full Width <OrderHeaderNav />*/}
      {/* <OrderHeaderNav />*/}

      {/* Main Content Area - Three Column Layout */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full flex ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Left/Center Panel - Primary Content Area (Category Tabs + Product Grid) */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* Category Tabs */}
              {categoriesLoading ? (
                <CategoryTabsSkeleton />
              ) : (
                <CategoryTabs
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              )}

              {/* Product Grid */}
              {productsLoading ? (
                <ProductGridSkeleton />
              ) : (
                <ProductGrid
                  products={products}
                  items={items}
                  express={express}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  onQuantityChange={handleQuantityChange}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Fixed/Narrow (Order Summary) */}
          <div className={`w-96 ${isRTL ? 'border-r' : 'border-l'} border-gray-200 bg-white overflow-y-auto flex flex-col`}>
            <OrderSummaryPanel
              customerName={customerName}
              onSelectCustomer={handleCustomerModalOpen}
              onEditCustomer={handleOpenEditModal}
              items={memoizedOrderItems}
              onDeleteItem={(itemId) => handleRemoveItem(itemId)}
              onPiecesChange={handlePiecesChange}
              isQuickDrop={isQuickDrop}
              onQuickDropToggle={setIsQuickDrop}
              quickDropQuantity={quickDropQuantity}
              onQuickDropQuantityChange={setQuickDropQuantity}
              express={express}
              onExpressToggle={setExpress}
              notes={notes}
              onNotesChange={setNotes}
              readyByAt={readyByAt}
              total={total}
              onSubmit={handleSubmitOrderClick}
              loading={loading}
              trackByPiece={trackByPiece}
            />
            
            {/* Post-creation navigation button */}
            {createdOrderId && (
              <div className="p-4 border-t border-gray-200 bg-blue-50">
                <CmxButton
                  onClick={handleNavigateToOrder}
                  className="w-full"
                  variant="default"
                >
                  {getNavigationLabel(createdOrderStatus)}
                </CmxButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        open={customerModalOpen}
        onClose={handleCustomerModalClose}
        onSelectCustomer={handleSelectCustomer}
      />

      {/* Customer Edit Modal */}
      <CustomerEditModal
        open={customerEditModalOpen}
        customerId={selectedCustomerId}
        onClose={handleCustomerEditModalClose}
        onSuccess={handleCustomerUpdateSuccess}
      />
      
      {/* Payment Modal */}
      {currentTenant && (
        <PaymentModalEnhanced
          open={paymentModalOpen}
          onClose={handlePaymentModalClose}
          onSubmit={handlePaymentSubmit}
          total={total}
          tenantOrgId={currentTenant.tenant_id}
          customerId={selectedCustomerId}
          serviceCategories={serviceCategories}
          loading={loading}
        />
      )}
    </div>
  );
}
