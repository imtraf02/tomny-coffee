/**
 * Image utilities for Tomny Coffee:
 * - Client-side image validation & auto-compression (reduces multi-MB camera photos to ~200KB)
 * - Zero-latency local blob previews
 * - Element-to-image capture for receipts (like Harmony Wedding)
 */

export interface CompressImageOptions {
  maxDimension?: number
  quality?: number
  mimeType?: 'image/webp' | 'image/jpeg'
}

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

/**
 * Validate image MIME type and file size.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Vui lòng chọn một file ảnh.' }
  }

  const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())
  if (!isAllowedType) {
    return {
      valid: false,
      error: 'Định dạng không hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WebP hoặc AVIF.',
    }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Dung lượng ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.',
    }
  }

  return { valid: true }
}

/**
 * Compresses and scales down an image file on the client before upload.
 * Reduces upload time and storage usage significantly while maintaining crisp visual quality.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const {
    maxDimension = 1200,
    quality = 0.85,
    mimeType = 'image/webp',
  } = options

  // If already small (< 300KB) and correct format, return as-is
  if (file.size < 300 * 1024 && (file.type === 'image/webp' || file.type === 'image/jpeg')) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Scale down if exceeds maxDimension while keeping aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        // Fallback to original file if canvas context is unavailable
        resolve(file)
        return
      }

      // Smooth scaling
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const cleanName = file.name.replace(/\.[^/.]+$/, '') + (mimeType === 'image/webp' ? '.webp' : '.jpg')
          const compressedFile = new File([blob], cleanName, {
            type: mimeType,
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        mimeType,
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // If image loading fails, return original file
      resolve(file)
    }

    img.src = objectUrl
  })
}

/**
 * Creates a local blob URL for instant zero-latency UI preview.
 */
export function createLocalPreview(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Resolves a product image key to its full API endpoint URL.
 */
export function getProductImageUrl(imageKey?: string | null): string | null {
  if (!imageKey) return null
  if (imageKey.startsWith('http://') || imageKey.startsWith('https://') || imageKey.startsWith('data:')) {
    return imageKey
  }
  return `/api/media/menu-images?key=${encodeURIComponent(imageKey)}`
}

/**
 * Converts a base64 Data URL to a Blob and safely triggers a file download in the browser.
 */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  try {
    const parts = dataUrl.split(',')
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
    const bstr = atob(parts[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    const blob = new Blob([u8arr], { type: mime })
    const blobUrl = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.style.position = 'fixed'
    link.style.top = '-9999px'
    link.style.left = '-9999px'
    link.style.display = 'none'
    link.href = blobUrl
    link.download = fileName

    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
      URL.revokeObjectURL(blobUrl)
    }, 1500)
  } catch (err) {
    console.error('Lỗi khi tải file ảnh:', err)
  }
}

/**
 * Captures an HTML element by ID and renders it into a high-res PNG image Data URL,
 * with off-screen clone isolation and safe Blob downloading.
 */
export async function captureElementToImage(
  elementId: string,
  fileName = 'hoa-don-tomny.png',
  options?: { download?: boolean; scale?: number },
): Promise<string> {
  const el = document.getElementById(elementId)
  if (!el) {
    throw new Error(`Element không tồn tại: ${elementId}`)
  }

  const html2canvas = (await import('html2canvas-pro')).default

  const rect = el.getBoundingClientRect()
  const width = Math.max(Math.round(rect.width), 320)
  const height = Math.max(el.scrollHeight, Math.round(rect.height))

  // Create isolated container placed behind the DOM view
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.top = '0'
  wrapper.style.left = '0'
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.style.zIndex = '-99999'
  wrapper.style.overflow = 'hidden'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.backgroundColor = '#ffffff'

  // Clone element for clean rasterization with full opacity and styles
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.position = 'static'
  clone.style.transform = 'none'
  clone.style.transformOrigin = 'top left'
  clone.style.margin = '0'
  clone.style.width = `${width}px`
  clone.style.minWidth = `${width}px`
  clone.style.maxWidth = `${width}px`
  clone.style.height = 'auto'
  clone.style.overflow = 'visible'
  clone.style.opacity = '1'
  clone.style.visibility = 'visible'
  clone.style.boxShadow = 'none'
  clone.style.backgroundColor = '#ffffff'
  clone.style.color = '#111827'

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  // Ensure fonts and rendering are fully painted
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {
      // ignore font loading error
    }
  }
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => setTimeout(r, 120))

  try {
    const canvas = await html2canvas(clone, {
      scale: options?.scale ?? 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      width,
      height: clone.offsetHeight || height,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      logging: false,
      onclone: (_clonedDoc, clonedEl) => {
        clonedEl.style.position = 'static'
        clonedEl.style.transform = 'none'
        clonedEl.style.opacity = '1'
        clonedEl.style.visibility = 'visible'
      },
    })

    const dataUrl = canvas.toDataURL('image/png', 1.0)

    if (options?.download) {
      downloadDataUrl(dataUrl, fileName)
    }

    return dataUrl
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper)
    }
  }
}
