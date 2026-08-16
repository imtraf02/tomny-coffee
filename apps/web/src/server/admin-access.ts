import { redirect } from '@tanstack/react-router'
import { readSession } from './session'

export const adminSections = ['overview', 'menu', 'inventory', 'tables', 'orders', 'staff', 'reports', 'audit'] as const
export type AdminRouteSection = typeof adminSections[number]

const requiredPermission: Record<AdminRouteSection, string> = {
  overview: 'reports.read',
  menu: 'menu.read',
  inventory: 'inventory.read',
  tables: 'floor_plan.read',
  orders: 'orders.read',
  staff: 'staff.read',
  reports: 'reports.read',
  audit: 'audit.read',
}

export const adminPaths: Record<AdminRouteSection, string> = {
  overview: '/admin',
  menu: '/admin/menu',
  inventory: '/admin/inventory',
  tables: '/admin/tables',
  orders: '/admin/orders',
  staff: '/admin/staff',
  reports: '/admin/reports',
  audit: '/admin/audit',
}

export function canAccessAdminSection(permissions: string[], section: AdminRouteSection) {
  return permissions.includes(requiredPermission[section])
}

function firstAllowedPath(permissions: string[]) {
  const section = adminSections.find((item) => canAccessAdminSection(permissions, item))
  return section ? adminPaths[section] : '/pos'
}

export async function requireAdminAccess(location: { pathname: string }, section?: AdminRouteSection) {
  const user = await readSession()
  if (!user) throw redirect({ to: '/login', search: { next: location.pathname } })
  if (!adminSections.some((item) => canAccessAdminSection(user.permissions, item))) throw redirect({ to: user.permissions.includes('kds.read') ? '/kds' : '/pos' })
  if (section && !canAccessAdminSection(user.permissions, section)) throw redirect({ to: firstAllowedPath(user.permissions) })
  return { user }
}
