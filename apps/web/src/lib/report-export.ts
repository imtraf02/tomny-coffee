type ReportData = {
  from: string
  to: string
  summary: {
    orderCount: number
    revenue: number
    discounts: number
    cogs: number
    grossMargin: number
    averageOrder: number
    totalPurchasingCost?: number
    receiptCount?: number
  }
  topItems: Array<{ name: string; variant: string; quantity: number; revenue: number }>
  purchasing?: {
    totalCost: number
    receiptCount: number
    byIngredient: Array<{ ingredientName: string; unit: string; quantity: number; totalCost: number; avgUnitCost: number }>
    movements: Array<{ id: string; ingredientName: string; unit: string; quantity: number; unitCost: number; totalCost: number; reason: string; actorName: string; createdAt: number }>
  }
  orders: Array<Record<string, unknown>>
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportXlsx(data: ReportData) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()

  // 1. Summary Sheet
  const summary = workbook.addWorksheet('Tổng hợp')
  summary.addRows([
    ['Khoảng ngày', `${data.from} → ${data.to}`],
    ['Doanh thu thuần', data.summary.revenue],
    ['Số đơn bán', data.summary.orderCount],
    ['Giá trị trung bình', data.summary.averageOrder],
    ['Giảm giá & Chiết khấu', data.summary.discounts],
    ['Giá vốn bán hàng (COGS)', data.summary.cogs],
    ['Lợi nhuận gộp', data.summary.grossMargin],
    ['Tổng chi tiền nhập hàng', data.summary.totalPurchasingCost ?? 0],
    ['Số phiếu nhập kho', data.summary.receiptCount ?? 0],
  ])

  // 2. Top Selling Items Sheet
  const top = workbook.addWorksheet('Top món bán chạy')
  top.addRow(['Tên món', 'Phiên bản', 'Số lượng', 'Doanh thu'])
  data.topItems.forEach((item) => top.addRow([item.name, item.variant, item.quantity, item.revenue]))

  // 3. Purchasing Goods Expenditure Sheet
  const purchases = workbook.addWorksheet('Chi tiền nhập hàng')
  purchases.addRow(['Thời gian', 'Nguyên liệu', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền', 'Lý do / Nhà cung cấp', 'Người tạo phiếu'])
  ;(data.purchasing?.movements ?? []).forEach((m) => {
    purchases.addRow([
      new Date(m.createdAt).toLocaleString('vi-VN'),
      m.ingredientName,
      m.quantity,
      m.unit,
      m.unitCost,
      m.totalCost,
      m.reason,
      m.actorName,
    ])
  })

  // 4. Orders Sheet
  const orders = workbook.addWorksheet('Đơn hàng')
  orders.addRow(['Mã đơn', 'Nguồn', 'Trạng thái', 'Tổng tiền', 'Giảm giá', 'Thu ngân', 'Bàn', 'Thời điểm'])
  data.orders.forEach((order) =>
    orders.addRow([
      order.orderCode,
      order.source,
      order.status,
      order.total,
      order.discountAmount,
      order.cashier,
      order.tableName,
      new Date(Number(order.createdAt)).toLocaleString('vi-VN'),
    ]),
  )

  for (const sheet of [summary, top, purchases, orders]) {
    sheet.getRow(1).font = { bold: true }
    sheet.columns.forEach((column: { width?: number }) => {
      column.width = Math.max(column.width ?? 10, 18)
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `tomny-bao-cao-${data.from}-${data.to}.xlsx`,
  )
}

export async function exportPdf(data: ReportData) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default
  const fonts = (await import('pdfmake/build/vfs_fonts')).default
  pdfMake.vfs = fonts.pdfMake?.vfs ?? fonts.vfs ?? {}

  const purchasingMovements = (data.purchasing?.movements ?? []).slice(0, 15)

  pdfMake
    .createPdf(
      {
        content: [
          { text: 'TOMNY COFFEE · BÁO CÁO DOANH THU & CHI PHÍ HÀNG HÓA', style: 'header' },
          { text: `Kỳ báo cáo: ${data.from} → ${data.to}`, margin: [0, 0, 0, 16] },
          {
            table: {
              widths: ['*', 'auto'],
              body: [
                ['Doanh thu thuần', `${data.summary.revenue.toLocaleString('vi-VN')}₫`],
                ['Số đơn hoàn tất', String(data.summary.orderCount)],
                ['Giá trị trung bình / đơn', `${data.summary.averageOrder.toLocaleString('vi-VN')}₫`],
                ['Giảm giá & Chiết khấu', `${data.summary.discounts.toLocaleString('vi-VN')}₫`],
                ['Giá vốn hàng bán (COGS)', `${data.summary.cogs.toLocaleString('vi-VN')}₫`],
                ['Lợi nhuận gộp', `${data.summary.grossMargin.toLocaleString('vi-VN')}₫`],
                [
                  'Tổng chi tiền nhập hàng (Purchasing)',
                  `${(data.summary.totalPurchasingCost ?? 0).toLocaleString('vi-VN')}₫`,
                ],
              ],
            },
          },
          { text: 'Top món bán chạy', style: 'section' },
          {
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto'],
              body: [
                ['Món', 'Số lượng', 'Doanh thu'],
                ...data.topItems
                  .slice(0, 15)
                  .map((item) => [
                    `${item.name} · ${item.variant}`,
                    String(item.quantity),
                    `${item.revenue.toLocaleString('vi-VN')}₫`,
                  ]),
              ],
            },
          },
          ...(purchasingMovements.length > 0
            ? [
                { text: 'Chi tiền nhập hàng hóa & nguyên liệu', style: 'section' as const },
                {
                  table: {
                    headerRows: 1,
                    widths: ['auto', '*', 'auto', 'auto'],
                    body: [
                      ['Thời gian', 'Nguyên liệu', 'Số lượng', 'Thành tiền'],
                      ...purchasingMovements.map((m) => [
                        new Date(m.createdAt).toLocaleDateString('vi-VN'),
                        m.ingredientName,
                        `${m.quantity} ${m.unit}`,
                        `${m.totalCost.toLocaleString('vi-VN')}₫`,
                      ]),
                    ],
                  },
                },
              ]
            : []),
        ],
        styles: {
          header: { fontSize: 15, bold: true, color: '#2B1D17' },
          section: { fontSize: 12, bold: true, margin: [0, 16, 0, 6] },
        },
        defaultStyle: { fontSize: 9.5 },
      },
      undefined,
      undefined,
      undefined,
    )
    .download(`tomny-bao-cao-${data.from}-${data.to}.pdf`)
}
