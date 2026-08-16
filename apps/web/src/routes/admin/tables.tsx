import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell } from '../admin'
import { TableManagementWorkspace } from '../../components/table-management-workspace'

export const Route = createFileRoute('/admin/tables')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'tables'),
  component: TablesAdminPage,
})

function TablesAdminPage() {
  const { user } = Route.useRouteContext()
  const canManage = user?.permissions.includes('floor_plan.manage') ?? false

  return (
    <AdminPageShell
      title="Sơ Đồ & Danh Sách Bàn"
      subtitle="Quản lý khu vực, bố trí bàn và theo dõi trạng thái phục vụ thời gian thực."
    >
      <TableManagementWorkspace canManage={canManage} />
    </AdminPageShell>
  )
}
