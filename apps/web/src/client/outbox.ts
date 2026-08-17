import { openDB, type IDBPDatabase } from 'idb'

export type PendingCheckout = { idempotencyKey: string; createdAt: number; payload: Record<string, unknown>; attempts: number; lastError?: string }
export type CatalogVariant = { id: string; name: string; price: number; active: boolean; sortOrder: number; updatedAt: number; modifierGroupIds?: string[] }
export type CatalogModifier = { id: string; name: string; priceDelta: number; active: boolean; sortOrder: number; updatedAt: number }
export type CatalogModifierGroup = { id: string; name: string; minSelections: number; maxSelections: number; active: boolean; sortOrder: number; updatedAt: number; modifiers: CatalogModifier[] }
export type CatalogCombo = { id: string; menuItemId: string; price: number; active: boolean; components: { variantId: string; quantity: number }[] }
export type CatalogProduct = { id: string; categoryId: string; name: string; description: string; imageKey: string | null; active: boolean; kind?: 'standard' | 'combo'; sortOrder?: number; createdAt: number; updatedAt: number; variants: CatalogVariant[] }
export type CatalogCategory = { id: string; name: string; sortOrder: number; active: boolean; updatedAt: number }
export type CachedCatalog = { id: 'active'; cachedAt: number; categories: CatalogCategory[]; products: CatalogProduct[]; modifierGroups?: CatalogModifierGroup[]; combos?: CatalogCombo[] }

let databasePromise: Promise<IDBPDatabase> | null = null

function getDatabase() {
  if (typeof indexedDB === 'undefined') return null
  databasePromise ??= openDB('tomny-pos', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'idempotencyKey' })
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog', { keyPath: 'id' })
    },
  })
  return databasePromise
}

export function deviceId() {
  if (typeof localStorage !== 'undefined') {
    const key = 'tomny-device-id'
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const value = crypto.randomUUID()
    localStorage.setItem(key, value)
    return value
  }
  return crypto.randomUUID()
}

export async function enqueueCheckout(payload: Record<string, unknown>) {
  const database = getDatabase()
  if (!database) return
  const item: PendingCheckout = { idempotencyKey: String(payload.idempotencyKey), payload, createdAt: Date.now(), attempts: 0 }
  await (await database).put('outbox', item)
}

export async function pendingCheckouts(): Promise<PendingCheckout[]> {
  const database = getDatabase()
  if (!database) return []
  return (await database).getAll('outbox') as Promise<PendingCheckout[]>
}

export async function cachedCatalog() {
  const database = getDatabase()
  if (!database) return undefined
  return (await database).get('catalog', 'active') as Promise<CachedCatalog | undefined>
}

export async function cacheCatalog(catalog: Omit<CachedCatalog, 'id' | 'cachedAt'>) {
  const database = getDatabase()
  if (!database) return
  await (await database).put('catalog', { id: 'active', cachedAt: Date.now(), ...catalog } satisfies CachedCatalog)
}

export async function syncOutbox() {
  const database = getDatabase()
  if (!database) return []
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