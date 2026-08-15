import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getCurrentUser, requirePermission } from '../../../server/auth'
import { writeAudit } from '../../../server/audit'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 5 * 1024 * 1024

export const Route = createFileRoute('/api/media/menu-images')({ server: { handlers: { POST: uploadImage, GET: getImage } } })

async function uploadImage({ request }: { request: Request }) {
  const actor = requirePermission(await getCurrentUser(request), 'menu.manage')
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size > maxImageBytes) return Response.json({ message: 'Ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.' }, { status: 400 })
  const extension = file.type.split('/')[1]
  const key = `menu/${crypto.randomUUID()}.${extension}`
  await env.MENU_IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { uploadedBy: actor.id } })
  await writeAudit(actor.id, 'menu_image', key, 'uploaded', { type: file.type, size: file.size })
  return Response.json({ key })
}

async function getImage({ request }: { request: Request }) {
  requirePermission(await getCurrentUser(request), 'menu.read')
  const key = new URL(request.url).searchParams.get('key')
  if (!key || !key.startsWith('menu/')) return new Response('Không tìm thấy ảnh.', { status: 404 })
  const image = await env.MENU_IMAGES.get(key)
  if (!image?.body) return new Response('Không tìm thấy ảnh.', { status: 404 })
  const headers = new Headers()
  image.writeHttpMetadata(headers)
  headers.set('etag', image.httpEtag)
  headers.set('cache-control', 'private, max-age=86400')
  return new Response(image.body, { headers })
}
