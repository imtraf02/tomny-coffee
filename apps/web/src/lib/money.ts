/**
 * Vietnamese Dong (VND) Currency Formatter
 */
export function formatMoney(amount: number = 0): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))}₫`
}

export function money(amount: number = 0): string {
  return formatMoney(amount)
}
