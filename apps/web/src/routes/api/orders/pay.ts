import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { payDraftCashHandler } from '../../../server/pos'

const schema = z.object({ orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), idempotencyKey: z.string().uuid(), deviceId: z.string().min(8).max(100), receivedAmount: z.number().int().nonnegative(), discount: z.object({ type: z.enum(['percent', 'fixed']), value: z.number().int().nonnegative(), reason: z.string().min(3).max(250) }).optional(), completeKds: z.boolean().optional() })

export const Route = createFileRoute('/api/orders/pay')({ server: { handlers: { POST: pay } } })

async function pay({ request }: { request: Request }) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Dữ liệu thanh toán không hợp lệ.', issues: parsed.error.issues }, { status: 400 })
  try { return Response.json(await payDraftCashHandler(request, parsed.data)) }
  catch (error) { if (error instanceof Response) return error; return Response.json({ message: 'Không thể thanh toán đơn mở.' }, { status: 500 }) }
}