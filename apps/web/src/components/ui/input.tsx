import * as React from 'react'
import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '@/lib/utils'
import { resolveClassName } from './_utils'

export interface InputProps extends Omit<React.ComponentPropsWithoutRef<typeof BaseInput>, 'size'> {
  size?: 'sm' | 'md'
}

export const Input = React.forwardRef<
  React.ComponentRef<typeof BaseInput>,
  InputProps
>(({ className, size = 'sm', ...props }, ref) => (
  <BaseInput
    ref={ref}
    className={resolveClassName(
      cn(
        'w-full rounded-[var(--radius-sm)] border border-[#d9d0c8] bg-white text-[var(--char)] outline-hidden transition-colors placeholder:text-[var(--stone)] hover:border-[var(--stone)] focus:border-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-10 px-3 text-xs sm:text-sm' : 'min-h-11 px-3.5 text-sm'
      ),
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
