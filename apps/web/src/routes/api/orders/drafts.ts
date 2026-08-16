import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getCurrentUser, requirePermission } from '../../../server/auth'
import { addLine, cancelDraft, createDraft, listDrafts, mergeDrafts, moveDraft, splitDraft, updateNote, voidLine } from '../../../server/order-service'

const entityId = z.string().trim().min(1).max(120)
const selection = z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive().max(99).default(1), modifierIds: z.array(z.string().uuid()).max(20).default([]) })
const createSchema = z.object({ action: z.literal('create'), source: z.enum(['table', 'counter', 'takeaway']).default('table'), tableId: entityId.optional(), note: z.string().max(500).default(''), lines: z.array(selection).max(20).default([]), idempotencyKey: z.string().uuid() })
const addSchema = z.object({ action: z.literal('addLine'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), line: selection })
const voidSchema = z.object({ action: z.literal('voidLine'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), lineId: z.string().uuid(), quantity: z.number().int().positive().optional(), reason: z.string().trim().min(3).max(250) })
const noteSchema = z.object({ action: z.literal('updateNote'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), note: z.string().max(500) })
const moveSchema = z.object({ action: z.literal('move'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), tableId: entityId })
const cancelSchema = z.object({ action: z.literal('cancel'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), reason: z.string().trim().min(3).max(250) })
const splitSchema = z.object({ action: z.literal('split'), orderId: z.string().uuid(), expectedVersion: z.number().int().positive(), newIdempotencyKey: z.string().uuid(), lines: z.array(z.object({ lineId: z.string().uuid(), quantity: z.number().int().positive() })).min(1) })
const mergeSchema = z.object({ action: z.literal('merge'), sourceOrderId: z.string().uuid(), sourceVersion: z.number().int().positive(), targetOrderId: z.string().uuid(), targetVersion: z.number().int().positive() })
const inputSchema = z.discriminatedUnion('action', [createSchema, addSchema, voidSchema, noteSchema, moveSchema, cancelSchema, splitSchema, mergeSchema])

export const Route = createFileRoute('/api/orders/drafts')({ server: { handlers: { GET: listDraftsHandler, POST: mutateDrafts } } })

async function listDraftsHandler({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'pos.read')
  const tableId = new URL(request.url).searchParams.get('tableId')
  return Response.json({ orders: await listDrafts(env.DB, tableId) })
}

async function mutateDrafts({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'pos.checkout')
  const parsed = inputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: 'Dữ liệu ticket không hợp lệ.', issues: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  const db = env.DB
  try {
    switch (input.action) {
      case 'create':
        return Response.json(await createDraft(db, actor, input), { status: 201 })
      case 'addLine':
        return Response.json(await addLine(db, actor, input))
      case 'voidLine':
        return Response.json(await voidLine(db, actor, input))
      case 'updateNote':
        return Response.json(await updateNote(db, actor, input))
      case 'move':
        return Response.json(await moveDraft(db, actor, input))
      case 'cancel':
        requirePermission(actor, 'pos.cancel')
        return Response.json(await cancelDraft(db, actor, input))
      case 'split':
        return Response.json(await splitDraft(db, actor, input))
      case 'merge':
        return Response.json(await mergeDrafts(db, actor, input))
    }
  } catch (error) {
    if (error instanceof Response) return error
    console.error(JSON.stringify({ event: 'draft_mutation_failed', error: error instanceof Error ? error.message : String(error) }))
    return Response.json({ message: 'Không thể cập nhật ticket. Tải lại rồi thử lại.' }, { status: 409 })
  }
}