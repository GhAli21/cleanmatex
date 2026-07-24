import { isWorkflowRpcOrderNotFound } from '@/lib/workflow/workflow-context'

describe('workflow-context helpers', () => {
  describe('isWorkflowRpcOrderNotFound', () => {
    it('detects code ORDER_NOT_FOUND', () => {
      expect(
        isWorkflowRpcOrderNotFound({
          ok: false,
          code: 'ORDER_NOT_FOUND',
          error: 'Order not found',
        })
      ).toBe(true)
    })

    it('detects legacy error message', () => {
      expect(isWorkflowRpcOrderNotFound({ error: 'Order not found' })).toBe(true)
    })

    it('returns false for success payloads', () => {
      expect(
        isWorkflowRpcOrderNotFound({
          ok: true,
          template_id: 'f3e242c5-90f9-43d9-a98c-b13dca4d07b7',
          assembly_enabled: false,
        })
      ).toBe(false)
    })
  })
})
