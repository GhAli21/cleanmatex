/**
 * Small chainable Supabase mock for the label printing config tests. Every builder call is recorded; the
 * awaited result comes from `respond(table, ops)`.
 */
export interface MockOp {
  method: string
  args: unknown[]
}
export interface MockCall {
  table: string
  ops: MockOp[]
}
export type Responder = (table: string, ops: MockOp[]) => { data: unknown; error: { message: string } | null }

export function createSupabaseMock(respond: Responder) {
  const calls: MockCall[] = []
  const rpc = jest.fn()
  const from = (table: string) => {
    const call: MockCall = { table, ops: [] }
    calls.push(call)
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'order', 'insert', 'update', 'delete', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => {
        call.ops.push({ method, args })
        return builder
      }
    }
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(respond(table, call.ops)).then(resolve, reject)
    return builder
  }
  return { client: { from, rpc } as never, calls, rpc }
}

export const hasOp = (ops: MockOp[], method: string, ...args: unknown[]) =>
  ops.some((o) => o.method === method && JSON.stringify(o.args) === JSON.stringify(args))
