import { env } from 'cloudflare:workers'
import { payDraftCash, type CashPayInput } from './order-service'
import { getCurrentUser, requirePermission } from './auth'

export async function payDraftCashHandler(request: Request, input: CashPayInput) {
  const actor = requirePermission(await getCurrentUser(request), 'pos.checkout')
  if (input.discount) requirePermission(actor, 'pos.discount')
  return payDraftCash(env.DB, actor, input)
}

/** Kept as a clear API failure for older offline clients. A sale must first be a persisted draft. */
export async function checkoutCash(_request: Request, _input: unknown) {
  throw new Response('Phiên bản POS này cần tạo ticket trước khi thanh toán. Tải lại trang rồi thử lại.', { status: 409 })
}