import * as React from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { cn } from '@/lib/utils'

function resolveClassName<T>(
  defaults: string,
  className?: string | ((state: T) => string | undefined),
) {
  if (typeof className === 'function') return (state: T) => cn(defaults, className(state))
  return cn(defaults, className)
}

export const CheckboxRoot = React.forwardRef<
  React.ComponentRef<typeof BaseCheckbox.Root>,
  React.ComponentPropsWithoutRef<typeof BaseCheckbox.Root>
>(({ className, ...props }, ref) => (
  <BaseCheckbox.Root
    ref={ref}
    className={resolveClassName(
      'inline-grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--stone)] bg-white text-white transition-colors data-checked:border-[var(--ember)] data-checked:bg-[var(--ember)] data-indeterminate:border-[var(--ember)] data-indeterminate:bg-[var(--ember)] data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  />
))
CheckboxRoot.displayName = 'CheckboxRoot'

export const CheckboxIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseCheckbox.Indicator>,
  React.ComponentPropsWithoutRef<typeof BaseCheckbox.Indicator>
>(({ className, children, ...props }, ref) => (
  <BaseCheckbox.Indicator
    ref={ref}
    className={resolveClassName('inline-flex items-center justify-center', className)}
    {...props}
  >
    {children ?? (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    )}
  </BaseCheckbox.Indicator>
))
CheckboxIndicator.displayName = 'CheckboxIndicator'

export const Checkbox = Object.assign(CheckboxRoot, {
  Root: CheckboxRoot,
  Indicator: CheckboxIndicator,
})
