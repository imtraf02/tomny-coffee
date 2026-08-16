export async function writeAudit(db: D1Database, actorId: string | null, entityType: string, entityId: string, action: string, detail: unknown) {
  await db.prepare('INSERT INTO audit_logs (id, actor_id, entity_type, entity_id, action, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), actorId, entityType, entityId, action, JSON.stringify(detail), Date.now()).run()
}