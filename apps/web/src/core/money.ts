export type Discount = { type: 'percent' | 'fixed'; value: number }

export function calculateDiscount(subtotal: number, discount?: Discount): number {
  if (!discount) return 0
  if (discount.type === 'percent') return Math.min(subtotal, Math.round(subtotal * Math.min(100, Math.max(0, discount.value)) / 100))
  return Math.min(subtotal, Math.max(0, Math.round(discount.value)))
}

export function calculateTotal(subtotal: number, discount?: Discount) {
  const discountAmount = calculateDiscount(subtotal, discount)
  return { subtotal, discountAmount, total: subtotal - discountAmount }
}

export function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}₫`
}
