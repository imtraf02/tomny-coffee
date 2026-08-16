import * as React from 'react'
import { Progress as BaseProgress } from '@base-ui/react/progress'
import { resolveClassName } from './_utils'

export const ProgressRoot = React.forwardRef<
  React.ComponentRef<typeof BaseProgress.Root>,
  React.ComponentPropsWithoutRef<typeof BaseProgress.Root>
>(({ className, ...props }, ref) => (
  <BaseProgress.Root
    ref={ref}
    className={resolveClassName('grid gap-1.5', className)}
    {...props}
  />
))
ProgressRoot.displayName = 'ProgressRoot'

export const ProgressLabel = React.forwardRef<
  React.ComponentRef<typeof BaseProgress.Label>,
  React.ComponentPropsWithoutRef<typeof BaseProgress.Label>
>(({ className, ...props }, ref) => (
  <BaseProgress.Label
    ref={ref}
    className={resolveClassName('text-xs font-semibold text-[var(--stone)]', className)}
    {...props}
  />
))
ProgressLabel.displayName = 'ProgressLabel'

export const ProgressTrack = React.forwardRef<
  React.ComponentRef<typeof BaseProgress.Track>,
  React.ComponentPropsWithoutRef<typeof BaseProgress.Track>
>(({ className, ...props }, ref) => (
  <BaseProgress.Track
    ref={ref}
    className={resolveClassName('h-2 overflow-hidden rounded-full bg-[#e4ddd4]', className)}
    {...props}
  />
))
ProgressTrack.displayName = 'ProgressTrack'

export const ProgressIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseProgress.Indicator>,
  React.ComponentPropsWithoutRef<typeof BaseProgress.Indicator>
>(({ className, ...props }, ref) => (
  <BaseProgress.Indicator
    ref={ref}
    className={resolveClassName('h-full rounded-full bg-[var(--ember)] transition-[width] duration-200', className)}
    {...props}
  />
))
ProgressIndicator.displayName = 'ProgressIndicator'

export const ProgressValue = BaseProgress.Value

export const Progress = Object.assign(ProgressRoot, {
  Root: ProgressRoot,
  Label: ProgressLabel,
  Track: ProgressTrack,
  Indicator: ProgressIndicator,
  Value: ProgressValue,
})

