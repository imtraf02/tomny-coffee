import * as React from 'react'
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { resolveClassName } from './_utils'

export const AlertDialogRoot = BaseAlertDialog.Root
export const AlertDialogTrigger = BaseAlertDialog.Trigger
export const AlertDialogPortal = BaseAlertDialog.Portal

export const AlertDialogBackdrop = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Backdrop
    ref={ref}
    className={resolveClassName('fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--char)_62%,transparent)] transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0', className)}
    {...props}
  />
))
AlertDialogBackdrop.displayName = 'AlertDialogBackdrop'

export const AlertDialogViewport = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Viewport>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Viewport>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Viewport
    ref={ref}
    className={resolveClassName('fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4', className)}
    {...props}
  />
))
AlertDialogViewport.displayName = 'AlertDialogViewport'

export const AlertDialogPopup = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Popup>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Popup
    ref={ref}
    className={resolveClassName('w-full max-w-md rounded-[var(--radius-lg)] border border-[#ded1c0] bg-[#fffdf9] p-6 text-[var(--char)] shadow-2xl outline-hidden transition-[opacity,scale] duration-150 data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0', className)}
    {...props}
  />
))
AlertDialogPopup.displayName = 'AlertDialogPopup'

export const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Title>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Title>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Title
    ref={ref}
    className={resolveClassName('text-xl font-bold text-[var(--char)]', className)}
    {...props}
  />
))
AlertDialogTitle.displayName = 'AlertDialogTitle'

export const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Description>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Description>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Description
    ref={ref}
    className={resolveClassName('mt-2 text-sm leading-relaxed text-[var(--stone)]', className)}
    {...props}
  />
))
AlertDialogDescription.displayName = 'AlertDialogDescription'

export const AlertDialogClose = React.forwardRef<
  React.ComponentRef<typeof BaseAlertDialog.Close>,
  React.ComponentPropsWithoutRef<typeof BaseAlertDialog.Close>
>(({ className, ...props }, ref) => (
  <BaseAlertDialog.Close
    ref={ref}
    className={resolveClassName(
      'inline-flex h-8.5 px-3 sm:px-4 items-center justify-center rounded-xl border border-[#ded6cc] bg-white text-[var(--char)] font-bold text-xs sm:text-sm shadow-2xs hover:bg-[#faf7f3] hover:border-[#c5bcaf] active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--amber)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none',
      className,
    )}
    {...props}
  />
))
AlertDialogClose.displayName = 'AlertDialogClose'

export const AlertDialog = Object.assign(AlertDialogRoot, {
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Portal: AlertDialogPortal,
  Backdrop: AlertDialogBackdrop,
  Viewport: AlertDialogViewport,
  Popup: AlertDialogPopup,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Close: AlertDialogClose,
})

