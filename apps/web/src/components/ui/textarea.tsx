import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: 'sm' | 'md'
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size = 'sm', ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-[var(--radius-sm)] border border-[#d9d0c8] bg-white text-[var(--char)] outline-hidden transition-colors placeholder:text-[var(--stone)] hover:border-[var(--stone)] focus:border-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'p-2.5 text-xs sm:text-sm' : 'p-3 text-sm',
        className,
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
