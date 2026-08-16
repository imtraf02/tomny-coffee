import * as React from 'react'
import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group'
import { resolveClassName } from './_utils'

export const Toggle = React.forwardRef<
  React.ComponentRef<typeof BaseToggle>,
  React.ComponentPropsWithoutRef<typeof BaseToggle>
>(({ className, ...props }, ref) => (
  <BaseToggle
    ref={ref}
    className={resolveClassName('inline-flex min-h-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stone)] px-3 text-sm font-semibold text-[var(--char)] transition-colors data-pressed:border-[var(--espresso)] data-pressed:bg-[var(--espresso)] data-pressed:text-[var(--crema)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2', className)}
    {...props}
  />
))
Toggle.displayName = 'Toggle'

export const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof BaseToggleGroup>,
  React.ComponentPropsWithoutRef<typeof BaseToggleGroup>
>(({ className, ...props }, ref) => (
  <BaseToggleGroup
    ref={ref}
    className={resolveClassName('inline-flex flex-wrap gap-1.5', className)}
    {...props}
  />
))
ToggleGroup.displayName = 'ToggleGroup'
