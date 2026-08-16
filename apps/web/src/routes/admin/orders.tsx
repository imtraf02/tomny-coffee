import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell } from '../admin'
import { OrdersManager } from '../../components/orders-manager'

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'orders'),
  component: OrdersAdminPage,
})

function OrdersAdminPage() {
  const { user } = Route.useRouteContext()
  const canManage = user?.permissions.includes('orders.manage') ?? false

  return (
    <AdminPageShell
      title="Lịch Sử & Quản Lý Đơn Hàng"
      subtitle="Theo dõi toàn bộ đơn hàng POS, chi tiết món, thanh toán và xử lý hoàn/hủy."
    >
      <OrdersManager canManage={canManage} />
    </AdminPageShell>
  )
}
