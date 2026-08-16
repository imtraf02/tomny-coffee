import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell } from '../admin'
import { InventoryWorkspace } from '../../components/inventory-workspace'

export const Route = createFileRoute('/admin/inventory')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'inventory'),
  component: InventoryAdminPage,
})

function InventoryAdminPage() {
  const { user } = Route.useRouteContext()
  const canManage = user?.permissions.includes('inventory.manage') ?? false

  return (
    <AdminPageShell
      title="Kho & Nguyên Liệu"
      subtitle="Quản lý tồn kho theo lô FIFO, theo dõi ngưỡng an toàn và lập phiếu nhập/xuất kho."
    >
      <InventoryWorkspace canManage={canManage} />
    </AdminPageShell>
  )
}
