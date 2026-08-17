import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { requireAdminAccess } from '../../server/admin-access'
import { AdminOverview } from '../../components/admin-overview'
import { getFloorPlan, type ReportData } from '../admin'

export const Route = createFileRoute('/admin/')({
  beforeLoad: ({ location }) => requireAdminAccess(location, 'overview'),
  component: AdminHubPage,
})

function AdminHubPage() {
  const floorPlan = useQuery({ queryKey: ['floor-plan'], queryFn: getFloorPlan })
  const reportQuery = useQuery({
    queryKey: ['reports-today'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const response = await fetch(`/api/reports?from=${today}&to=${today}`)
      const body = (await response.json().catch(() => ({}))) as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'Không tải được báo cáo.')
      return body as ReportData
    },
  })

  return (
    <div className="admin-screen min-h-screen w-full min-w-0 max-w-full overflow-x-hidden">
      <main className="admin-main max-w-7xl mx-auto w-full min-w-0 max-w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-28 sm:pb-24 overflow-x-hidden">
        <AdminOverview report={reportQuery.data} floor={floorPlan.data} />
        {reportQuery.isError && (
          <p className="floor-feedback is-error mt-4">{reportQuery.error.message}</p>
        )}
      </main>
    </div>
  )
}

