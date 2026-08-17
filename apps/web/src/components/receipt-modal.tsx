import { useState, useRef } from 'react'
import {
  IconPrinter,
  IconDownload,
  IconPhoto,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { useIsMobile } from '@/lib/use-mobile'
import { Drawer } from '@/components/ui/drawer'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ReceiptDocument, type ReceiptOrderData } from './receipt-document'
import { captureElementToImage } from '@/lib/image-utils'
import { formatMoney } from '@/lib/money'

export interface ReceiptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ReceiptOrderData | null
  title?: string
  description?: string
  successBadge?: boolean
  onNewOrder?: () => void
  customActions?: React.ReactNode
}

export function ReceiptModal({
  open,
  onOpenChange,
  order,
  title = 'Hóa đơn thanh toán',
  description = 'Xem lại chi tiết, in hóa đơn hoặc tải ảnh lưu trữ.',
  successBadge = false,
  onNewOrder,
  customActions,
}: ReceiptModalProps) {
  const isMobile = useIsMobile()
  const mobileReceiptRef = useRef<HTMLDivElement>(null)
  const desktopReceiptRef = useRef<HTMLDivElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [captureSuccess, setCaptureSuccess] = useState(false)

  if (!order) return null

  const handlePrint = () => {
    window.print()
  }

  const handleSaveImage = async () => {
    setIsCapturing(true)
    try {
      const fileName = `HD-${order.orderCode}.png`
      const targetEl = isMobile ? mobileReceiptRef.current : desktopReceiptRef.current
      const dataUrl = await captureElementToImage(
        targetEl || (isMobile ? 'tomny-receipt-document-mobile' : 'tomny-receipt-document-desktop'),
        fileName,
        { download: false, scale: 3 }
      )

      // On mobile devices, check if Web Share API is available to share image file directly
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const parts = dataUrl.split(',')
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
          const bstr = atob(parts[1])
          let n = bstr.length
          const u8arr = new Uint8Array(n)
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
          }
          const blob = new Blob([u8arr], { type: mime })
          const file = new File([blob], fileName, { type: mime })

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Hóa đơn ${order.orderCode}`,
              text: `Hóa đơn Tomny Coffee - ${order.orderCode}`,
            })
            setCaptureSuccess(true)
            setTimeout(() => setCaptureSuccess(false), 2500)
            return
          }
        } catch (shareErr) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return
          }
          console.warn('Web Share fallback to direct download:', shareErr)
        }
      }

      // Safe Blob-based automatic file download
      const { downloadDataUrl } = await import('@/lib/image-utils')
      downloadDataUrl(dataUrl, fileName)
      setCaptureSuccess(true)
      setTimeout(() => setCaptureSuccess(false), 2500)
    } catch (err) {
      console.error('Lỗi xuất ảnh hóa đơn:', err)
    } finally {
      setIsCapturing(false)
    }
  }

  const handleExportPdf = async () => {
    setIsExportingPdf(true)
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default
      const fonts = (await import('pdfmake/build/vfs_fonts')).default
      pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? {}

      const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const itemRows = order.items.map((item) => [
        {
          text: `${item.name}${item.variantName ? ` (${item.variantName})` : ''}${item.modifiers?.length ? `\n+ ${item.modifiers.map((m) => m.name).join(', ')}` : ''}`,
          fontSize: 9,
        },
        { text: String(item.quantity), alignment: 'center', fontSize: 9 },
        { text: formatMoney(item.unitPrice), alignment: 'right', fontSize: 9 },
        { text: formatMoney(item.totalPrice), alignment: 'right', fontSize: 9, bold: true },
      ])

      const docDefinition = {
        pageSize: { width: 226, height: 'auto' }, // 80mm roll width in pt
        pageMargins: [12, 16, 12, 16],
        content: [
          { text: '☕ TOMNY COFFEE', fontSize: 13, bold: true, alignment: 'center' },
          { text: 'Cà phê nguyên chất & Trà thủ công', fontSize: 8, alignment: 'center', margin: [0, 2, 0, 4] },
          { text: '123 Nguyễn Thị Minh Khai, Q.1, TP.HCM', fontSize: 7.5, alignment: 'center', color: '#555555' },
          { text: '--------------------------------------------------', alignment: 'center', margin: [0, 4, 0, 4] },
          { text: 'HÓA ĐƠN THANH TOÁN', fontSize: 10, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
          {
            columns: [
              { text: `Số HĐ: ${order.orderCode}\nThu ngân: ${order.cashier || 'Thu ngân'}`, fontSize: 8 },
              { text: `Ngày: ${formattedDate}\nPhục vụ: ${order.tableName ? `Bàn ${order.tableName}` : 'Tại quầy'}`, fontSize: 8, alignment: 'right' },
            ],
            margin: [0, 0, 0, 6],
          },
          { text: '--------------------------------------------------', alignment: 'center', margin: [0, 2, 0, 4] },
          {
            table: {
              headerRows: 1,
              widths: ['*', 18, 38, 42],
              body: [
                [
                  { text: 'Món', bold: true, fontSize: 8 },
                  { text: 'SL', bold: true, fontSize: 8, alignment: 'center' },
                  { text: 'Đ.Giá', bold: true, fontSize: 8, alignment: 'right' },
                  { text: 'T.Tiền', bold: true, fontSize: 8, alignment: 'right' },
                ],
                ...itemRows,
              ],
            },
            layout: 'noBorders',
            margin: [0, 2, 0, 6],
          },
          { text: '--------------------------------------------------', alignment: 'center', margin: [0, 2, 0, 4] },
          {
            columns: [
              { text: 'Tiền hàng:', fontSize: 8.5 },
              { text: formatMoney(order.subtotal), fontSize: 8.5, alignment: 'right' },
            ],
          },
          order.discountAmount
            ? {
                columns: [
                  { text: `Giảm giá:`, fontSize: 8.5 },
                  { text: `-${formatMoney(order.discountAmount)}`, fontSize: 8.5, alignment: 'right' },
                ],
              }
            : {},
          {
            columns: [
              { text: 'TỔNG CỘNG:', fontSize: 11, bold: true },
              { text: formatMoney(order.total), fontSize: 11, bold: true, alignment: 'right' },
            ],
            margin: [0, 4, 0, 6],
          },
          { text: '--------------------------------------------------', alignment: 'center', margin: [0, 2, 0, 4] },
          { text: 'Cảm ơn Quý khách & Hẹn gặp lại!', fontSize: 8.5, italics: true, alignment: 'center', margin: [0, 4, 0, 2] },
          { text: 'WiFi: TomnyCoffee · Pass: 88888888', fontSize: 7.5, color: '#666666', alignment: 'center' },
        ],
        defaultStyle: { font: 'Roboto' },
      }

      pdfMake.createPdf(docDefinition as any, undefined, undefined, undefined).download(`HD-${order.orderCode}.pdf`)
    } catch (err) {
      console.error('Lỗi xuất PDF hóa đơn:', err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const actionButtons = (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#8c8177] pb-1 border-b border-[#ded1c0]/60">
        Tùy chọn hóa đơn
      </div>

      <Button
        variant="primary"
        size="md"
        onClick={handlePrint}
        className="w-full flex items-center justify-center gap-2 h-10 font-bold shadow-xs"
      >
        <IconPrinter size={18} stroke={2} />
        <span>In hóa đơn (80mm)</span>
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="md"
          onClick={handleSaveImage}
          disabled={isCapturing}
          className="w-full flex items-center justify-center gap-1.5 h-9.5 text-xs bg-white hover:bg-[#faf7f2] font-semibold border-[#ded6cc]"
        >
          {captureSuccess ? (
            <>
              <IconCheck size={16} stroke={2.5} className="text-[var(--moss)]" />
              <span className="text-[var(--moss)] font-bold">Đã lưu ảnh!</span>
            </>
          ) : (
            <>
              <IconPhoto size={16} stroke={1.75} />
              <span>{isCapturing ? 'Đang xuất…' : 'Lưu ảnh (PNG)'}</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="md"
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          className="w-full flex items-center justify-center gap-1.5 h-9.5 text-xs bg-white hover:bg-[#faf7f2] font-semibold border-[#ded6cc]"
        >
          <IconDownload size={16} stroke={1.75} />
          <span>{isExportingPdf ? 'Đang tạo…' : 'Tải file PDF'}</span>
        </Button>
      </div>

      {customActions}

      {onNewOrder && (
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            onOpenChange(false)
            onNewOrder()
          }}
          className="w-full mt-1 h-10 font-bold"
        >
          + Tạo đơn mới
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* On-screen Modal (Drawer on Mobile, Dialog on Desktop) */}
      {isMobile ? (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
          <Drawer.Content direction="bottom" className="w-full max-h-[92dvh] p-0 flex flex-col">
            <Drawer.Header className="px-4 pt-2.5 pb-2 border-b border-[#ede6de] text-left shrink-0">
              {successBadge && (
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[var(--moss)] mb-0.5">
                  <IconCheck size={14} stroke={3} />
                  <span>Thanh toán hoàn tất</span>
                </div>
              )}
              <Drawer.Title className="text-lg font-bold font-display text-[var(--char)] m-0">
                {title}
              </Drawer.Title>
              {description && (
                <Drawer.Description className="text-xs text-[#8c8177] m-0 mt-0.5">
                  {description}
                </Drawer.Description>
              )}
            </Drawer.Header>
            <Drawer.Body className="px-3.5 pt-3 pb-6 overflow-y-auto flex flex-col items-center gap-3">
              {/* Receipt Preview centered */}
              <div className="w-full max-w-[328px] rounded-2xl border border-[#ded1c0] shadow-sm bg-white p-1">
                <ReceiptDocument ref={mobileReceiptRef} order={order} id="tomny-receipt-document-mobile" />
              </div>
              <div className="w-full max-w-[328px]">
                {actionButtons}
              </div>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      ) : (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Viewport className="dialog-viewport">
              <Dialog.Popup className="bg-[#fffdfa] border border-[#e8ded2] rounded-2xl p-6 shadow-2xl w-[680px] max-w-[95vw] max-h-[92vh] overflow-y-auto text-[var(--char)]">
                <div className="flex items-start justify-between pb-3 border-b border-[#ede6de] mb-5">
                  <div>
                    {successBadge && (
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--moss)] mb-0.5">
                        <IconCheck size={16} stroke={3} />
                        <span>Thanh toán hoàn tất</span>
                      </div>
                    )}
                    <Dialog.Title className="text-xl font-bold font-display text-[var(--char)]">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description className="text-xs text-[#8c8177] mt-0.5">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close className="inline-flex size-8 items-center justify-center rounded-lg text-[#8c8177] hover:text-[#1c1512] hover:bg-[#efe3d0]/50 transition-colors">
                    <IconX size={18} />
                  </Dialog.Close>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 items-start justify-center">
                  {/* Left: Thermal Receipt Preview Card */}
                  <div className="w-[320px] shrink-0 rounded-xl overflow-hidden border border-[#ded1c0] shadow-md bg-white">
                    <ReceiptDocument ref={desktopReceiptRef} order={order} id="tomny-receipt-document-desktop" />
                  </div>

                  {/* Right: Action Panel */}
                  <div className="flex-1 w-full sm:w-auto min-w-[220px]">
                    {actionButtons}
                  </div>
                </div>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Dedicated Print Element */}
      <div id="tomny-print-receipt-element" className="hidden print:block">
        <ReceiptDocument order={order} id="tomny-receipt-document-print" />
      </div>
    </>
  )
}
