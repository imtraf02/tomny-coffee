import * as React from 'react'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { resolveClassName } from './_utils'

export const SwitchRoot = React.forwardRef<
  React.ComponentRef<typeof BaseSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof BaseSwitch.Root>
>(({ className, children, ...props }, ref) => (
  <BaseSwitch.Root
    ref={ref}
    className={resolveClassName(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-[#d0c7bd] p-0.5 transition-colors data-checked:bg-[var(--moss)] data-disabled:pointer-events-none data-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2 select-none',
      className,
    )}
    {...props}
  >
    {children ?? <SwitchThumb />}
  </BaseSwitch.Root>
))
SwitchRoot.displayName = 'SwitchRoot'

export const SwitchThumb = React.forwardRef<
  React.ComponentRef<typeof BaseSwitch.Thumb>,
  React.ComponentPropsWithoutRef<typeof BaseSwitch.Thumb>
>(({ className, ...props }, ref) => (
  <BaseSwitch.Thumb
    ref={ref}
    className={resolveClassName(
      'block size-5 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-5',
      className,
    )}
    {...props}
  />
))
SwitchThumb.displayName = 'SwitchThumb'

export const Switch = Object.assign(SwitchRoot, {
  Root: SwitchRoot,
  Thumb: SwitchThumb,
})
