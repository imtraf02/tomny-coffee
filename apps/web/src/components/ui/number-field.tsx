import * as React from 'react'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { resolveClassName } from './_utils'

export const NumberFieldRoot = React.forwardRef<
  React.ComponentRef<typeof BaseNumberField.Root>,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Root>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Root
    ref={ref}
    className={resolveClassName('grid gap-1.5', className)}
    {...props}
  />
))
NumberFieldRoot.displayName = 'NumberFieldRoot'

export const NumberFieldGroup = React.forwardRef<
  React.ComponentRef<typeof BaseNumberField.Group>,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Group>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Group
    ref={ref}
    className={resolveClassName('flex min-h-11 overflow-hidden rounded-[var(--radius-sm)] border border-[#d9d0c8] bg-white focus-within:border-[var(--ember)]', className)}
    {...props}
  />
))
NumberFieldGroup.displayName = 'NumberFieldGroup'

export const NumberFieldInput = React.forwardRef<
  React.ComponentRef<typeof BaseNumberField.Input>,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Input>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Input
    ref={ref}
    className={resolveClassName('min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--char)] outline-hidden', className)}
    {...props}
  />
))
NumberFieldInput.displayName = 'NumberFieldInput'

const numberButtonBase = 'inline-flex min-w-10 items-center justify-center bg-[#f8f6f1] text-[var(--char)] transition-colors hover:bg-[var(--crema)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-[-2px] disabled:pointer-events-none disabled:opacity-40'
const numberDecrementClasses = `${numberButtonBase} border-r border-[#d9d0c8]`
const numberIncrementClasses = `${numberButtonBase} border-l border-[#d9d0c8]`

export const NumberFieldIncrement = React.forwardRef<
  React.ComponentRef<typeof BaseNumberField.Increment>,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Increment>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Increment ref={ref} className={resolveClassName(numberIncrementClasses, className)} {...props}>
    +
  </BaseNumberField.Increment>
))
NumberFieldIncrement.displayName = 'NumberFieldIncrement'

export const NumberFieldDecrement = React.forwardRef<
  React.ComponentRef<typeof BaseNumberField.Decrement>,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Decrement>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Decrement ref={ref} className={resolveClassName(numberDecrementClasses, className)} {...props}>
    −
  </BaseNumberField.Decrement>
))
NumberFieldDecrement.displayName = 'NumberFieldDecrement'

export const NumberField = Object.assign(NumberFieldRoot, {
  Root: NumberFieldRoot,
  Group: NumberFieldGroup,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
  ScrubArea: BaseNumberField.ScrubArea,
  ScrubAreaCursor: BaseNumberField.ScrubAreaCursor,
})

