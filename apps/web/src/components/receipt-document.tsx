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
        'receipt-document mx-auto w-full max-w-[320px] bg-white text-[#111827] px-3.5 py-3 text-[11.5px] leading-tight select-text box-border',
        className,
      )}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        backgroundColor: '#ffffff',
        color: '#111827',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', paddingBottom: '4px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.025em', textTransform: 'uppercase', color: '#111827' }}>
          ☕ TOMNY COFFEE
        </div>
        <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '2px' }}>
          Cà Phê Nguyên Chất & Trà Thủ Công
        </div>
        <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '2px' }}>
          123 Nguyễn Thị Minh Khai, Q.1, TP.HCM
        </div>
        <div style={{ fontSize: '9.5px', color: '#6b7280' }}>
          Hotline: 0901 234 567 · WiFi: TomnyCoffee
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #9ca3af', margin: '7px 0' }} />

      {/* Order Title */}
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '12.5px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#111827', margin: '2px 0' }}>
        HÓA ĐƠN THANH TOÁN
      </div>

      {/* Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '10.5px', color: '#374151', margin: '5px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
          <span style={{ color: '#6b7280', flexShrink: 0 }}>Số HĐ:</span>
          <span style={{ fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>{order.orderCode}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', textAlign: 'right', overflow: 'hidden' }}>
          <span style={{ color: '#6b7280', flexShrink: 0 }}>Ngày:</span>
          <span style={{ fontWeight: 500, color: '#1f2937' }}>{formattedDate}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
          <span style={{ color: '#6b7280', flexShrink: 0 }}>Thu ngân:</span>
          <span style={{ fontWeight: 500, color: '#1f2937' }}>{order.cashier || 'Thu ngân'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', textAlign: 'right', overflow: 'hidden' }}>
          <span style={{ color: '#6b7280', flexShrink: 0 }}>Phục vụ:</span>
          <span style={{ fontWeight: 700, color: '#111827' }}>{diningTypeLabel}</span>
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #9ca3af', margin: '7px 0' }} />

      {/* Items Table */}
      <div style={{ width: '100%', margin: '3px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #d1d5db', fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>
          <div style={{ flex: 1, textAlign: 'left' }}>Tên món</div>
          <div style={{ width: '26px', textAlign: 'center' }}>SL</div>
          <div style={{ width: '56px', textAlign: 'right' }}>Đ.Giá</div>
          <div style={{ width: '64px', textAlign: 'right' }}>T.Tiền</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {order.items.map((item, idx) => (
            <div key={item.id ?? idx} style={{ padding: '4px 0', borderBottom: idx < order.items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, paddingRight: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '11px', color: '#111827', wordBreak: 'break-word' }}>
                    {item.name}
                    {item.variantName && item.variantName !== 'Tiêu chuẩn' ? ` (${item.variantName})` : ''}
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div style={{ fontSize: '9.5px', color: '#6b7280', paddingLeft: '4px', marginTop: '1px' }}>
                      {item.modifiers.map((mod, modIdx) => (
                        <span key={mod.id ?? modIdx} style={{ marginRight: '6px' }}>
                          + {mod.name}{mod.priceDelta ? ` (${formatMoney(mod.priceDelta)})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div style={{ fontSize: '9.5px', fontStyle: 'italic', color: '#6b7280', paddingLeft: '4px', marginTop: '1px' }}>
                      Ghi chú: {item.notes}
                    </div>
                  )}
                </div>
                <div style={{ width: '26px', textAlign: 'center', fontWeight: 700, fontSize: '11px', color: '#111827', flexShrink: 0 }}>
                  {item.quantity}
                </div>
                <div style={{ width: '56px', textAlign: 'right', fontSize: '10.5px', color: '#4b5563', flexShrink: 0 }}>
                  {formatMoney(item.unitPrice)}
                </div>
                <div style={{ width: '64px', textAlign: 'right', fontWeight: 700, fontSize: '11px', color: '#111827', flexShrink: 0 }}>
                  {formatMoney(item.totalPrice)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #9ca3af', margin: '7px 0' }} />

      {/* Calculations & Totals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5px', fontSize: '11px', margin: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#374151' }}>
          <span>Tiền hàng:</span>
          <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(order.subtotal)}</span>
        </div>

        {Boolean(order.discountAmount && order.discountAmount > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#374151' }}>
            <span>Giảm giá{order.discountReason ? ` (${order.discountReason})` : ''}:</span>
            <span style={{ fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>-{formatMoney(order.discountAmount || 0)}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid #d1d5db', margin: '2px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '1px' }}>
          <span style={{ fontWeight: 800, fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.025em', color: '#111827' }}>
            TỔNG CỘNG:
          </span>
          <span style={{ fontSize: '15px', fontWeight: 900, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(order.total)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', paddingTop: '1px', color: '#4b5563' }}>
          <span>Hình thức:</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>{order.paymentMethod || 'Tiền mặt'}</span>
        </div>

        {order.receivedAmount !== undefined && order.receivedAmount > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#4b5563' }}>
              <span>Khách đưa:</span>
              <span style={{ fontWeight: 500, color: '#1f2937', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(order.receivedAmount)}</span>
            </div>
            {order.changeAmount !== undefined && order.changeAmount >= 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#4b5563' }}>
                <span>Tiền trả lại:</span>
                <span style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(order.changeAmount)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dashed Line */}
      <div style={{ borderTop: '1px dashed #9ca3af', margin: '7px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: '2px', paddingBottom: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div style={{ fontWeight: 700, fontSize: '10.5px', fontStyle: 'italic', color: '#1f2937' }}>
          Cảm ơn Quý khách & Hẹn gặp lại!
        </div>
        <div style={{ fontSize: '9.5px', color: '#6b7280' }}>
          Giờ mở cửa: 07:00 - 22:30 hàng ngày
        </div>
        <div style={{ fontSize: '8.5px', color: '#9ca3af', marginTop: '1px' }}>
          * Quý khách vui lòng kiểm tra lại hóa đơn và tiền thừa *
        </div>
      </div>
    </div>
  )
}

