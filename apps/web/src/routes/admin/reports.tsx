import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell, ReportsWorkspace, type ReportData } from '../admin'
import { exportPdf, exportXlsx } from '../../lib/report-export'

export const Route = createFileRoute('/admin/reports')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'reports'),
  component: ReportsAdminPage,
})

function ReportsAdminPage() {
  return (
    <AdminPageShell
      title="Báo Cáo & Phân Tích Hoạt Động"
      subtitle="Tổng hợp doanh thu bán hàng, chi tiền mua nguyên vật liệu, tiền lời thực tế và cơ cấu thực đơn."
    >
      <ReportsWorkspace
        onExportExcel={(data: ReportData) => void exportXlsx(data)}
        onExportPdf={(data: ReportData) => void exportPdf(data)}
      />
    </AdminPageShell>
  )
}
