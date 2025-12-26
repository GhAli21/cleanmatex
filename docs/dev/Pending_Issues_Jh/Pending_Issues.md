
Pending :
================
19-Dec-2025:
- preparation-form.tsx
F:\jhapp\cleanmatex\web-admin\app\dashboard\orders\[id]\prepare\preparation-form.tsx
fix this: line 158:
// TODO: The form uses product_name but API requires productId
      // Need to either lookup product by name or create product first
      // For now, using a temporary UUID - this needs proper implementation
      const orderItems: AddOrderItemInput[] = items.map((item) => ({
        productId: crypto.randomUUID(), // TODO: Replace with actual product lookup

---

- customer-create-modal.tsx
F:\jhapp\cleanmatex\web-admin\app\dashboard\orders\new\components\customer-create-modal.tsx
Add more fields of data

- 
===========
