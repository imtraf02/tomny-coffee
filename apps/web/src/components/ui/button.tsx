import * as React from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@/lib/utils'
import { resolveClassName } from './_utils'

export interface ButtonProps extends React.ComponentPropsWithoutRef<typeof BaseButton> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass'
}

export const Button = React.forwardRef<
  React.ComponentRef<typeof BaseButton>,
  ButtonProps
>(({ className, size = 'sm', variant = 'secondary', ...props }, ref) => {
  const sizeClasses = {
    xs: 'h-7 px-2.5 text-xs font-semibold rounded-lg gap-1 [&_svg:not([class*=\'size-\'])]:size-3.5',
    sm: 'h-8.5 px-3 text-xs sm:text-sm font-semibold rounded-xl gap-1.5 [&_svg:not([class*=\'size-\'])]:size-4',
    md: 'h-10 px-4 text-sm font-bold rounded-xl gap-2 [&_svg:not([class*=\'size-\'])]:size-4.5',
    lg: 'h-12 px-5 text-base font-bold rounded-2xl gap-2.5 [&_svg:not([class*=\'size-\'])]:size-5',
    icon: 'size-10 rounded-xl p-0 [&_svg:not([class*=\'size-\'])]:size-4.5',
    'icon-sm': 'size-8.5 rounded-xl p-0 [&_svg:not([class*=\'size-\'])]:size-4',
    'icon-xs': 'size-7 rounded-lg p-0 [&_svg:not([class*=\'size-\'])]:size-3.5',
  }[size]

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#8c351e] to-[#b3381e] text-white shadow-xs hover:from-[#7a2e1a] hover:to-[#9c301a] active:scale-[0.98] border border-white/20',
    secondary:
      'bg-white/90 hover:bg-white text-[var(--char)] border border-[#ded6cc] shadow-2xs hover:border-[#c5bcaf] hover:shadow-xs active:scale-[0.98]',
    outline:
      'border border-[#d9d0c8] bg-transparent hover:bg-white/60 text-[var(--char)] active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-[#ede6de] text-[var(--char)] active:scale-[0.98]',
    danger:
      'bg-[#dc2626] text-white hover:bg-[#b91c1c] active:scale-[0.98] shadow-xs border border-transparent',
    glass:
      'liquid-glass text-[var(--char)] hover:bg-white/95 active:scale-[0.98]',
  }[variant]

  return (
    <BaseButton
      ref={ref}
      className={resolveClassName(
        cn(
          'group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all duration-150 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--char)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:shrink-0',
          sizeClasses,
          variantClasses
        ),
        className
      )}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export const PrimaryButton = React.forwardRef<
  React.ComponentRef<typeof BaseButton>,
  ButtonProps
>(({ className, variant = 'primary', ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    className={className}
    {...props}
  />
))
PrimaryButton.displayName = 'PrimaryButton'

export const SecondaryButton = React.forwardRef<
  React.ComponentRef<typeof BaseButton>,
  ButtonProps
>(({ className, variant = 'secondary', ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    className={className}
    {...props}
  />
))
SecondaryButton.displayName = 'SecondaryButton'
