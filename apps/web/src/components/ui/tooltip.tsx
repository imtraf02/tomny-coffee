import * as React from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { resolveClassName } from './_utils'

export const TooltipProvider = BaseTooltip.Provider
export const TooltipRoot = BaseTooltip.Root

export const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Trigger>
>(({ className, ...props }, ref) => (
  <BaseTooltip.Trigger
    ref={ref}
    className={resolveClassName(
      'inline-flex items-center justify-center rounded border-0 bg-transparent p-0 text-inherit focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  />
))
TooltipTrigger.displayName = 'TooltipTrigger'

export const TooltipPortal = BaseTooltip.Portal
export const TooltipPositioner = BaseTooltip.Positioner

export const TooltipPopup = React.forwardRef<
  React.ComponentRef<typeof BaseTooltip.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup>
>(({ className, ...props }, ref) => (
  <BaseTooltip.Popup
    ref={ref}
    className={resolveClassName(
      'z-50 max-w-64 rounded-[var(--radius-sm)] bg-[var(--espresso)] px-2.5 py-1.5 text-xs font-semibold text-[var(--crema)] shadow-lg outline-hidden transition-[opacity,scale] duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
      className,
    )}
    {...props}
  />
))
TooltipPopup.displayName = 'TooltipPopup'

export const TooltipArrow = BaseTooltip.Arrow

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup> {
  positionerProps?: React.ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseTooltip.Portal>
}

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof BaseTooltip.Popup>,
  TooltipContentProps
>(({ className, children, positionerProps, portalProps, ...props }, ref) => (
  <TooltipPortal {...portalProps}>
    <TooltipPositioner {...positionerProps}>
      <TooltipPopup ref={ref} className={className} {...props}>
        {children}
      </TooltipPopup>
    </TooltipPositioner>
  </TooltipPortal>
))
TooltipContent.displayName = 'TooltipContent'

export const Tooltip = Object.assign(TooltipRoot, {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Portal: TooltipPortal,
  Positioner: TooltipPositioner,
  Popup: TooltipPopup,
  Content: TooltipContent,
  Arrow: TooltipArrow,
  Provider: TooltipProvider,
  createHandle: BaseTooltip.createHandle,
})
