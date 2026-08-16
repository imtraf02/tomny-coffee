import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell, AuditWorkspace } from '../admin'

export const Route = createFileRoute('/admin/audit')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'audit'),
  component: AuditAdminPage,
})

function AuditAdminPage() {
  return (
    <AdminPageShell
      title="Nhật Ký Hoạt Động (Audit Log)"
      subtitle="Lưu vết toàn bộ thao tác sửa món, hủy đơn, giảm giá, đổi quyền và điều chỉnh kho."
    >
      <AuditWorkspace />
    </AdminPageShell>
  )
}
