import { createFileRoute } from '@tanstack/react-router'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminPageShell } from '../admin'
import { CatalogManager } from '../../components/catalog-manager'

export const Route = createFileRoute('/admin/menu')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'menu'),
  component: MenuAdminPage,
})

function MenuAdminPage() {
  const { user } = Route.useRouteContext()
  const canManage = user?.permissions.includes('menu.manage') ?? false

  return (
    <AdminPageShell
      title="Sản Phẩm & Menu"
      subtitle="Quản lý danh mục món, các phân loại kích cỡ, giá bán và nhóm topping."
    >
      <CatalogManager canManage={canManage} />
    </AdminPageShell>
  )
}
