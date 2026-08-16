import * as React from 'react'
import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { resolveClassName } from './_utils'

export const DrawerRoot = BaseDrawer.Root
export const DrawerProvider = BaseDrawer.Provider
export const DrawerTrigger = BaseDrawer.Trigger
export const DrawerPortal = BaseDrawer.Portal

export const DrawerBackdrop = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Backdrop
    ref={ref}
    className={resolveClassName(
      'fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--char)_58%,transparent)] transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0',
      className,
    )}
    {...props}
  />
))
DrawerBackdrop.displayName = 'DrawerBackdrop'

export const DrawerViewport = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Viewport>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Viewport>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Viewport
    ref={ref}
    className={resolveClassName('fixed inset-0 z-50 flex justify-end outline-hidden', className)}
    {...props}
  />
))
DrawerViewport.displayName = 'DrawerViewport'

export const DrawerPopup = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Popup>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Popup
    ref={ref}
    className={resolveClassName(
      'h-full w-full max-w-md overflow-y-auto border-l border-[#ded1c0] bg-[#fffdf9] p-6 text-[var(--char)] shadow-2xl outline-hidden transition-transform duration-200 ease-out data-starting-style:translate-x-full data-ending-style:translate-x-full',
      className,
    )}
    {...props}
  />
))
DrawerPopup.displayName = 'DrawerPopup'

export const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Popup> & {
    backdropClassName?: string
    viewportClassName?: string
  }
>(({ className, children, backdropClassName, viewportClassName, ...props }, ref) => (
  <DrawerPortal>
    <DrawerBackdrop className={backdropClassName} />
    <DrawerViewport className={viewportClassName}>
      <DrawerPopup ref={ref} className={className} {...props}>
        {children}
      </DrawerPopup>
    </DrawerViewport>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'

export const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Title>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Title
    ref={ref}
    className={resolveClassName('text-xl font-bold tracking-tight text-[var(--char)]', className)}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

export const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Description>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Description
    ref={ref}
    className={resolveClassName('mt-1 text-sm leading-relaxed text-[var(--stone)]', className)}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

export const DrawerClose = React.forwardRef<
  React.ComponentRef<typeof BaseDrawer.Close>,
  React.ComponentPropsWithoutRef<typeof BaseDrawer.Close>
>(({ className, ...props }, ref) => (
  <BaseDrawer.Close
    ref={ref}
    className={resolveClassName(
      'inline-flex min-h-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--stone)] px-3 text-sm font-semibold transition-colors hover:border-[var(--ember)] hover:text-[var(--ember)] focus-visible:outline-2 focus-visible:outline-[var(--amber)] focus-visible:outline-offset-2',
      className,
    )}
    {...props}
  />
))
DrawerClose.displayName = 'DrawerClose'

export const Drawer = Object.assign(DrawerRoot, {
  Root: DrawerRoot,
  Provider: DrawerProvider,
  Trigger: DrawerTrigger,
  Portal: DrawerPortal,
  Backdrop: DrawerBackdrop,
  Viewport: DrawerViewport,
  Popup: DrawerPopup,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
  SwipeArea: BaseDrawer.SwipeArea,
  createHandle: BaseDrawer.createHandle,
})

