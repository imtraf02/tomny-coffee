import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { checkoutCash } from '../../../server/pos'

const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid(), orderCode: z.string().min(6).max(80), deviceId: z.string().min(8).max(100), source: z.enum(['counter', 'takeaway', 'table']), tableId: z.string().uuid().optional(), note: z.string().max(500).optional(), receivedAmount: z.number().int().nonnegative(),
  lines: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1), variant: z.string().min(1), unitPrice: z.number().int().nonnegative(), quantity: z.number().int().positive(), recipeSnapshot: z.unknown().optional() })).min(1),
  discount: z.object({ type: z.enum(['percent', 'fixed']), value: z.number().int().nonnegative(), reason: z.string().min(3).max(250) }).optional(),
}).superRefine((order, ctx) => {
  if (order.source === 'table' && !order.tableId) ctx.addIssue({ code: 'custom', path: ['tableId'], message: 'Đơn tại bàn cần chọn bàn.' })
  if (order.source !== 'table' && order.tableId) ctx.addIssue({ code: 'custom', path: ['tableId'], message: 'Chỉ đơn tại bàn mới có mã bàn.' })
})

export const Route = createFileRoute('/api/orders/checkout')({
  server: { handlers: { POST: checkout } },
})

async function checkout({ request }: { request: Request }) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Dữ liệu đơn hàng không hợp lệ.', issues: parsed.error.issues }, { status: 400 })
  try { return Response.json(await checkoutCash(request, parsed.data)) }
  catch (error) {
    if (error instanceof Response) return error
    console.error(JSON.stringify({ event: 'checkout_failed', error: error instanceof Error ? error.message : String(error) }))
    return Response.json({ message: 'Không thể ghi nhận đơn hàng. Thử lại hoặc kiểm tra kết nối.' }, { status: 500 })
  }
}
