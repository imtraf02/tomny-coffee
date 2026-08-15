import { openDB } from 'idb'

export type PendingCheckout = { idempotencyKey: string; createdAt: number; payload: Record<string, unknown>; attempts: number; lastError?: string }
const database = openDB('tomny-pos', 1, { upgrade(db) { db.createObjectStore('outbox', { keyPath: 'idempotencyKey' }) } })

export function deviceId() {
  const key = 'tomny-device-id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const value = crypto.randomUUID()
  localStorage.setItem(key, value)
  return value
}

export async function enqueueCheckout(payload: Record<string, unknown>) {
  const item: PendingCheckout = { idempotencyKey: String(payload.idempotencyKey), payload, createdAt: Date.now(), attempts: 0 }
  await (await database).put('outbox', item)
}

export async function pendingCheckouts() { return (await database).getAll('outbox') as Promise<PendingCheckout[]> }

export async function syncOutbox() {
  const db = await database
  const pending = await pendingCheckouts()
  for (const item of pending.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const response = await fetch('/api/orders/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item.payload) })
      if (response.ok) { await db.delete('outbox', item.idempotencyKey); continue }
      const body = await response.json().catch(() => ({ message: 'Không thể đồng bộ đơn này.' })) as { message?: string }
      await db.put('outbox', { ...item, attempts: item.attempts + 1, lastError: body.message ?? 'Không thể đồng bộ đơn này.' })
      break
    } catch { await db.put('outbox', { ...item, attempts: item.attempts + 1, lastError: 'Chưa có kết nối mạng.' }); break }
  }
  return pendingCheckouts()
}
