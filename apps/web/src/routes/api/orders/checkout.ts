import { createFileRoute } from '@tanstack/react-router'
import { checkoutCash } from '../../../server/pos'

export const Route = createFileRoute('/api/orders/checkout')({
  server: { handlers: { POST: checkout } },
})

async function checkout({ request }: { request: Request }) {
  try { return Response.json(await checkoutCash(request, await request.json().catch(() => null))) }
  catch (error) {
    if (error instanceof Response) return error
    console.error(JSON.stringify({ event: 'checkout_failed', error: error instanceof Error ? error.message : String(error) }))
    return Response.json({ message: 'Không thể ghi nhận đơn hàng. Thử lại hoặc kiểm tra kết nối.' }, { status: 500 })
  }
}
