import * as React from 'react'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { cn } from '@/lib/utils'

function resolveClassName<T>(
  defaultClasses: string,
  className?: string | ((state: T) => string | undefined)
): string | ((state: T) => string | undefined) {
  if (typeof className === 'function') {
    return (state: T) => cn(defaultClasses, className(state))
  }
  return cn(defaultClasses, className)
}

export const ToastProvider = BaseToast.Provider
export const ToastPortal = BaseToast.Portal

export const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Viewport>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Viewport>
>(({ className, ...props }, ref) => {
  return (
    <BaseToast.Viewport
      ref={ref}
      className={resolveClassName(
        'fixed top-auto right-4 bottom-4 z-50 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none outline-hidden',
        className
      )}
      {...props}
    />
  )
})
ToastViewport.displayName = 'ToastViewport'

export const ToastRoot = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Root>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Root>
>(({ className, ...props }, ref) => {
  return (
    <BaseToast.Root
      ref={ref}
      className={resolveClassName(
        'pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border border-[#ded1c0] bg-[#fffdf9] p-4 text-[#1c1512] shadow-xl transition-all duration-200 ease-out data-starting-style:translate-y-4 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:scale-95',
        className
      )}
      {...props}
    />
  )
})
ToastRoot.displayName = 'ToastRoot'

export const ToastContent = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Content>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Content>
>(({ className, ...props }, ref) => {
  return (
    <BaseToast.Content
      ref={ref}
      className={resolveClassName('flex flex-1 items-center gap-3 min-w-0', className)}
      {...props}
    />
  )
})
ToastContent.displayName = 'ToastContent'

export const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Title>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Title>
>(({ className, ...props }, ref) => {
  return (
    <BaseToast.Title
      ref={ref}
      className={resolveClassName('text-sm font-bold text-[#1c1512]', className)}
      {...props}
    />
  )
})
ToastTitle.displayName = 'ToastTitle'

export const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Description>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Description>
>(({ className, ...props }, ref) => {
  return (
    <BaseToast.Description
      ref={ref}
      className={resolveClassName('text-xs text-[#8c8177] mt-0.5 leading-relaxed', className)}
      {...props}
    />
  )
})
ToastDescription.displayName = 'ToastDescription'

export const ToastClose = React.forwardRef<
  React.ComponentRef<typeof BaseToast.Close>,
  React.ComponentPropsWithoutRef<typeof BaseToast.Close>
>(({ className, children, ...props }, ref) => {
  return (
    <BaseToast.Close
      ref={ref}
      className={resolveClassName(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[#8c8177] hover:bg-[#efe3d0]/60 hover:text-[#1c1512] transition-colors focus-visible:outline-2 focus-visible:outline-[#c48a2e]',
        className
      )}
      aria-label="Đóng thông báo"
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
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
      )}
    </BaseToast.Close>
  )
})
ToastClose.displayName = 'ToastClose'

export const ToastAction = BaseToast.Action
export const useToastManager = BaseToast.useToastManager
export const createToastManager = BaseToast.createToastManager

/**
 * Ready-to-use Toaster component that renders active toasts.
 */
export function Toaster() {
  const { toasts } = useToastManager()

  return (
    <ToastPortal>
      <ToastViewport>
        {toasts.map((toast) => (
          <ToastRoot key={toast.id} toast={toast}>
            <ToastContent>
              <div className="flex flex-col min-w-0 flex-1">
                <ToastTitle />
                <ToastDescription />
              </div>
              <ToastClose />
            </ToastContent>
          </ToastRoot>
        ))}
      </ToastViewport>
    </ToastPortal>
  )
}

export const Toast = Object.assign(ToastRoot, {
  Root: ToastRoot,
  Provider: ToastProvider,
  Portal: ToastPortal,
  Viewport: ToastViewport,
  Content: ToastContent,
  Title: ToastTitle,
  Description: ToastDescription,
  Close: ToastClose,
  Action: ToastAction,
  useToastManager,
  createToastManager,
  Toaster,
})
