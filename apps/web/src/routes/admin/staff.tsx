import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell, StaffWorkspace } from '../admin'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'staff'),
  component: StaffAdminPage,
})

function StaffAdminPage() {
  const { user } = Route.useRouteContext()
  const canManage = user?.permissions.includes('staff.manage') ?? false

  return (
    <AdminPageShell
      title="Nhân Sự & Phân Quyền"
      subtitle="Quản lý tài khoản nhân viên, gán quyền chi tiết theo phân hệ và theo dõi ca làm việc."
    >
      <StaffWorkspace canManage={canManage} />
    </AdminPageShell>
  )
}
