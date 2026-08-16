import * as React from 'react'
import { Field as BaseField } from '@base-ui/react/field'
import { cn } from '@/lib/utils'
import { resolveClassName } from './_utils'

export const FieldRoot = React.forwardRef<
  React.ComponentRef<typeof BaseField.Root>,
  React.ComponentPropsWithoutRef<typeof BaseField.Root>
>(({ className, ...props }, ref) => (
  <BaseField.Root
    ref={ref}
    className={resolveClassName('grid gap-1.5', className)}
    {...props}
  />
))
FieldRoot.displayName = 'FieldRoot'

export const FieldLabel = React.forwardRef<
  React.ComponentRef<typeof BaseField.Label>,
  React.ComponentPropsWithoutRef<typeof BaseField.Label>
>(({ className, ...props }, ref) => (
  <BaseField.Label
    ref={ref}
    className={resolveClassName(
      'text-xs font-bold uppercase tracking-wider text-[var(--stone)] cursor-default',
      className,
    )}
    {...props}
  />
))
FieldLabel.displayName = 'FieldLabel'

export const FieldDescription = React.forwardRef<
  React.ComponentRef<typeof BaseField.Description>,
  React.ComponentPropsWithoutRef<typeof BaseField.Description>
>(({ className, ...props }, ref) => (
  <BaseField.Description
    ref={ref}
    className={resolveClassName('text-xs leading-relaxed text-[var(--stone)]', className)}
    {...props}
  />
))
FieldDescription.displayName = 'FieldDescription'

export const FieldError = React.forwardRef<
  React.ComponentRef<typeof BaseField.Error>,
  React.ComponentPropsWithoutRef<typeof BaseField.Error>
>(({ className, ...props }, ref) => (
  <BaseField.Error
    ref={ref}
    className={resolveClassName('text-xs font-semibold text-[var(--ember)]', className)}
    {...props}
  />
))
FieldError.displayName = 'FieldError'

export interface FieldControlProps extends Omit<React.ComponentPropsWithoutRef<typeof BaseField.Control>, 'size'> {
  size?: 'sm' | 'md'
}

export const FieldControl = React.forwardRef<
  React.ComponentRef<typeof BaseField.Control>,
  FieldControlProps
>(({ className, size = 'sm', ...props }, ref) => (
  <BaseField.Control
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
FieldControl.displayName = 'FieldControl'

export const FieldValidity = BaseField.Validity
export const FieldItem = BaseField.Item

export const Field = Object.assign(FieldRoot, {
  Root: FieldRoot,
  Label: FieldLabel,
  Description: FieldDescription,
  Error: FieldError,
  Control: FieldControl,
  Validity: FieldValidity,
  Item: FieldItem,
})
