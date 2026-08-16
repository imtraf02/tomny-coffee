import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getCurrentUser, requirePermission } from '../../server/auth'

export const Route = createFileRoute('/api/audit')({ server: { handlers: { GET: listAudit } } })

async function listAudit({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'audit.read')
  const rows = await env.DB.prepare(`SELECT a.id, a.entity_type AS entityType, a.entity_id AS entityId, a.action, a.detail_json AS detailJson, a.created_at AS createdAt, u.display_name AS actorName FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 500`).all()
  return Response.json({ rows: rows.results.map((row) => ({ ...row, actorEmail: (row as { actorName?: string | null }).actorName ?? 'Hệ thống', detail: (row as { detailJson?: string }).detailJson ?? '{}' })) })
}
