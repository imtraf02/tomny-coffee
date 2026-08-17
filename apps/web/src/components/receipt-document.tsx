import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export interface ReceiptItem {
  id?: string
  name: string
  variantName?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  modifiers?: Array<{ id?: string; name: string; priceDelta?: number }>
  notes?: string
}

export interface ReceiptOrderData {
  orderCode: string
  tableName?: string | null
  source?: 'counter' | 'takeaway' | 'table' | string
  cashier?: string
  createdAt: string | number | Date
  items: ReceiptItem[]
  subtotal: number
  discountAmount?: number
  discountReason?: string
  total: number
  paymentMethod?: string
  receivedAmount?: number
  changeAmount?: number
  note?: string
}

export interface ReceiptDocumentProps {
  order: ReceiptOrderData
  className?: string
  id?: string
}

export function ReceiptDocument({ order, className, id = 'tomny-receipt-document' }: ReceiptDocumentProps) {
  const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const diningTypeLabel =
    order.source === 'takeaway'
      ? 'Mang đi'
      : order.source === 'table' && order.tableName
        ? (order.tableName.startsWith('Bàn') ? order.tableName : `Bàn ${order.tableName}`)
        : 'Tại quầy'

  return (
    <div
      id={id}
      className={cn(
        'receipt-document mx-auto w-[320px] max-w-[320px] shrink-0 bg-white text-black px-3.5 py-3 text-[11.5px] leading-tight font-sans select-text box-border',
        className,
      )}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Brand Header */}
      <div className="text-center pb-0.5">
        <div className="text-[15px] font-extrabold tracking-wide uppercase text-gray-900">☕ TOMNY COFFEE</div>
        <div className="text-[10px] text-gray-600 tracking-normal mt-0.5">Cà Phê Nguyên Chất & Trà Thủ Công</div>
        <div className="text-[9.5px] text-gray-500 mt-0.5">123 Nguyễn Thị Minh Khai, Q.1, TP.HCM</div>
        <div className="text-[9.5px] text-gray-500">Hotline: 0901 234 567 · WiFi: TomnyCoffee</div>
      </div>

      {/* Dashed Line */}
      <div className="border-t border-dashed border-gray-400 my-[7px]" />

      {/* Order Title */}
      <div className="text-center font-extrabold text-[12.5px] tracking-wider uppercase my-0.5 text-gray-900">
        HÓA ĐƠN THANH TOÁN
      </div>

      {/* Metadata: 2-Column Tight Grid (4px gap-y) */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-[4px] text-[10.5px] text-gray-700 my-[5px]">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-gray-500 shrink-0">Số HĐ:</span>
          <span className="font-bold text-gray-900 font-mono truncate">{order.orderCode}</span>
        </div>
        <div className="flex items-center justify-end gap-1 min-w-0 text-right">
          <span className="text-gray-500 shrink-0">Ngày:</span>
          <span className="font-medium text-gray-800 truncate">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-gray-500 shrink-0">Thu ngân:</span>
          <span className="font-medium text-gray-800 truncate">{order.cashier || 'Thu ngân'}</span>
        </div>
        <div className="flex items-center justify-end gap-1 min-w-0 text-right">
          <span className="text-gray-500 shrink-0">Phục vụ:</span>
          <span className="font-bold text-gray-900 truncate">{diningTypeLabel}</span>
        </div>
      </div>

      {/* Dashed Line */}
      <div className="border-t border-dashed border-gray-400 my-[7px]" />

      {/* Items Table */}
      <div className="w-full my-0.5">
        {/* Table Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_26px_58px_66px] gap-1 pb-1 border-b border-gray-300 font-bold text-[10px] text-gray-700">
          <div>Tên món</div>
          <div className="text-center">SL</div>
          <div className="text-right">Đ.Giá</div>
          <div className="text-right">T.Tiền</div>
        </div>

        {/* Item Rows */}
        <div className="flex flex-col divide-y divide-gray-100">
          {order.items.map((item, idx) => (
            <div key={item.id ?? idx} className="py-1 flex flex-col gap-0.5">
              <div className="grid grid-cols-[minmax(0,1fr)_26px_58px_66px] gap-1 items-start">
                <div className="font-semibold text-[11px] leading-snug text-gray-900 break-words pr-1">
                  {item.name}
                  {item.variantName && item.variantName !== 'Tiêu chuẩn' ? ` (${item.variantName})` : ''}
                </div>
                <div className="text-center font-bold text-[11px] tabular-nums text-gray-900">{item.quantity}</div>
                <div className="text-right text-[10.5px] tabular-nums text-gray-600">{formatMoney(item.unitPrice)}</div>
                <div className="text-right font-bold text-[11px] tabular-nums text-gray-900">{formatMoney(item.totalPrice)}</div>
              </div>

              {/* Modifiers / Options */}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="pl-1.5 text-[9.5px] text-gray-500 flex flex-wrap gap-x-1.5 leading-tight">
                  {item.modifiers.map((mod, modIdx) => (
                    <span key={mod.id ?? modIdx}>
                      + {mod.name}
                      {mod.priceDelta ? ` (${formatMoney(mod.priceDelta)})` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Special Note */}
              {item.notes && (
                <div className="pl-1.5 text-[9.5px] italic text-gray-500 leading-tight">
                  Ghi chú: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dashed Line: Fixed small margin, no elastic spacer */}
      <div className="border-t border-dashed border-gray-400 my-[7px]" />

      {/* Calculations & Totals (4px gap-y) */}
      <div className="flex flex-col gap-[4px] text-[11px] my-[5px]">
        <div className="flex justify-between items-center text-gray-700">
          <span>Tiền hàng:</span>
          <span className="tabular-nums font-semibold text-gray-900">{formatMoney(order.subtotal)}</span>
        </div>

        {Boolean(order.discountAmount && order.discountAmount > 0) && (
          <div className="flex justify-between items-center text-gray-700">
            <span>
              Giảm giá{order.discountReason ? ` (${order.discountReason})` : ''}:
            </span>
            <span className="tabular-nums font-bold text-red-600">-{formatMoney(order.discountAmount || 0)}</span>
          </div>
        )}

        <div className="border-t border-gray-300 my-[2px]" />

        <div className="flex justify-between items-baseline pt-0.5">
          <span className="font-extrabold text-[12.5px] uppercase tracking-wide text-gray-900">TỔNG CỘNG:</span>
          <span className="text-[15px] tabular-nums font-black text-gray-900">{formatMoney(order.total)}</span>
        </div>

        <div className="flex justify-between items-center text-[10.5px] pt-0.5 text-gray-700">
          <span>Hình thức:</span>
          <span className="font-semibold text-gray-900">{order.paymentMethod || 'Tiền mặt'}</span>
        </div>

        {order.receivedAmount !== undefined && order.receivedAmount > 0 && (
          <>
            <div className="flex justify-between items-center text-[10.5px] text-gray-600">
              <span>Khách đưa:</span>
              <span className="tabular-nums font-medium text-gray-800">{formatMoney(order.receivedAmount)}</span>
            </div>
            {order.changeAmount !== undefined && order.changeAmount >= 0 && (
              <div className="flex justify-between items-center text-[10.5px] text-gray-600">
                <span>Tiền trả lại:</span>
                <span className="tabular-nums font-bold text-gray-900">{formatMoney(order.changeAmount)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dashed Line */}
      <div className="border-t border-dashed border-gray-400 my-[7px]" />

      {/* Footer: Compact and close-fitting */}
      <div className="text-center pt-0.5 pb-0.5 flex flex-col items-center gap-[2px]">
        <p className="font-bold text-[10.5px] italic text-gray-800">Cảm ơn Quý khách & Hẹn gặp lại!</p>
        <p className="text-[9.5px] text-gray-500">Giờ mở cửa: 07:00 - 22:30 hàng ngày</p>
        <div className="text-[8.5px] text-gray-400 mt-0.5">
          * Quý khách vui lòng kiểm tra lại hóa đơn và tiền thừa *
        </div>
      </div>
    </div>
  )
}
