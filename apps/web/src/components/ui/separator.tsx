import * as React from 'react'
import { Separator as BaseSeparator } from '@base-ui/react/separator'
import { resolveClassName } from './_utils'

export const Separator = React.forwardRef<
  React.ComponentRef<typeof BaseSeparator>,
  React.ComponentPropsWithoutRef<typeof BaseSeparator>
>(({ className, ...props }, ref) => (
  <BaseSeparator
    ref={ref}
    className={resolveClassName('shrink-0 bg-[#ded1c0] data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px', className)}
    {...props}
  />
))
Separator.displayName = 'Separator'

