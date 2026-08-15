import * as React from 'react'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

/**
 * Resolves className when it can be either a string or a state-based callback function.
 */
function resolveClassName<T>(
  defaultClasses: string,
  className?: string | ((state: T) => string | undefined)
): string | ((state: T) => string | undefined) {
  if (typeof className === 'function') {
    return (state: T) => cn(defaultClasses, className(state))
  }
  return cn(defaultClasses, className)
}

/**
 * Dialog root component that manages the open state.
 */
export const DialogRoot = BaseDialog.Root

/**
 * Button or element that triggers the dialog opening.
 */
export const DialogTrigger = BaseDialog.Trigger

/**
 * Portals dialog content to document.body (or specified container).
 */
export const DialogPortal = BaseDialog.Portal

/**
 * Overlay backdrop displayed behind the dialog popup.
 */
export const DialogBackdrop = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Backdrop>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Backdrop
      ref={ref}
      className={resolveClassName(
        'fixed inset-0 z-50 bg-[#1c1512]/60 backdrop-blur-xs transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute',
        className
      )}
      {...props}
    />
  )
})
DialogBackdrop.displayName = 'DialogBackdrop'

/**
 * Position container that centers or positions the dialog on screen.
 */
export const DialogViewport = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Viewport>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Viewport>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Viewport
      ref={ref}
      className={resolveClassName(
        'fixed inset-0 z-50 overflow-y-auto grid place-items-center p-4 sm:p-6',
        className
      )}
      {...props}
    />
  )
})
DialogViewport.displayName = 'DialogViewport'

/**
 * The dialog popup surface containing content.
 */
export const DialogPopup = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Popup>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Popup
      ref={ref}
      className={resolveClassName(
        'relative w-full max-w-lg rounded-xl bg-[#fffdf9] p-6 sm:p-8 text-[#1c1512] shadow-2xl border border-[#ded1c0] transition-[opacity,transform] duration-150 ease-out data-starting-style:opacity-0 data-starting-style:scale-98 data-ending-style:opacity-0 data-ending-style:scale-98 focus:outline-hidden',
        className
      )}
      {...props}
    />
  )
})
DialogPopup.displayName = 'DialogPopup'

/**
 * Header section of the dialog (typically wraps Title and Description).
 */
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 text-left mb-4', className)}
      {...props}
    />
  )
}
DialogHeader.displayName = 'DialogHeader'

/**
 * Footer section of the dialog (typically contains action buttons).
 */
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6 pt-2',
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

/**
 * Accessible title heading of the dialog.
 */
export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Title>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Title>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Title
      ref={ref}
      className={resolveClassName(
        'text-2xl font-bold tracking-tight text-[#1c1512] font-[var(--font-display,inherit)]',
        className
      )}
      {...props}
    />
  )
})
DialogTitle.displayName = 'DialogTitle'

/**
 * Accessible description paragraph of the dialog.
 */
export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Description>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Description>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Description
      ref={ref}
      className={resolveClassName(
        'text-sm text-[#8c8177] leading-relaxed',
        className
      )}
      {...props}
    />
  )
})
DialogDescription.displayName = 'DialogDescription'

/**
 * Close button component.
 */
export const DialogClose = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Close>,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Close>
>(({ className, ...props }, ref) => {
  return (
    <BaseDialog.Close
      ref={ref}
      className={resolveClassName(
        'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#c48a2e] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
DialogClose.displayName = 'DialogClose'

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  backdropClassName?: string
  viewportClassName?: string
  portalProps?: React.ComponentPropsWithoutRef<typeof BaseDialog.Portal>
  showCloseButton?: boolean
}

/**
 * High-level convenient Dialog Content wrapper combining Portal, Backdrop, Viewport, Popup and optional Close button.
 */
export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof BaseDialog.Popup>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      backdropClassName,
      viewportClassName,
      portalProps,
      showCloseButton = true,
      ...props
    },
    ref
  ) => {
    return (
      <DialogPortal {...portalProps}>
        <DialogBackdrop className={backdropClassName} />
        <DialogViewport className={viewportClassName}>
          <DialogPopup ref={ref} className={className} {...props}>
            {children}
            {showCloseButton && (
              <DialogClose
                className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg text-[#8c8177] hover:text-[#1c1512] hover:bg-[#efe3d0]/50 transition-colors"
                aria-label="Đóng"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </DialogClose>
            )}
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    )
  }
)
DialogContent.displayName = 'DialogContent'

/**
 * Helper to create dialog handle for detached triggers.
 */
export const createDialogHandle = BaseDialog.createHandle

/**
 * Composite Dialog object containing all dialog primitives and compound components.
 */
export const Dialog = Object.assign(DialogRoot, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Viewport: DialogViewport,
  Popup: DialogPopup,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
  createHandle: BaseDialog.createHandle,
})
