type ReportData = {
  from: string
  to: string
  summary: { orderCount: number; revenue: number; discounts: number; cogs: number; grossMargin: number; averageOrder: number }
  topItems: Array<{ name: string; variant: string; quantity: number; revenue: number }>
  orders: Array<Record<string, unknown>>
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportXlsx(data: ReportData) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('Tổng hợp')
  summary.addRows([
    ['Khoảng ngày', `${data.from} → ${data.to}`],
    ['Doanh thu tiền mặt', data.summary.revenue],
    ['Số đơn', data.summary.orderCount],
    ['Giá trị trung bình', data.summary.averageOrder],
    ['Giảm giá', data.summary.discounts],
    ['COGS', data.summary.cogs],
    ['Biên gộp', data.summary.grossMargin],
  ])
  const top = workbook.addWorksheet('Top món')
  top.addRow(['Món', 'Variant', 'Số lượng', 'Doanh thu'])
  data.topItems.forEach((item) => top.addRow([item.name, item.variant, item.quantity, item.revenue]))
  const orders = workbook.addWorksheet('Đơn hàng')
  orders.addRow(['Mã đơn', 'Nguồn', 'Trạng thái', 'Tổng tiền', 'Giảm giá', 'Thu ngân', 'Bàn', 'Thời điểm'])
  data.orders.forEach((order) => orders.addRow([order.orderCode, order.source, order.status, order.total, order.discountAmount, order.cashier, order.tableName, new Date(Number(order.createdAt)).toISOString()]))
  for (const sheet of [summary, top, orders]) {
    sheet.getRow(1).font = { bold: true }
    sheet.columns.forEach((column: { width?: number }) => { column.width = Math.max(column.width ?? 10, 16) })
  }
  const buffer = await workbook.xlsx.writeBuffer()
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `tomny-bao-cao-${data.from}-${data.to}.xlsx`)
}

export async function exportPdf(data: ReportData) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default
  const fonts = (await import('pdfmake/build/vfs_fonts')).default
  pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? {}
  pdfMake.createPdf({
    content: [
      { text: 'TOMNY COFFEE · BÁO CÁO VẬN HÀNH', style: 'header' },
      { text: `${data.from} → ${data.to}`, margin: [0, 0, 0, 16] },
      { table: { widths: ['*', 'auto'], body: [['Doanh thu tiền mặt', `${data.summary.revenue.toLocaleString('vi-VN')}₫`], ['Số đơn', String(data.summary.orderCount)], ['Giá trị trung bình', `${data.summary.averageOrder.toLocaleString('vi-VN')}₫`], ['Giảm giá', `${data.summary.discounts.toLocaleString('vi-VN')}₫`], ['COGS', `${data.summary.cogs.toLocaleString('vi-VN')}₫`], ['Biên gộp', `${data.summary.grossMargin.toLocaleString('vi-VN')}₫`]] } },
      { text: 'Top món', style: 'section' },
      { table: { headerRows: 1, widths: ['*', 'auto', 'auto'], body: [['Món', 'Số lượng', 'Doanh thu'], ...data.topItems.slice(0, 20).map((item) => [`${item.name} · ${item.variant}`, String(item.quantity), `${item.revenue.toLocaleString('vi-VN')}₫`])] } },
    ],
    styles: { header: { fontSize: 16, bold: true, color: '#2B1D17' }, section: { fontSize: 13, bold: true, margin: [0, 18, 0, 8] } },
    defaultStyle: { fontSize: 10 },
  }, undefined, undefined, undefined).download(`tomny-bao-cao-${data.from}-${data.to}.pdf`)
}
