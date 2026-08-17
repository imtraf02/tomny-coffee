import { useState, useRef } from 'react'
import {
  IconPhoto,
  IconUpload,
  IconX,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import {
  validateImageFile,
  compressImage,
  createLocalPreview,
  getProductImageUrl,
} from '@/lib/image-utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

export interface ImageUploadProps {
  value?: string | null
  onChange: (nextKey: string | null) => void
  disabled?: boolean
  className?: string
  aspectRatio?: 'square' | 'portrait' | 'landscape'
  uploadEndpoint?: string
}

export function ImageUpload({
  value,
  onChange,
  disabled = false,
  className,
  aspectRatio = 'square',
  uploadEndpoint = '/api/media/menu-images',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  const currentImageUrl = localPreview || getProductImageUrl(value)

  const handleFile = async (rawFile: File) => {
    setError(null)

    // 1. Validation
    const validation = validateImageFile(rawFile)
    if (!validation.valid) {
      setError(validation.error || 'Ảnh không hợp lệ.')
      return
    }

    // 2. Instant Local Preview
    const previewUrl = createLocalPreview(rawFile)
    setLocalPreview(previewUrl)

    // 3. Client-side Auto-Compression
    setIsCompressing(true)
    let fileToUpload = rawFile
    try {
      fileToUpload = await compressImage(rawFile, {
        maxDimension: 1200,
        quality: 0.85,
        mimeType: 'image/webp',
      })
    } catch {
      fileToUpload = rawFile
    } finally {
      setIsCompressing(false)
    }

    // 4. Upload with XHR Progress
    setProgress(0)
    try {
      const key = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadEndpoint)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          try {
            const body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
            if (xhr.status >= 200 && xhr.status < 300 && body.key) {
              resolve(body.key)
            } else {
              reject(new Error(body.message || 'Không thể tải ảnh lên máy chủ.'))
            }
          } catch {
            reject(new Error('Phản hồi từ máy chủ không hợp lệ.'))
          }
        }

        xhr.onerror = () => reject(new Error('Lỗi kết nối mạng khi tải ảnh.'))

        const formData = new FormData()
        formData.set('file', fileToUpload)
        xhr.send(formData)
      })

      onChange(key)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải ảnh thất bại.')
    } finally {
      setProgress(null)
    }
  }

  const handleClear = () => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview)
      setLocalPreview(null)
    }
    setError(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const ratioClass =
    aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : aspectRatio === 'landscape'
        ? 'aspect-[16/9]'
        : 'aspect-square'

  return (
    <div className={cn('flex flex-col gap-2 w-full', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        disabled={disabled || progress !== null}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />

      {/* Upload Zone / Preview Card */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-xl border border-[#ded1c0] bg-[#faf7f2] transition-all group select-none',
          ratioClass,
          isDragOver && 'border-[var(--ember)] ring-2 ring-[var(--ember)]/20 bg-[#fff5eb]',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          if (disabled) return
          e.preventDefault()
          setIsDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void handleFile(file)
        }}
      >
        {currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt="Ảnh món"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
              onError={() => {
                // If remote image fails, clear it or show fallback
              }}
            />

            {/* Quick Hover Overlay Actions */}
            {!disabled && progress === null && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/90 text-black hover:bg-white text-[11px] font-bold"
                >
                  <IconRefresh size={14} />
                  <span>Đổi ảnh</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleClear}
                  className="bg-white/90 text-[var(--ember)] hover:bg-white text-[11px] font-bold"
                >
                  <IconX size={14} />
                  <span>Xóa</span>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !disabled && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                fileInputRef.current?.click()
              }
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center cursor-pointer text-[#8c8177] hover:text-[#5f5248] hover:bg-[#f4efe8] transition-colors"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-white shadow-xs border border-[#e5ded6] text-[var(--ember)]">
              <IconPhoto size={20} stroke={1.75} />
            </div>
            <span className="text-xs font-bold text-[var(--char)]">Thêm ảnh món</span>
            <span className="text-[10px] text-[#8c8177]">Kéo thả hoặc bấm để chọn</span>
            <span className="text-[9.5px] font-mono uppercase bg-[#ede6de] text-[#61574f] px-1.5 py-0.5 rounded font-bold">1 : 1</span>
          </div>
        )}

        {/* Progress Overlay */}
        {(progress !== null || isCompressing) && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-4 text-white">
            <span className="text-xs font-bold">
              {isCompressing ? 'Đang tối ưu ảnh…' : `Đang tải lên ${progress}%`}
            </span>
            <div className="w-full max-w-[120px]">
              <Progress.Root value={progress ?? 0} className="h-1.5 w-full bg-white/30 rounded-full overflow-hidden">
                <Progress.Track className="bg-transparent">
                  <Progress.Indicator className="h-full bg-white transition-all duration-150" />
                </Progress.Track>
              </Progress.Root>
            </div>
          </div>
        )}
      </div>

      {/* Button Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={disabled || progress !== null}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 text-xs"
        >
          <IconUpload size={14} />
          <span>{currentImageUrl ? 'Thay ảnh khác' : 'Chọn ảnh'}</span>
        </Button>

        {currentImageUrl && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={disabled || progress !== null}
            onClick={handleClear}
            className="text-xs text-[var(--ember)] hover:bg-[#fff0eb]"
          >
            <IconX size={14} />
            <span>Xóa</span>
          </Button>
        )}
      </div>

      {/* Note & Error Messages */}
      <div className="text-[10px] text-[#8c8177] leading-tight">
        PNG, JPG, WebP · Tối đa 10MB · Tự động nén tối ưu
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--ember)] font-semibold bg-[#fdeeed] p-2 rounded-lg border border-[#fbd4d0]">
          <IconAlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
