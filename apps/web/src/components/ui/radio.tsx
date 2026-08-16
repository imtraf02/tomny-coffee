import * as React from 'react'
import { Radio as BaseRadio } from '@base-ui/react/radio'
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group'
import { resolveClassName } from './_utils'

export const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof BaseRadioGroup>,
  React.ComponentPropsWithoutRef<typeof BaseRadioGroup>
>(({ className, ...props }, ref) => (
  <BaseRadioGroup
    ref={ref}
    className={resolveClassName('grid gap-2', className)}
    {...props}
  />
))
RadioGroup.displayName = 'RadioGroup'

export const RadioRoot = React.forwardRef<
  React.ComponentRef<typeof BaseRadio.Root>,
  React.ComponentPropsWithoutRef<typeof BaseRadio.Root>
>(({ className, ...props }, ref) => (
  <BaseRadio.Root
    ref={ref}
    className={resolveClassName('inline-grid size-5 place-items-center rounded-full border border-[var(--stone)] bg-white data-checked:border-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2', className)}
    {...props}
  />
))
RadioRoot.displayName = 'RadioRoot'

export const RadioIndicator = React.forwardRef<
  React.ComponentRef<typeof BaseRadio.Indicator>,
  React.ComponentPropsWithoutRef<typeof BaseRadio.Indicator>
>(({ className, ...props }, ref) => (
  <BaseRadio.Indicator
    ref={ref}
    className={resolveClassName('size-2.5 rounded-full bg-[var(--ember)]', className)}
    {...props}
  />
))
RadioIndicator.displayName = 'RadioIndicator'

export const Radio = Object.assign(RadioRoot, {
  Root: RadioRoot,
  Indicator: RadioIndicator,
  Group: RadioGroup,
})

