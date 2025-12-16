
Using payment modal component in new order page
The issue is that the payment modal component (PaymentModalEnhanced) exists and is fully implemented, 
but it's not being used in the new order page. The Submit Order button currently creates the order directly without showing the payment modal first.
Solution
I need to make these changes to web-admin/app/dashboard/orders/new/page.tsx:
1. Add Import (line 17)
Add this import after the CustomerPickerModal import:
import { PaymentModalEnhanced } from './components/payment-modal-enhanced';
2. Add State (line 68)
Add this state after customerModalOpen:
const [paymentModalOpen, setPaymentModalOpen] = useState(false);
3. Replace handleSubmit function (lines 189-306)
Replace the current handleSubmit with two functions:
const handleSubmitOrderClick = () => {
  // Validate before showing payment modal
  if (!selectedCustomerId) {
    setError('Please select a customer');
    return;
  }

  if (items.length === 0) {
    setError('Please add at least one item to the order');
    return;
  }

  // Validate customerId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(selectedCustomerId)) {
    console.error('Invalid customer ID format:', selectedCustomerId);
    setError('Invalid customer selected. Please select a customer again.');
    return;
  }

  // Clear any existing errors and show payment modal
  setError('');
  setPaymentModalOpen(true);
};

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
  setError('');

  try {
    // ... existing validation code ...

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
      })),
      isQuickDrop: isQuickDrop || false,
      ...(isQuickDrop && quickDropQuantity > 0 && { quickDropQuantity }),
      express: express || false,
      priority: express ? 'express' : 'normal',
      ...(notes && { customerNotes: notes }),
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

    const res = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // ... existing response handling ...

    // Close payment modal
    setPaymentModalOpen(false);

    // ... existing success handling ...
  } catch (err: any) {
    setError(err.message || 'An error occurred');
    console.error('Order creation error:', err);
  } finally {
    setLoading(false);
  }
};
4. Update onSubmit prop (line 387)
Change from onSubmit={handleSubmit} to onSubmit={handleSubmitOrderClick}
5. Add service categories helper (before return statement)
// Get unique service categories from items for payment modal
const serviceCategories = Array.from(
  new Set(
    items
      .map(item => item.serviceCategoryCode)
      .filter(Boolean)
  )
) as string[];
6. Add Payment Modal Component (after CustomerPickerModal, around line 409)
{/* Payment Modal */}
{currentTenant && (
  <PaymentModalEnhanced
    open={paymentModalOpen}
    onClose={() => setPaymentModalOpen(false)}
    onSubmit={handlePaymentSubmit}
    total={total}
    tenantOrgId={currentTenant.id}
    customerId={selectedCustomerId}
    serviceCategories={serviceCategories}
    loading={loading}
  />
)}
