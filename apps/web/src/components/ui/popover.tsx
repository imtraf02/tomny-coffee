import * as React from 'react'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { resolveClassName } from './_utils'

export const PopoverRoot = BasePopover.Root
export const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BasePopover.Trigger>
>(({ className, ...props }, ref) => (
  <BasePopover.Trigger
    ref={ref}
    className={resolveClassName(
      'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--stone)] bg-transparent px-3 text-sm font-semibold text-[var(--char)] transition-colors hover:border-[var(--ember)] hover:text-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  />
))
PopoverTrigger.displayName = 'PopoverTrigger'

export const PopoverPortal = BasePopover.Portal

export const PopoverPositioner = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Positioner>,
  React.ComponentPropsWithoutRef<typeof BasePopover.Positioner>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <BasePopover.Positioner
    ref={ref}
    sideOffset={sideOffset}
    className={resolveClassName('z-50 outline-hidden', className)}
    {...props}
  />
))
PopoverPositioner.displayName = 'PopoverPositioner'

export const PopoverPopup = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Popup>,
  React.ComponentPropsWithoutRef<typeof BasePopover.Popup>
>(({ className, ...props }, ref) => (
  <BasePopover.Popup
    ref={ref}
    className={resolveClassName(
      'w-72 origin-[var(--transform-origin)] rounded-[var(--radius-lg)] border border-[#ded1c0] bg-[#fffdf9] p-4 text-[var(--char)] shadow-xl outline-hidden transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
      className,
    )}
    {...props}
  />
))
PopoverPopup.displayName = 'PopoverPopup'

export const PopoverArrow = BasePopover.Arrow
export const PopoverBackdrop = BasePopover.Backdrop

export const PopoverTitle = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Title>,
  React.ComponentPropsWithoutRef<typeof BasePopover.Title>
>(({ className, ...props }, ref) => (
  <BasePopover.Title
    ref={ref}
    className={resolveClassName('text-sm font-bold text-[var(--char)]', className)}
    {...props}
  />
))
PopoverTitle.displayName = 'PopoverTitle'

export const PopoverDescription = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Description>,
  React.ComponentPropsWithoutRef<typeof BasePopover.Description>
>(({ className, ...props }, ref) => (
  <BasePopover.Description
    ref={ref}
    className={resolveClassName('mt-1 text-xs leading-relaxed text-[var(--stone)]', className)}
    {...props}
  />
))
PopoverDescription.displayName = 'PopoverDescription'

export const PopoverClose = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Close>,
  React.ComponentPropsWithoutRef<typeof BasePopover.Close>
>(({ className, ...props }, ref) => (
  <BasePopover.Close
    ref={ref}
    className={resolveClassName(
      'mt-3 inline-flex min-h-9 items-center rounded-[var(--radius-sm)] border border-[var(--stone)] px-3 text-xs font-bold transition-colors hover:border-[var(--ember)] hover:text-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  />
))
PopoverClose.displayName = 'PopoverClose'

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof BasePopover.Popup> {
  positionerProps?: React.ComponentPropsWithoutRef<typeof BasePopover.Positioner>
  portalProps?: React.ComponentPropsWithoutRef<typeof BasePopover.Portal>
}

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof BasePopover.Popup>,
  PopoverContentProps
>(({ className, children, positionerProps, portalProps, ...props }, ref) => (
  <PopoverPortal {...portalProps}>
    <PopoverPositioner {...positionerProps}>
      <PopoverPopup ref={ref} className={className} {...props}>
        {children}
      </PopoverPopup>
    </PopoverPositioner>
  </PopoverPortal>
))
PopoverContent.displayName = 'PopoverContent'

export const Popover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Portal: PopoverPortal,
  Positioner: PopoverPositioner,
  Popup: PopoverPopup,
  Content: PopoverContent,
  Arrow: PopoverArrow,
  Backdrop: PopoverBackdrop,
  Title: PopoverTitle,
  Description: PopoverDescription,
  Close: PopoverClose,
  createHandle: BasePopover.createHandle,
})
