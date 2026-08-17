import * as React from 'react'
import { cn } from '@/lib/utils'

const SKELETON_BASE = 'animate-pulse rounded-md bg-[#e9e1d7]'

export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} aria-hidden="true" className={cn(SKELETON_BASE, className)} {...props} />
  ),
)
Skeleton.displayName = 'Skeleton'

type SkeletonColumn = {
  width?: string
  align?: 'left' | 'right' | 'center'
  cellClassName?: string
}

type SkeletonTableProps = {
  columns: SkeletonColumn[]
  rows?: number
  label?: string
  className?: string
  mobileCards?: boolean
}

export function SkeletonTable({ columns, rows = 6, label = 'Đang tải…', className, mobileCards = true }: SkeletonTableProps) {
  return (
    <div role="status" aria-busy="true" className={cn('rounded-xl border border-[#ede6de] bg-white overflow-hidden shadow-2xs', className)}>
      <span className="sr-only">{label}</span>
      <div className="overflow-x-auto">
        <table className="product-mockup-table w-full">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} style={{ width: col.width }}>
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {columns.map((col, c) => (
                  <td key={c} className={cn(col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}>
                    <div className={cn('flex', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                      <Skeleton className={cn('h-4', col.cellClassName ?? 'w-24')} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileCards && (
        <div className="md:hidden grid gap-2 p-3 border-t border-[#f0ebe4]">
          {Array.from({ length: Math.min(rows, 5) }).map((_, r) => (
            <div key={r} className="rounded-2xl border border-[#ede6de] p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type SkeletonMetricGridProps = {
  count?: number
  label?: string
  className?: string
}

export function SkeletonMetricGrid({ count = 4, label = 'Đang tải…', className }: SkeletonMetricGridProps) {
  return (
    <div role="status" aria-busy="true" className={cn('grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 sm:p-4 rounded-xl border border-[#e5ddd6] bg-white flex flex-col gap-2 shadow-2xs">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  )
}

type SkeletonListProps = {
  rows?: number
  label?: string
  className?: string
  itemClassName?: string
}

export function SkeletonList({ rows = 4, label = 'Đang tải…', className, itemClassName }: SkeletonListProps) {
  return (
    <div role="status" aria-busy="true" className={cn('grid gap-2', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[#ede6de] bg-white', itemClassName)}>
          <div className="flex flex-col gap-1.5 min-w-0">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
