/**
 * Unit Tests for Customers API Client
 * PRD-003: Customer Management
 */

import {
  fetchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  upgradeCustomerProfile,
  sendOTP,
  verifyOTP,
  createAddress,
  updateAddress,
  deleteAddress,
  mergeCustomers,
  exportCustomers,
} from '@/lib/api/customers'
import type {
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerUpgradeRequest,
} from '@/lib/types/customer'

// Mock fetch globally
global.fetch = jest.fn()

describe('Customers API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fetchCustomers', () => {
    it('should fetch customers with default pagination', async () => {
      const mockResponse = {
        data: [
          {
            id: 'cust-1',
            customer_number: 'CUST-00001',
            first_name: 'Ahmed',
            phone: '+96890123456',
            customer_type: 'stub',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchCustomers()

      expect(fetch).toHaveBeenCalledWith('/api/v1/customers?')
      expect(result.customers).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should fetch customers with search and filters', async () => {
      const mockResponse = {
        data: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchCustomers({
        search: 'Ahmed',
        type: 'stub',
        status: 'active',
        page: 2,
        limit: 10,
      })

      const callUrl = (fetch as jest.Mock).mock.calls[0][0]
      expect(callUrl).toContain('search=Ahmed')
      expect(callUrl).toContain('type=stub')
      expect(callUrl).toContain('status=active')
      expect(callUrl).toContain('page=2')
      expect(callUrl).toContain('limit=10')
    })

    it('should throw error on failed fetch', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch customers' }),
      })

      await expect(fetchCustomers()).rejects.toThrow('Failed to fetch customers')
    })
  })

  describe('getCustomerById', () => {
    it('should fetch customer by ID', async () => {
      const mockCustomer = {
        id: 'cust-1',
        customer_number: 'CUST-00001',
        first_name: 'Ahmed',
        addresses: [],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCustomer }),
      })

      const result = await getCustomerById('cust-1')

      expect(fetch).toHaveBeenCalledWith('/api/v1/customers/cust-1')
      expect(result.id).toBe('cust-1')
    })
  })

  describe('createCustomer', () => {
    it('should create a stub customer', async () => {
      const request: CustomerCreateRequest = {
        first_name: 'Ahmed',
        phone: '+96890123456',
        customer_type: 'stub',
      }

      const mockResponse = {
        id: 'cust-1',
        customer_number: 'CUST-00001',
        ...request,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResponse }),
      })

      const result = await createCustomer(request)

      expect(fetch).toHaveBeenCalledWith('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      expect(result.customer_number).toBe('CUST-00001')
    })

    it('should create a guest customer without phone', async () => {
      const request: CustomerCreateRequest = {
        customer_type: 'guest',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'guest-1', ...request } }),
      })

      const result = await createCustomer(request)

      expect(result.customer_type).toBe('guest')
    })
  })

  describe('updateCustomer', () => {
    it('should update customer profile', async () => {
      const updates: CustomerUpdateRequest = {
        first_name: 'Ahmed',
        last_name: 'Al Balushi',
        email: 'ahmed@example.com',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'cust-1', ...updates } }),
      })

      await updateCustomer('cust-1', updates)

      expect(fetch).toHaveBeenCalledWith('/api/v1/customers/cust-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    })
  })

  describe('upgradeCustomerProfile', () => {
    it('should upgrade stub customer to full profile', async () => {
      const request: CustomerUpgradeRequest = {
        email: 'customer@example.com',
        otpCode: '123456',
        preferences: {
          folding_preference: 'folded',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'cust-1', customer_type: 'full', ...request },
        }),
      })

      const result = await upgradeCustomerProfile('cust-1', request)

      expect(fetch).toHaveBeenCalledWith('/api/v1/customers/cust-1/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      expect(result.customer_type).toBe('full')
    })
  })

  describe('OTP Verification', () => {
    describe('sendOTP', () => {
      it('should send OTP to phone number', async () => {
        const mockResponse = {
          success: true,
          message: 'OTP sent successfully',
          expiresAt: '2025-10-25T12:00:00Z',
          phone: '+96890123456',
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

        const result = await sendOTP({ phone: '+96890123456' })

        expect(fetch).toHaveBeenCalledWith('/api/v1/customers/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+96890123456' }),
        })
        expect(result.success).toBe(true)
      })
    })

    describe('verifyOTP', () => {
      it('should verify valid OTP code', async () => {
        const mockResponse = {
          success: true,
          verified: true,
          token: 'verification-token-123',
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

        const result = await verifyOTP({
          phone: '+96890123456',
          code: '123456',
        })

        expect(result.verified).toBe(true)
        expect(result.token).toBe('verification-token-123')
      })

      it('should handle invalid OTP code', async () => {
        const mockResponse = {
          success: false,
          verified: false,
          message: 'Invalid or expired code',
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => mockResponse,
        })

        const result = await verifyOTP({
          phone: '+96890123456',
          code: '000000',
        })

        expect(result.verified).toBe(false)
      })
    })
  })

  describe('Address Management', () => {
    describe('createAddress', () => {
      it('should create a new address', async () => {
        const request = {
          label: 'Home',
          street_address: 'Building 123, Flat 4',
          area: 'Al Khuwair',
          city: 'Muscat',
          is_default: true,
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'addr-1', ...request } }),
        })

        const result = await createAddress('cust-1', request)

        expect(fetch).toHaveBeenCalledWith('/api/v1/customers/cust-1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        expect(result.label).toBe('Home')
      })
    })

    describe('updateAddress', () => {
      it('should update existing address', async () => {
        const updates = {
          street_address: 'Building 456, Flat 5',
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 'addr-1', ...updates } }),
        })

        await updateAddress('cust-1', 'addr-1', updates)

        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/customers/cust-1/addresses/addr-1',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          }
        )
      })
    })

    describe('deleteAddress', () => {
      it('should delete address', async () => {
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
        })

        await deleteAddress('cust-1', 'addr-1')

        expect(fetch).toHaveBeenCalledWith(
          '/api/v1/customers/cust-1/addresses/addr-1',
          {
            method: 'DELETE',
          }
        )
      })
    })
  })

  describe('Admin Operations', () => {
    describe('mergeCustomers', () => {
      it('should merge duplicate customers', async () => {
        const request = {
          targetCustomerId: 'cust-1',
          sourceCustomerIds: ['cust-2', 'cust-3'],
        }

        const mockResponse = {
          targetCustomer: { id: 'cust-1' },
          ordersMoved: 5,
          loyaltyPointsMerged: 100,
        }

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockResponse }),
        })

        const result = await mergeCustomers(request)

        expect(fetch).toHaveBeenCalledWith('/api/v1/customers/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        expect(result.ordersMoved).toBe(5)
        expect(result.loyaltyPointsMerged).toBe(100)
      })
    })

    describe('exportCustomers', () => {
      it('should export customers to CSV', async () => {
        const mockBlob = new Blob(['CSV data'], { type: 'text/csv' })

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          blob: async () => mockBlob,
        })

        const result = await exportCustomers({
          type: 'full',
          status: 'active',
        })

        const callUrl = (fetch as jest.Mock).mock.calls[0][0]
        expect(callUrl).toContain('/api/v1/customers/export')
        expect(callUrl).toContain('type=full')
        expect(callUrl).toContain('status=active')
        expect(result).toBeInstanceOf(Blob)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(fetchCustomers()).rejects.toThrow('Network error')
    })

    it('should handle API errors with custom messages', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Phone number already exists' }),
      })

      await expect(
        createCustomer({
          first_name: 'Ahmed',
          phone: '+96890123456',
          customer_type: 'stub',
        })
      ).rejects.toThrow('Phone number already exists')
    })
  })
})
