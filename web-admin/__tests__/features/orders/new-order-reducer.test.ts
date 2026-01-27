/**
 * Unit Tests: New Order Reducer
 * Tests for the new order state reducer
 */

import { newOrderReducer, initialState } from '@/src/features/orders/ui/context/new-order-reducer';
import type { NewOrderState, NewOrderAction, OrderItem, MinimalCustomer } from '@/src/features/orders/model/new-order-types';

describe('newOrderReducer', () => {
    describe('SET_CUSTOMER', () => {
        it('should set customer and customer name', () => {
            const customer: MinimalCustomer = {
                id: 'customer-123',
                name: 'John Doe',
                phone: '+1234567890',
            };

            const action: NewOrderAction = {
                type: 'SET_CUSTOMER',
                payload: {
                    customer,
                    customerName: 'John Doe',
                },
            };

            const result = newOrderReducer(initialState, action);

            expect(result.customer).toEqual(customer);
            expect(result.customerName).toBe('John Doe');
        });

        it('should clear customer when set to null', () => {
            const stateWithCustomer: NewOrderState = {
                ...initialState,
                customer: { id: 'customer-123', name: 'John Doe' },
                customerName: 'John Doe',
            };

            const action: NewOrderAction = {
                type: 'SET_CUSTOMER',
                payload: {
                    customer: null,
                    customerName: '',
                },
            };

            const result = newOrderReducer(stateWithCustomer, action);

            expect(result.customer).toBeNull();
            expect(result.customerName).toBe('');
        });
    });

    describe('ADD_ITEM', () => {
        it('should add new item to empty items array', () => {
            const newItem: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const action: NewOrderAction = {
                type: 'ADD_ITEM',
                payload: newItem,
            };

            const result = newOrderReducer(initialState, action);

            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toEqual(newItem);
        });

        it('should increment quantity when adding existing item', () => {
            const existingItem: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const stateWithItem: NewOrderState = {
                ...initialState,
                items: [existingItem],
            };

            const action: NewOrderAction = {
                type: 'ADD_ITEM',
                payload: existingItem,
            };

            const result = newOrderReducer(stateWithItem, action);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].quantity).toBe(2);
            expect(result.items[0].totalPrice).toBe(20.0);
        });
    });

    describe('REMOVE_ITEM', () => {
        it('should remove item by productId', () => {
            const item1: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const item2: OrderItem = {
                productId: 'product-2',
                productName: 'Pants',
                productName2: null,
                quantity: 1,
                pricePerUnit: 20.0,
                totalPrice: 20.0,
                defaultSellPrice: 20.0,
                defaultExpressSellPrice: null,
            };

            const stateWithItems: NewOrderState = {
                ...initialState,
                items: [item1, item2],
            };

            const action: NewOrderAction = {
                type: 'REMOVE_ITEM',
                payload: 'product-1',
            };

            const result = newOrderReducer(stateWithItems, action);

            expect(result.items).toHaveLength(1);
            expect(result.items[0].productId).toBe('product-2');
        });
    });

    describe('UPDATE_ITEM_QUANTITY', () => {
        it('should update item quantity', () => {
            const item: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const stateWithItem: NewOrderState = {
                ...initialState,
                items: [item],
            };

            const action: NewOrderAction = {
                type: 'UPDATE_ITEM_QUANTITY',
                payload: {
                    productId: 'product-1',
                    quantity: 3,
                },
            };

            const result = newOrderReducer(stateWithItem, action);

            expect(result.items[0].quantity).toBe(3);
            expect(result.items[0].totalPrice).toBe(30.0);
        });

        it('should remove item when quantity is set to 0', () => {
            const item: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const stateWithItem: NewOrderState = {
                ...initialState,
                items: [item],
            };

            const action: NewOrderAction = {
                type: 'UPDATE_ITEM_QUANTITY',
                payload: {
                    productId: 'product-1',
                    quantity: 0,
                },
            };

            const result = newOrderReducer(stateWithItem, action);

            expect(result.items).toHaveLength(0);
        });
    });

    describe('UPDATE_ITEM_NOTES', () => {
        it('should update notes for a specific item', () => {
            const item: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 1,
                pricePerUnit: 10.0,
                totalPrice: 10.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: null,
            };

            const stateWithItem: NewOrderState = {
                ...initialState,
                items: [item],
            };

            const action: NewOrderAction = {
                type: 'UPDATE_ITEM_NOTES',
                payload: {
                    productId: 'product-1',
                    notes: 'Handle with care',
                },
            };

            const result = newOrderReducer(stateWithItem, action);

            expect(result.items[0].notes).toBe('Handle with care');
        });
    });

    describe('SET_EXPRESS', () => {
        it('should update express flag and recalculate prices', () => {
            const item: OrderItem = {
                productId: 'product-1',
                productName: 'Shirt',
                productName2: null,
                quantity: 2,
                pricePerUnit: 10.0,
                totalPrice: 20.0,
                defaultSellPrice: 10.0,
                defaultExpressSellPrice: 15.0,
            };

            const stateWithItem: NewOrderState = {
                ...initialState,
                items: [item],
                express: false,
            };

            const action: NewOrderAction = {
                type: 'SET_EXPRESS',
                payload: true,
            };

            const result = newOrderReducer(stateWithItem, action);

            expect(result.express).toBe(true);
            expect(result.items[0].pricePerUnit).toBe(15.0);
            expect(result.items[0].totalPrice).toBe(30.0);
        });
    });

    describe('MODAL_ACTIONS', () => {
        it('should open modal', () => {
            const action: NewOrderAction = {
                type: 'OPEN_MODAL',
                payload: 'customerPicker',
            };

            const result = newOrderReducer(initialState, action);

            expect(result.modals.customerPicker).toBe(true);
        });

        it('should close modal', () => {
            const stateWithOpenModal: NewOrderState = {
                ...initialState,
                modals: {
                    ...initialState.modals,
                    customerPicker: true,
                },
            };

            const action: NewOrderAction = {
                type: 'CLOSE_MODAL',
                payload: 'customerPicker',
            };

            const result = newOrderReducer(stateWithOpenModal, action);

            expect(result.modals.customerPicker).toBe(false);
        });
    });

    describe('RESET_ORDER', () => {
        it('should reset order state but keep categories and products', () => {
            const stateWithData: NewOrderState = {
                ...initialState,
                customer: { id: 'customer-123', name: 'John Doe' },
                customerName: 'John Doe',
                items: [
                    {
                        productId: 'product-1',
                        productName: 'Shirt',
                        productName2: null,
                        quantity: 1,
                        pricePerUnit: 10.0,
                        totalPrice: 10.0,
                        defaultSellPrice: 10.0,
                        defaultExpressSellPrice: null,
                    },
                ],
                categories: [{ service_category_code: 'DC', ctg_name: 'Dry Cleaning', ctg_name2: 'تنظيف جاف' }],
                products: [],
                selectedCategory: 'DC',
            };

            const action: NewOrderAction = {
                type: 'RESET_ORDER',
            };

            const result = newOrderReducer(stateWithData, action);

            expect(result.customer).toBeNull();
            expect(result.customerName).toBe('');
            expect(result.items).toHaveLength(0);
            expect(result.categories).toEqual(stateWithData.categories);
            expect(result.products).toEqual(stateWithData.products);
            expect(result.selectedCategory).toBe('DC');
            expect(result.isInitialLoading).toBe(false);
        });
    });
});

